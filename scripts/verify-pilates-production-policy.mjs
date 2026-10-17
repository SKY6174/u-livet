// Runs against the named synthetic local stack; all mutations are rolled back.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const body = readFileSync("docs/operations/pilates-enrollment-2026-10-17.txt", "utf8").trim();
const hash = createHash("sha256").update(body).digest("hex");
const migration = readFileSync("supabase/migrations/20261017035918_pilates_production_enrollment_policy.sql", "utf8");
assert(migration.includes(hash), "migration must pin the reviewed policy text");
const repair = migration.replace(/^begin;\s*/, "").replace(/commit;\s*$/, "");
const quote = value => `'${value.replaceAll("'", "''")}'`;
const target = "912a0200-12dc-4649-bd38-fb7c2ee2b9f5";
const fixture = "3f26415b-2099-469d-b25b-3116c674e341";
const org = "10000000-0000-4000-8000-000000000001";
// Exception blocks keep each negative test and its setup in one savepoint.
const rejected = (setup, error) => `do $test$ begin begin ${setup}\n${repair}
 raise exception 'EXPECTED_REJECTION'; exception when raise_exception then
 if sqlerrm <> '${error}' then raise; end if; end; end $test$;`;
const sql = `begin;
do $$begin if exists(select 1 from public.life_offerings where id='${target}')
 or exists(select 1 from public.life_policy_versions where id='${fixture}') then
 raise exception 'EXPECTED_SYNTHETIC_LOCAL_DATABASE'; end if; end$$;
${repair}
do $$declare course uuid; course_version uuid; project_year uuid; person uuid;begin
 select id into project_year from public.life_project_years where org_id='${org}' limit 1;
 select p.id into person from public.life_people p join public.life_auth_links a on a.person_id=p.id
 join auth.users u on u.id=a.auth_user_id where u.email like '%@example.invalid' limit 1;
 if project_year is null or person is null then raise exception 'SYNTHETIC_FIXTURES_REQUIRED';end if;
 insert into public.life_courses(org_id,title,academy) values('${org}','Synthetic Pilates','Synthetic') returning id into course;
 insert into public.life_course_versions(org_id,course_id,summary,curriculum)
 values('${org}',course,'Synthetic summary','Synthetic curriculum') returning id into course_version;
 perform set_config('test.person',person::text,true);
 insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at)
 values('${fixture}','${org}','ENROLLMENT','pilates-local-fixture','[검증용] local','Synthetic historical evidence','APPROVED',person,now());
 insert into public.life_policy_versions(org_id,kind,version,title,body)
 values('${org}','ENROLLMENT','PILATES-2026-10-17-v1','산과 필라테스 자격증과정 모집·개인정보 안내',${quote(body.replaceAll("\n", "\r\n"))});
 insert into public.life_offerings(id,org_id,project_year_id,course_version_id,name,mode,location,capacity,status,
 apply_from,apply_until,starts_on,ends_on,enrollment_policy_id,academic_revision)
 values('${target}','${org}',project_year,course_version,'산과 필라테스 자격증과정','OFFLINE','Local',15,'PUBLISHED',
 now()-interval '2 days',now()-interval '1 day',current_date,current_date+30,'${fixture}',2);
 insert into public.life_applications(offering_id,person_id,status,policy_id) values('${target}',person,'SUBMITTED','${fixture}');
 insert into public.life_consent_events(person_id,policy_id,accepted,source) values(person,'${fixture}',true,'APPLICATION');
end$$;
${rejected("", "PILATES_APPROVED_POLICY_REQUIRED")}
${rejected("update public.life_policy_versions set body='Unexpected content',status='APPROVED',approved_by=current_setting('test.person')::uuid,approved_at=now() where version='PILATES-2026-10-17-v1';", "PILATES_APPROVED_POLICY_REQUIRED")}
${rejected("update public.life_policy_versions set effective_from=now()+interval '1 day',status='APPROVED',approved_by=current_setting('test.person')::uuid,approved_at=now() where version='PILATES-2026-10-17-v1';", "PILATES_APPROVED_POLICY_REQUIRED")}
update public.life_policy_versions set status='APPROVED',approved_by=current_setting('test.person')::uuid,approved_at=now()
where org_id='${org}' and kind='ENROLLMENT' and version='PILATES-2026-10-17-v1';
${rejected(`update public.life_offerings set name='Different course' where id='${target}';`, "PILATES_POLICY_COURSE_MISMATCH")}
${rejected(`update public.life_offerings set enrollment_policy_id=null where id='${target}';`, "PILATES_POLICY_LINK_CHANGED")}
create temp table before_applications as select * from public.life_applications;
create temp table before_consents as select * from public.life_consent_events;
create temp table before_policies as select * from public.life_policy_versions;
create temp table before_others as select * from public.life_offerings where id<>'${target}';
${repair}
${repair}
do $$begin
 if not exists(select 1 from public.life_offerings o join public.life_policy_versions p on p.id=o.enrollment_policy_id
 where o.id='${target}' and p.version='PILATES-2026-10-17-v1' and o.academic_revision=3) then raise exception 'LINK_NOT_CORRECTED';end if;
 if (select count(*) from public.life_audit_events where entity_id='${target}' and action='POLICY_LINK_CORRECTED')<>1 then raise exception 'AUDIT_NOT_IDEMPOTENT';end if;
 if exists((select * from public.life_applications except select * from before_applications) union all
 (select * from before_applications except select * from public.life_applications)) then raise exception 'APPLICATIONS_CHANGED';end if;
 if exists((select * from public.life_consent_events except select * from before_consents) union all
 (select * from before_consents except select * from public.life_consent_events)) then raise exception 'CONSENTS_CHANGED';end if;
 if exists((select * from public.life_policy_versions except select * from before_policies) union all
 (select * from before_policies except select * from public.life_policy_versions)) then raise exception 'POLICIES_CHANGED';end if;
 if exists((select * from public.life_offerings where id<>'${target}' except select * from before_others) union all
 (select * from before_others except select * from public.life_offerings where id<>'${target}')) then raise exception 'OTHER_COURSES_CHANGED';end if;
end$$;
rollback;`;
execFileSync("docker", ["exec", "-i", "supabase_db_uc-life-issues", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
console.log("PASS absent Preview, approved/body/link/course guards, exact correction, retry, revision/audit and unchanged historical evidence; ROLLBACK");
