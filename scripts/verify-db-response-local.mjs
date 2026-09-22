// Local synthetic RLS benchmark. All fixtures live in one rolled-back transaction.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

assert.equal(process.argv.length, 2, 'No alternate target is accepted');
const local = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}));
assert.equal(local.API_URL, 'http://127.0.0.1:55321');
assert.equal(new URL(local.DB_URL).hostname, '127.0.0.1');
const user = randomUUID(), session = randomUUID(), student = randomUUID();
const courses = Array.from({ length: 4 }, randomUUID);
const list = courses.map(id => `'${id}'`).join(',');

// Create our own auth identity/session; existing accounts and MFA are untouched.
// Test password is unusable and no JWT is signed or sent over the network.
let sql = `begin; set local statement_timeout='15s';
do $$ declare teacher uuid; policy uuid; begin
  select id into policy from life_policy_versions
    where life_private.policy_valid(id,org_id,'ACCOUNT_PRIVACY') limit 1;
  if policy is null then raise exception 'Approved local privacy fixture required'; end if;
  insert into auth.users(id,email,role,aud,encrypted_password,email_confirmed_at,invited_at,
    created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
  values('${user}','db-perf-${user}@example.invalid','authenticated','authenticated','local-test-only',
    now(),now(),now(),now(),'{"provider":"email","providers":["email"]}',
    jsonb_build_object('name','LOCAL DB PERF','privacy_policy_id',policy,'privacy_accepted',true));
  select person_id into teacher from life_auth_links where auth_user_id='${user}';
  insert into auth.sessions(id,user_id,created_at,updated_at,aal)
    values('${session}','${user}',clock_timestamp(),clock_timestamp(),'aal1');
  insert into life_people(id,name) values('${student}','LOCAL STUDENT');
  ${courses.map((id, i) => `insert into life_offerings select (jsonb_populate_record(null::life_offerings,
    to_jsonb(o)||jsonb_build_object('id','${id}','name','LOCAL DB PERF ${i}',
    'academic_revision',1,'academic_sealed',false))).*
    from life_offerings o where id not in (${list}) and status<>'ARCHIVED' limit 1;`).join('\n')}
  if (select count(*) from life_offerings where id in (${list}))<>4
    then raise exception 'Non-archived local course fixture required'; end if;
  insert into life_role_assignments(person_id,org_id,role)
    select distinct teacher,org_id,'INSTRUCTOR' from life_offerings where id in(${list});
  insert into life_offering_instructors(offering_id,person_id) select id,teacher
    from life_offerings where id in(${courses.slice(0,3).map(id => `'${id}'`).join(',')});
  insert into life_assignments(offering_id,title,instructions,due_at,published)
    select o.id,'LOCAL assignment '||g,'LOCAL instructions',now()+interval '1 month',true
    from life_offerings o cross join generate_series(1,10) g where o.id in(${list});
  insert into life_submissions(assignment_id,person_id,body)
    select id,'${student}',repeat('LOCAL SYNTHETIC ',300) from life_assignments where offering_id in(${list});
  insert into life_submission_grades(submission_id,submission_revision,score,feedback,grader_id)
    select s.id,s.revision,80,repeat('LOCAL feedback ',50),teacher
    from life_submissions s join life_assignments a on a.id=s.assignment_id where a.offering_id in(${list});
  perform set_config('request.jwt.claims',jsonb_build_object('sub','${user}','role','authenticated',
    'aal','aal1','session_id','${session}')::text,true);
end $$;
set local role authenticated;
do $$ begin
  if (select count(*) from life_submissions)<>30 then raise exception 'Expected 30 RLS-visible submissions'; end if;
  if exists(select 1 from life_assignments where offering_id='${courses[3]}')
    then raise exception 'Unassigned course became visible'; end if;
end $$;
`;

for (const table of ['life_submissions', 'life_submission_grades']) {
  const before = table === 'life_submissions'
    ? 'select s.* from life_submissions s' : 'select g.* from life_submission_grades g';
  const after = table === 'life_submissions'
    ? `select s.*,jsonb_build_object('offering_id',a.offering_id) as life_assignments
       from life_submissions s join life_assignments a on a.id=s.assignment_id where a.offering_id='${courses[0]}'`
    : `select g.*,jsonb_build_object('life_assignments',jsonb_build_object('offering_id',a.offering_id)) as life_submissions
       from life_submission_grades g join life_submissions s on s.id=g.submission_id
       join life_assignments a on a.id=s.assignment_id where a.offering_id='${courses[0]}'`;
  for (let i = 0; i < 5; i++) for (const mode of i % 2 ? ['before', 'after'] : ['after', 'before']) {
    const query = `select jsonb_agg(to_jsonb(t)) from (${mode === 'before' ? before : after}) t`;
    sql += `do $test$ declare plan jsonb; body jsonb; begin
      execute $query$explain(analyze,buffers,format json) ${query}$query$ into plan;
      execute $query$${query}$query$ into body;
      if jsonb_array_length(body)<>${mode === 'before' ? 30 : 10} then raise exception 'Scoped row count mismatch'; end if;
      raise notice 'METRIC:%',jsonb_build_object('table','${table}','mode','${mode}','iteration',${i},
        'ms',plan->0->'Execution Time','planning_ms',plan->0->'Planning Time',
        'rows',jsonb_array_length(body),'bytes',octet_length(body::text));
    end $test$;\n`;
  }
}
sql += `rollback;
select count(*) from auth.users where id='${user}';
select count(*) from life_offerings where id in (${list});`;
const result = spawnSync('docker', ['exec', '-i', 'supabase_db_uc-life-core', 'psql',
  '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt'], {
  input: sql, encoding: 'utf8', timeout: 180000,
});
assert.equal(result.status, 0, result.stderr);
assert.deepEqual(result.stdout.trim().split('\n'), ['0', '0'], 'Fixture rollback must be complete');
const samples = result.stderr.split('\n').filter(line => line.includes('METRIC:'))
  .map(line => JSON.parse(line.slice(line.indexOf('METRIC:') + 7)));
assert.equal(samples.length, 20);
const median = rows => { const times = rows.map(x => x.ms).sort((a,b) => a-b); return (times[1] + times[2]) / 2; };
const report = { environment: 'local-synthetic-authenticated-rls-sql', samplesPerMode: 5,
  excludedWarmupPairs: 1, rollbackVerified: true, unassignedCourseHidden: true,
  results: ['life_submissions', 'life_submission_grades'].map(table => {
    const subset = samples.filter(s => s.table === table && s.iteration > 0);
    const before = subset.filter(s => s.mode === 'before'), after = subset.filter(s => s.mode === 'after');
    return { table, beforeMedianMs: median(before), afterMedianMs: median(after),
      beforeRows: before[0].rows, afterRows: after[0].rows,
      beforeBytes: before[0].bytes, afterBytes: after[0].bytes };
  }), samples };
console.log(JSON.stringify(report, null, 2));
