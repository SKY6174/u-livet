// Compare authorization and identity payloads within a rolled-back local DB transaction.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const migration = readFileSync(
  'supabase/migrations/20260927105915_optimize_identity_entry_org_aggregation.sql', 'utf8',
);
const baseline = readFileSync(
  'supabase/migrations/20260923083920_anchor_member_auth_link.sql', 'utf8',
).match(/create or replace function life_private\.identity\(\)[\s\S]*?\$\$;/i)?.[0];
assert.ok(baseline, 'Current production identity definition must be available');
const sql = `begin;
${baseline}
do $$begin
  execute replace(pg_get_functiondef('life_private.identity()'::regprocedure),
    'CREATE OR REPLACE FUNCTION life_private.identity()',
    'CREATE OR REPLACE FUNCTION pg_temp.original_identity()');
end$$;
create temp table profiles(name text primary key, claims text) on commit drop;
insert into profiles
select 'manager', jsonb_build_object('sub', u.id, 'aal', 'aal2', 'session_id', s.id)::text
from auth.users u
join public.life_auth_links a on a.auth_user_id = u.id
join public.life_role_assignments r on r.person_id = a.person_id and r.role = 'COURSE_MANAGER'
join auth.sessions s on s.user_id = u.id and s.aal = 'aal2'
join auth.mfa_factors f on f.id = s.factor_id and f.status = 'verified'
where u.email like '%example.invalid' and r.valid_from <= now()
  and (r.valid_until is null or r.valid_until > now())
  and (s.not_after is null or s.not_after > now())
limit 1;
insert into profiles
select 'instructor', jsonb_build_object('sub', u.id, 'aal', 'aal2', 'session_id', s.id)::text
from auth.users u
join public.life_auth_links a on a.auth_user_id = u.id
join public.life_role_assignments r on r.person_id = a.person_id and r.role = 'INSTRUCTOR'
join auth.sessions s on s.user_id = u.id and s.aal = 'aal2'
join auth.mfa_factors f on f.id = s.factor_id and f.status = 'verified'
where u.email like '%example.invalid' and r.valid_from <= now()
  and (r.valid_until is null or r.valid_until > now())
  and (s.not_after is null or s.not_after > now())
limit 1;
insert into profiles
select 'learner', jsonb_build_object('sub', u.id, 'aal', 'aal1', 'session_id', s.id)::text
from auth.users u
join public.life_auth_links a on a.auth_user_id = u.id
join public.life_enrollments e on e.person_id = a.person_id
join auth.sessions s on s.user_id = u.id and s.aal = 'aal1'
where u.email like '%example.invalid'
  and (s.not_after is null or s.not_after > now())
  and not exists(select 1 from public.life_role_assignments r where r.person_id = a.person_id)
limit 1;
insert into profiles
select 'missing_session', (claims::jsonb || jsonb_build_object('session_id', gen_random_uuid()))::text
from profiles where name = 'manager';
insert into profiles
select 'aal1', (claims::jsonb || '{"aal":"aal1"}'::jsonb)::text
from profiles where name = 'manager';
insert into profiles values ('anonymous', '{}');
do $$begin if (select count(*) from profiles) <> 6 then
  raise exception 'LOCAL_AUTH_FIXTURES_MISSING'; end if; end$$;
create temp table expected(name text primary key, person uuid, identity jsonb) on commit drop;
grant select on profiles to authenticated;
grant select, insert on expected to authenticated;
set local role authenticated;
do $snapshot$
declare p record;
begin
  for p in select * from profiles loop
    perform set_config('request.jwt.claims', p.claims, true);
    insert into expected values (p.name, life_private.person_id(), pg_temp.original_identity());
  end loop;
end $snapshot$;
reset role;
do $$begin
  if exists(select 1 from expected where name in ('manager', 'instructor', 'learner')
    and (person is null or identity is null))
    or exists(select 1 from expected where name in ('aal1', 'anonymous', 'missing_session')
      and (person is not null or identity is not null)) then
    raise exception 'LOCAL_AUTH_FIXTURE_STATE_UNEXPECTED';
  end if;
end$$;
${migration}
set local role authenticated;
do $verify$
declare p record;
declare old_record record;
declare pair integer;
declare old_ms numeric;
declare new_ms numeric;
declare started timestamptz;
declare changed_keys text;
begin
  for p in select * from profiles loop
    perform set_config('request.jwt.claims', p.claims, true);
    select * into old_record from expected where name = p.name;
    if not (old_record.person is not distinct from life_private.person_id()
      and old_record.identity is not distinct from public.life_identity()) then
      select string_agg(k, ',') into changed_keys
      from jsonb_object_keys(coalesce(old_record.identity, '{}'::jsonb)) k
      where old_record.identity->k is distinct from public.life_identity()->k;
      raise exception 'IDENTITY_RESULT_MISMATCH: %, person_equal: %, identity_equal: %, keys: %, old_keys: %, new_keys: %',
        p.name, old_record.person is not distinct from life_private.person_id(),
        old_record.identity is not distinct from public.life_identity(), changed_keys,
        (select string_agg(k, ',') from jsonb_object_keys(old_record.identity) k),
        (select string_agg(k, ',') from jsonb_object_keys(public.life_identity()) k);
    end if;
    raise notice 'PROFILE % equal', p.name;
    if p.name = 'manager' then
      for pair in 1..10 loop
        if pair % 2 = 0 then
          started := clock_timestamp(); perform life_private.identity();
          new_ms := round(extract(epoch from clock_timestamp() - started) * 1000, 2);
          started := clock_timestamp(); perform pg_temp.original_identity();
          old_ms := round(extract(epoch from clock_timestamp() - started) * 1000, 2);
        else
          started := clock_timestamp(); perform pg_temp.original_identity();
          old_ms := round(extract(epoch from clock_timestamp() - started) * 1000, 2);
          started := clock_timestamp(); perform life_private.identity();
          new_ms := round(extract(epoch from clock_timestamp() - started) * 1000, 2);
        end if;
        raise notice 'PAIR % old_ms % new_ms %', pair, old_ms, new_ms;
      end loop;
    end if;
  end loop;
end $verify$;
rollback;`;

const result = spawnSync('docker', [
  'exec', '-i', 'supabase_db_uc-life-core', 'psql', '-U', 'postgres', '-d',
  'postgres', '-v', 'ON_ERROR_STOP=1', '-At',
], { input: sql, encoding: 'utf8', timeout: 90000, maxBuffer: 1024 * 1024 });

if (result.status !== 0) {
  process.stderr.write(result.stderr.replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, '[id]'));
  process.exitCode = 1;
} else {
  assert.match(result.stdout, /ROLLBACK/);
  const profiles = [...result.stderr.matchAll(/PROFILE (\w+) equal/g)].map(match => match[1]);
  assert.deepEqual(profiles.sort(), ['aal1', 'anonymous', 'instructor', 'learner', 'manager', 'missing_session']);
  const pairs = [...result.stderr.matchAll(/PAIR (\d+) old_ms ([\d.]+) new_ms ([\d.]+)/g)]
    .map(match => ({ pair: Number(match[1]), old: Number(match[2]), optimized: Number(match[3]) }));
  assert.equal(pairs.length, 10);
  const median = values => {
    const sorted = values.toSorted((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const warm = pairs.slice(1);
  const oldMs = median(warm.map(pair => pair.old));
  const newMs = median(warm.map(pair => pair.optimized));
  console.log(JSON.stringify({ profiles, pairs, warm_median_ms: {
    old: oldMs, optimized: newMs,
  }, rolled_back: true }));
  assert.ok(newMs < oldMs, 'Optimization must improve the local median');
}
