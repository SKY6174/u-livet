// Synthetic fixtures on the guarded local DB only; checks roll back by default.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createClient } from '@supabase/supabase-js';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync('src/components/portal/instructor-names.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', source)(require, module, module.exports);
const render = (instructors) => renderToStaticMarkup(React.createElement(module.exports.InstructorNames, { instructors }));
const html = render([{ name: 'A', responsible: true }, { name: 'B', responsible: false }, { name: 'C', responsible: false }]);
assert.match(html, /강사 : A<sup[^>]*>\(책임\)<\/sup>, B, C/);
assert.equal((html.match(/<sup/g) ?? []).length, 1);
assert.match(render([]), /배정 안내 예정/);
assert.match(render(null), /정보 확인 중/);
assert.match(render([{ name: '<private>', responsible: false }]), /&lt;private&gt;/);
console.log('PASS superscript, comma format, empty/error states and escaped names');

const status = JSON.parse(execFileSync('supabase', ['status', '--workdir', '/tmp/u-livet-issues-db', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
assert.equal(status.API_URL, 'http://127.0.0.1:56321');
assert.equal(execFileSync('docker', ['inspect', 'supabase_db_uc-life-issues', '--format', '{{ index .Config.Labels "com.supabase.cli.project" }}'], { encoding: 'utf8' }).trim(), 'uc-life-issues');
const sql = (input) => execFileSync('docker', ['exec', '-i', 'supabase_db_uc-life-issues', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qtA'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const fixture = JSON.parse(readFileSync('/tmp/u-livet-issues-browser-fixtures.json', 'utf8'));
const auth = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const session = await auth.auth.signInWithPassword({ email: fixture.learner.email, password: fixture.password });
assert.equal(session.error, null);
const claims = Buffer.from(session.data.session.access_token.split('.')[1], 'base64url').toString('utf8').replaceAll("'", "''");
const people = [fixture.instructor.person, fixture.manager.person, fixture.learner.person];
const f = randomUUID(), guide = `verify-instructor-summary-${randomUUID()}`;
const policies = ['INSTRUCTOR_PRIVACY', 'INSTRUCTOR_REVIEW', 'INSTRUCTOR_PUBLIC'].map((kind) => ({ kind, id: randomUUID() }));
const dossiers = people.map(() => randomUUID());
assert([...people, fixture.learner.user, fixture.ids.org, fixture.ids.offering, fixture.ids.enrollment, f, ...policies.map((p) => p.id), ...dossiers].every((id) => /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)));
assert.match(sql(`select name from life_offerings where id='${fixture.ids.offering}'`), /^\[검증용\]/);
const ids = people.map((p) => `'${p}'`).join(',');
assert.equal(sql(`select count(*) from life_instructor_dossiers where org_id='${fixture.ids.org}' and person_id in (${ids})`), '0');
const originalNames = JSON.parse(sql(`select jsonb_object_agg(id,name) from life_people where id in (${ids})`));
const setup = `
begin;
${people.map((p, i) => `update life_people set name='${String.fromCharCode(65 + i)}' where id='${p}';
insert into life_role_assignments(person_id,org_id,role)
select '${p}','${fixture.ids.org}','INSTRUCTOR'
where not exists(select 1 from life_role_assignments where person_id='${p}' and org_id='${fixture.ids.org}' and role='INSTRUCTOR');`).join('\n')}
${policies.map((p) => `insert into life_policy_versions
select (jsonb_populate_record(null::life_policy_versions,to_jsonb(p)||jsonb_build_object('id','${p.id}','kind','${p.kind}','version','TEST-${p.id}','title','[검증용] 강사 이름 공개'))).*
from life_policy_versions p where p.id='${fixture.ids.enrollment}';`).join('\n')}
insert into life_offerings
select (jsonb_populate_record(null::life_offerings,to_jsonb(o)||jsonb_build_object(
 'id','${f}','name','[검증용] 강사 이름과 책임 표시','status','PUBLISHED',
 'starts_on',(current_date+3)::text,'ends_on',(current_date+30)::text,'academic_sealed',false))).*
from life_offerings o where o.id='${fixture.ids.offering}';
insert into life_course_guides
select (jsonb_populate_record(null::life_course_guides,to_jsonb(g)||jsonb_build_object(
 'id','${guide}','name','[검증용] 강사 이름과 책임 표시','offering_id','${f}',
 'org_id','${fixture.ids.org}','published',true,'source_id',null,'sort_order',999,
 'period_label',(current_date+3)::text||' ~ '||(current_date+30)::text))).*
from life_course_guides g where g.id='2026-obstetric-pilates';
${people.map((p, i) => `insert into life_offering_instructors(offering_id,person_id) values('${f}','${p}');
insert into life_instructor_dossiers(id,org_id,person_id,public_enabled,public_policy_id,public_confirmed_at)
values('${dossiers[i]}','${fixture.ids.org}','${p}',true,'${policies[2].id}',now());
insert into life_instructor_dossier_versions(dossier_id,version,status,payload,privacy_policy_id,privacy_confirmed_at,review_policy_id,submitted_at,decided_by,decided_at,valid_until)
values('${dossiers[i]}',1,'APPROVED','{"specialty":"공개 전문분야","introduction":"PRIVATE-NOT-FOR-LEARNER","public_intro":"공개 소개","claims":[]}'::jsonb,
 '${policies[0].id}',now(),'${policies[1].id}',now(),'${fixture.manager.person}',now(),current_date+30);`).join('\n')}
insert into life_operation_responsibilities(offering_id,person_id,updated_by) values('${f}','${people[0]}','${fixture.manager.person}');
insert into life_applications(offering_id,person_id,status,policy_id) values('${f}','${fixture.learner.person}','ACCEPTED','${fixture.ids.enrollment}');
insert into life_enrollments(offering_id,person_id,application_id,status)
select '${f}','${fixture.learner.person}',id,'ACTIVE' from life_applications where offering_id='${f}';
`;
const checks = [];
const check = (condition, label) => {
  checks.push(label);
  return `do $check$ begin if (${condition}) is not true then raise exception 'FAILED: ${label}'; end if; end $check$;`;
};
const rows = `public.life_course_instructor_names(array['${f}'::uuid])`;
const roster = `(select course->'instructor_roster' from jsonb_array_elements(public.life_my_learning()->'courses') course where course->>'id'='${f}')`;
const cases = `
set local role anon;
${check(`(select jsonb_agg(jsonb_build_object('name',name,'responsible',responsible)) from ${rows})='[{"name":"A","responsible":true},{"name":"B","responsible":false},{"name":"C","responsible":false}]'::jsonb`, 'public names mark the exact responsible assignment first')}
${check(`(select count(*) from public.life_course_instructor_names(null))=0 and (select count(*) from public.life_course_instructor_names('{}'::uuid[]))=0`, 'null and empty targets reveal no names')}
reset role;
savepoint duplicate_name;
update life_people set name='A' where id='${people[1]}';
set local role anon;
${check(`(select count(*) from ${rows} where name='A')=2 and (select count(*) from ${rows} where responsible)=1`, 'duplicate names do not duplicate the responsibility mark')}
reset role;
rollback to duplicate_name;
savepoint responsibility_change;
update life_operation_responsibilities set person_id='${people[1]}' where offering_id='${f}';
set local role anon;
${check(`(select name from ${rows} where responsible)='B'`, 'responsibility changes follow actual person identity')}
reset role;
rollback to responsibility_change;
savepoint consent;
update life_instructor_dossiers set public_enabled=false where id='${dossiers[1]}';
set local role anon;
${check(`(select count(*) from ${rows})=2 and not exists(select 1 from ${rows} where name='B')`, 'public consent withdrawal removes that name')}
reset role;
rollback to consent;
savepoint role_expiry;
update life_role_assignments set valid_until=now()-interval '1 second' where person_id='${people[0]}' and role='INSTRUCTOR';
set local role anon;
${check(`not exists(select 1 from ${rows} where name='A' or responsible)`, 'expired role cannot disclose a public responsible name')}
reset role;
rollback to role_expiry;
savepoint assignment_expiry;
update life_offering_instructors set valid_until=now()-interval '1 second' where offering_id='${f}' and person_id='${people[0]}';
set local role anon;
${check(`not exists(select 1 from ${rows} where name='A' or responsible)`, 'expired assignment cannot disclose a public responsible name')}
reset role;
rollback to assignment_expiry;
savepoint archive;
update life_offerings set status='ARCHIVED',tuition=null,selection_method=null,apply_from=null,apply_until=null where id='${f}';
set local role anon;
${check(`(select count(*) from ${rows})=0`, 'archived offerings do not disclose instructor profiles')}
reset role;
rollback to archive;
savepoint missing_responsibility;
delete from life_operation_responsibilities where offering_id='${f}';
set local role anon;
${check(`(select count(*) from ${rows})=3 and not exists(select 1 from ${rows} where responsible)`, 'missing responsibility is never inferred from the first name')}
reset role;
rollback to missing_responsibility;
select set_config('request.jwt.claims','${claims}',true);
set local role authenticated;
${check(`${roster}='[{"name":"A","responsible":true},{"name":"B","responsible":false},{"name":"C","responsible":false}]'::jsonb and position('PRIVATE-NOT-FOR-LEARNER' in public.life_my_learning()::text)=0`, 'active learners receive only names and exact responsibility flags')}
reset role;
savepoint withdrawal;
update life_enrollments set status='WITHDRAWN' where offering_id='${f}';
set local role authenticated;
${check(`${roster}='[]'::jsonb`, 'withdrawn learners receive no instructor roster')}
reset role;
rollback to withdrawal;
`;
const keep = process.argv.includes('--keep-fixture');
sql(setup + cases + (keep ? 'commit;' : 'rollback;'));
for (const label of checks) console.log('PASS ' + label);
if (keep) writeFileSync('/tmp/u-livet-instructor-summary-fixture.json', JSON.stringify({
  offering: f, guide, dossiers, policies: policies.map((p) => p.id), people, originalNames,
}), { mode: 0o600 });
console.log(`${checks.length + 1} instructor presentation and DB boundary checks passed.`);
