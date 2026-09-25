// Compare production-equivalent authorization against the prior local function.
// All function changes and measurements are rolled back in the local database.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const migration = readFileSync(
  'supabase/migrations/20260925134328_optimize_operation_list_access.sql', 'utf8',
);
const sql = `begin;
do $$begin
  execute replace(pg_get_functiondef('life_private.operation_list()'::regprocedure),
    'CREATE OR REPLACE FUNCTION life_private.operation_list()',
    'CREATE OR REPLACE FUNCTION pg_temp.original_operation_list()');
end$$;
create temp table chosen_profiles(profile text, claims text) on commit drop;
insert into chosen_profiles
select 'manager', jsonb_build_object('sub', u.id, 'aal', 'aal2', 'session_id', s.id)::text
from auth.users u
join public.life_auth_links link on link.auth_user_id = u.id
join public.life_role_assignments role on role.person_id = link.person_id
  and role.role = 'COURSE_MANAGER' and role.valid_from <= now()
  and (role.valid_until is null or role.valid_until > now())
join auth.sessions s on s.user_id = u.id and s.aal = 'aal2'
  and (s.not_after is null or s.not_after > now())
join auth.mfa_factors factor on factor.id = s.factor_id and factor.status = 'verified'
where u.email like '%example.invalid'
order by (select count(*) from public.life_offerings offering where offering.org_id = role.org_id) desc
limit 1;
insert into chosen_profiles
select 'instructor', jsonb_build_object('sub', u.id, 'aal', 'aal2', 'session_id', s.id)::text
from auth.users u
join public.life_auth_links link on link.auth_user_id = u.id
join public.life_role_assignments role on role.person_id = link.person_id
  and role.role = 'INSTRUCTOR' and role.valid_from <= now()
  and (role.valid_until is null or role.valid_until > now())
join public.life_operation_responsibilities responsibility on responsibility.person_id = link.person_id
join public.life_offerings offering on offering.id = responsibility.offering_id and offering.org_id = role.org_id
join public.life_offering_instructors assignment on assignment.offering_id = offering.id
  and assignment.person_id = link.person_id
  and (assignment.valid_until is null or assignment.valid_until > now())
join auth.sessions s on s.user_id = u.id and s.aal = 'aal2'
  and (s.not_after is null or s.not_after > now())
join auth.mfa_factors factor on factor.id = s.factor_id and factor.status = 'verified'
where u.email like '%example.invalid'
  and not exists (select 1 from public.life_role_assignments manager_role
    where manager_role.person_id = link.person_id
      and manager_role.role in ('COURSE_MANAGER', 'SYSTEM_ADMIN')
      and manager_role.valid_from <= now()
      and (manager_role.valid_until is null or manager_role.valid_until > now()))
limit 1;
insert into chosen_profiles
select 'other', jsonb_build_object('sub', u.id, 'aal', 'aal2', 'session_id', s.id)::text
from auth.users u
join public.life_auth_links link on link.auth_user_id = u.id
join auth.sessions s on s.user_id = u.id and s.aal = 'aal2'
  and (s.not_after is null or s.not_after > now())
join auth.mfa_factors factor on factor.id = s.factor_id and factor.status = 'verified'
where u.email like '%example.invalid'
  and not exists (select 1 from public.life_role_assignments role
    where role.person_id = link.person_id
      and role.role in ('COURSE_MANAGER', 'SYSTEM_ADMIN', 'INSTRUCTOR'))
limit 1;
grant select on chosen_profiles to authenticated;
do $$begin if (select count(*) from chosen_profiles) <> 3 then
  raise exception 'LOCAL_FIXTURES_MISSING'; end if; end$$;
${migration}
set local role authenticated;
do $compare$
declare
  profile_row record;
  previous jsonb;
  optimized jsonb;
  started timestamptz;
  old_ms numeric;
  new_ms numeric;
  pair integer;
begin
  for profile_row in select * from chosen_profiles loop
    perform set_config('request.jwt.claims', profile_row.claims, true);
    previous := pg_temp.original_operation_list();
    optimized := public.life_operation_list();
    -- The old ORDER BY has no tie-breaker for equal date/name rows.
    if jsonb_array_length(previous) <> jsonb_array_length(optimized)
      or not (previous @> optimized and optimized @> previous) then
      raise exception 'RESULT_MISMATCH: %', profile_row.profile;
    end if;
    if profile_row.profile = 'instructor' and jsonb_array_length(previous) = 0 then
      raise exception 'INSTRUCTOR_FIXTURE_HAS_NO_COURSE';
    end if;
    if profile_row.profile = 'other' and jsonb_array_length(previous) <> 0 then
      raise exception 'OTHER_FIXTURE_HAS_COURSE';
    end if;
    raise notice 'PROFILE % rows % equal', profile_row.profile,
      jsonb_array_length(previous);
    if profile_row.profile = 'manager' then
      for pair in 1..6 loop
        if pair % 2 = 0 then
          started := clock_timestamp(); perform public.life_operation_list();
          new_ms := round(extract(epoch from clock_timestamp() - started) * 1000, 2);
          started := clock_timestamp(); perform pg_temp.original_operation_list();
          old_ms := round(extract(epoch from clock_timestamp() - started) * 1000, 2);
        else
          started := clock_timestamp(); perform pg_temp.original_operation_list();
          old_ms := round(extract(epoch from clock_timestamp() - started) * 1000, 2);
          started := clock_timestamp(); perform public.life_operation_list();
          new_ms := round(extract(epoch from clock_timestamp() - started) * 1000, 2);
        end if;
        raise notice 'PAIR % old_ms % new_ms %', pair, old_ms, new_ms;
      end loop;
    end if;
  end loop;
end $compare$;
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
  const profiles = [...result.stderr.matchAll(/PROFILE (\w+) rows (\d+) equal/g)]
    .map(([, profile, rows]) => ({ profile, rows: Number(rows) }));
  assert.deepEqual(profiles.map(({ profile }) => profile), ['manager', 'instructor', 'other']);
  const pairs = [...result.stderr.matchAll(/PAIR (\d+) old_ms ([\d.]+) new_ms ([\d.]+)/g)]
    .map(([, index, oldMs, newMs]) => ({ index: Number(index), oldMs: Number(oldMs), newMs: Number(newMs) }));
  assert.equal(pairs.length, 6);
  const median = values => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const warm = pairs.slice(1);
  console.log(JSON.stringify({ profiles, managerPairs: pairs,
    warmMedianOldMs: median(warm.map(pair => pair.oldMs)),
    warmMedianNewMs: median(warm.map(pair => pair.newMs)), rollback: true }));
}
