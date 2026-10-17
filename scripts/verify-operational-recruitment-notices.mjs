// Runs against the named synthetic local stack; all mutations are rolled back.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
 const module = { exports: {} };
 const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
 new Function("require", "module", "exports", code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports);
 return module.exports;
}
const { ENROLLMENT_POLICY_WRITING_GUIDE, isOperationalRecruitmentPolicy } = load("src/lib/portal/recruitment-policy.ts");
const cases = [
 { title: "[검증용] 모집 안내", version: "guard-title", body: "Synthetic enrollment body", operational: false },
 { title: "모집 안내", version: "Issue178-guard-version", body: "Synthetic enrollment body", operational: false },
 { title: "모집 안내", version: "guard-body", body: "dummy-09 관리 기능 확인", operational: false },
 { title: "모집 안내", version: "guard-content", body: "fixture enrollment body", operational: false },
 { title: "모집 안내", version: "guard-guide", body: "\t\r\n" + ENROLLMENT_POLICY_WRITING_GUIDE.replaceAll("\n", "\r\n") + "\r\n ", operational: false },
 { title: "운영 모집 안내", version: "guard-operating", body: "접수기간과 정원을 확인하고 신청해 주세요. 수집·이용 목적과 항목을 확인해 주세요.", operational: true },
];
for (const item of cases) assert.equal(isOperationalRecruitmentPolicy(item), item.operational);


const body = readFileSync("docs/operations/silver-food-enrollment-2026-10-17.txt", "utf8").trim();
const hash = createHash("sha256").update(body).digest("hex");
const migration = readFileSync("supabase/migrations/20261017041154_operational_recruitment_notices.sql", "utf8");
assert(migration.includes(hash), "migration must pin the reviewed policy text");
const repair = migration.match(/do \$repair\$[\s\S]*?\$repair\$;/)[0];
const guard = migration.replace(/^begin;\s*/, "").replace(/commit;\s*$/, "").replace(repair, "");
const quote = value => `'${value.replaceAll("'", "''")}'`;
const target = "be13635d-2625-4f81-ab2d-7f30551289d3";
const fixture = "de334781-f135-4cdc-a85a-f109d4cc0f3f";
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
 insert into public.life_courses(org_id,title,academy) values('${org}','Synthetic Silver food','Synthetic') returning id into course;
 insert into public.life_course_versions(org_id,course_id,summary,curriculum)
 values('${org}',course,'Synthetic summary','Synthetic curriculum') returning id into course_version;
 perform set_config('test.person',person::text,true);
 insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at)
 values('${fixture}','${org}','ENROLLMENT','silver-local-placeholder','[검증용] local','Synthetic historical evidence','APPROVED',person,now());
 insert into public.life_policy_versions(org_id,kind,version,title,body)
 values('${org}','ENROLLMENT','SILVER-FOOD-2026-10-17-v1','실버푸드전문가과정 모집·개인정보 안내',${quote(body.replaceAll("\n", "\r\n"))});
 insert into public.life_offerings(id,org_id,project_year_id,course_version_id,name,mode,location,capacity,status,
 apply_from,apply_until,starts_on,ends_on,enrollment_policy_id,academic_revision)
 values('${target}','${org}',project_year,course_version,'실버푸드전문가과정','OFFLINE','Local',15,'PUBLISHED',
 now()-interval '2 days',now()-interval '1 day',current_date,current_date+30,'${fixture}',2);
 insert into public.life_applications(offering_id,person_id,status,policy_id) values('${target}',person,'SUBMITTED','${fixture}');
 insert into public.life_consent_events(person_id,policy_id,accepted,source) values(person,'${fixture}',true,'APPLICATION');
end$$;
${rejected("", "RECRUITMENT_APPROVED_POLICY_REQUIRED")}
${rejected("update public.life_policy_versions set body='Unexpected content',status='APPROVED',approved_by=current_setting('test.person')::uuid,approved_at=now() where version='SILVER-FOOD-2026-10-17-v1';", "RECRUITMENT_APPROVED_POLICY_REQUIRED")}
${rejected("update public.life_policy_versions set effective_from=now()+interval '1 day',status='APPROVED',approved_by=current_setting('test.person')::uuid,approved_at=now() where version='SILVER-FOOD-2026-10-17-v1';", "RECRUITMENT_APPROVED_POLICY_REQUIRED")}
update public.life_policy_versions set status='APPROVED',approved_by=current_setting('test.person')::uuid,approved_at=now()
where org_id='${org}' and kind='ENROLLMENT' and version='SILVER-FOOD-2026-10-17-v1';
${rejected(`update public.life_offerings set name='Different course' where id='${target}';`, "RECRUITMENT_POLICY_COURSE_MISMATCH")}
${rejected(`update public.life_offerings set enrollment_policy_id=null where id='${target}';`, "RECRUITMENT_POLICY_LINK_CHANGED")}
${guard}
${rejected(`update public.life_offerings set status='CLOSED' where id='${target}';`, "NON_OPERATIONAL_ENROLLMENT_POLICY")}
create temp table before_applications as select * from public.life_applications;
create temp table before_consents as select * from public.life_consent_events;
create temp table before_policies as select * from public.life_policy_versions;
create temp table before_others as select * from public.life_offerings where id<>'${target}';
${repair}
${repair}
do $$begin
 if not exists(select 1 from public.life_offerings o join public.life_policy_versions p on p.id=o.enrollment_policy_id
 where o.id='${target}' and p.version='SILVER-FOOD-2026-10-17-v1' and o.academic_revision=3) then raise exception 'LINK_NOT_CORRECTED';end if;
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

-- Compare frontend classification with actual INSERT, UPDATE and rename behavior.
do $$declare item record; policy uuid; fixture_offering uuid; original_policy uuid;begin
 select enrollment_policy_id into original_policy from public.life_offerings where id='${target}';
 perform set_config('test.operating_policy',original_policy::text,true);
 for item in select * from jsonb_to_recordset(${quote(JSON.stringify(cases))}::jsonb)
 as x(title text,version text,body text,operational boolean) loop
  insert into public.life_policy_versions(org_id,kind,title,version,body,status,approved_by,approved_at)
  values('${org}','ENROLLMENT',item.title,item.version,item.body,'APPROVED',current_setting('test.person')::uuid,now()) returning id into policy;
  begin
   update public.life_offerings set enrollment_policy_id=policy where id='${target}';
   if not item.operational then raise exception 'EXPECTED_UPDATE_REJECTION';end if;
  exception when raise_exception then if item.operational or sqlerrm<>'NON_OPERATIONAL_ENROLLMENT_POLICY' then raise;end if;end;
  update public.life_offerings set enrollment_policy_id=original_policy where id='${target}';
  begin
   insert into public.life_offerings(org_id,project_year_id,course_version_id,name,mode,location,capacity,status,apply_from,apply_until,starts_on,ends_on,enrollment_policy_id)
   select org_id,project_year_id,course_version_id,'Synthetic actual course','OFFLINE','Local',10,'DRAFT',apply_from,apply_until,starts_on,ends_on,policy
   from public.life_offerings where id='${target}';
   if not item.operational then raise exception 'EXPECTED_INSERT_REJECTION';end if;
  exception when raise_exception then if item.operational or sqlerrm<>'NON_OPERATIONAL_ENROLLMENT_POLICY' then raise;end if;end;
  if not item.operational then
   perform set_config('test.bad_policy',policy::text,true);
   insert into public.life_offerings(org_id,project_year_id,course_version_id,name,mode,location,capacity,status,apply_from,apply_until,starts_on,ends_on,enrollment_policy_id)
   select org_id,project_year_id,course_version_id,'[검증용] Explicit synthetic course','OFFLINE','Local',10,'DRAFT',apply_from,apply_until,starts_on,ends_on,policy
   from public.life_offerings where id='${target}' returning id into fixture_offering;
   begin update public.life_offerings set name='Actual course' where id=fixture_offering;raise exception 'EXPECTED_RENAME_REJECTION';
   exception when raise_exception then if sqlerrm<>'NON_OPERATIONAL_ENROLLMENT_POLICY' then raise;end if;end;
  end if;
 end loop;
 if has_function_privilege('anon','life_private.guard_operational_enrollment_policy()','EXECUTE')
 or has_function_privilege('authenticated','life_private.guard_operational_enrollment_policy()','EXECUTE')
 or has_function_privilege('service_role','life_private.guard_operational_enrollment_policy()','EXECUTE') then raise exception 'TRIGGER_EXPOSED';end if;
end$$;
-- The real publication RPC must roll back a rejected policy and accept normal text.
do $$declare actor record; manager uuid; f uuid; completion uuid;begin
 for actor in select a.auth_user_id,a.person_id,s.id session_id from public.life_auth_links a
 join auth.users u on u.id=a.auth_user_id join auth.sessions s on s.user_id=u.id
 where u.email like '%@example.invalid' order by s.created_at desc loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.auth_user_id,'role','authenticated','aal','aal1','session_id',actor.session_id)::text,true);
  if life_private.mfa_verified() then manager:=actor.person_id;exit;end if;
 end loop;
 if manager is null then raise exception 'NO_SYNTHETIC_MFA_MANAGER';end if;
 insert into public.life_role_assignments(person_id,org_id,role) values(manager,'${org}','COURSE_MANAGER');
 insert into public.life_policy_versions(org_id,kind,version,title,body,status,approved_by,approved_at)
 values('${org}','COMPLETION','operating-guard-completion','Synthetic completion','Synthetic completion requirements','APPROVED',manager,now()) returning id into completion;
 insert into public.life_offerings(org_id,project_year_id,course_version_id,name,mode,location,capacity,status,apply_from,apply_until,starts_on,ends_on)
 select org_id,project_year_id,course_version_id,'Synthetic publication course','OFFLINE','Local',10,'DRAFT',apply_from,apply_until,starts_on,ends_on
 from public.life_offerings where id='${target}' returning id into f;
 perform set_config('test.publish',f::text,true);perform set_config('test.completion',completion::text,true);
end$$;
set local role authenticated;
do $$declare f uuid:=current_setting('test.publish')::uuid;begin
 begin perform public.life_publish(f,current_setting('test.bad_policy')::uuid,current_setting('test.completion')::uuid);raise exception 'EXPECTED_RPC_REJECTION';
 exception when raise_exception then if sqlerrm<>'NON_OPERATIONAL_ENROLLMENT_POLICY' then raise;end if;end;
 if not exists(select 1 from public.life_offerings where id=f and status='DRAFT' and enrollment_policy_id is null) then raise exception 'PARTIAL_PUBLICATION';end if;
 perform public.life_publish(f,current_setting('test.operating_policy')::uuid,current_setting('test.completion')::uuid);
 if not exists(select 1 from public.life_offerings where id=f and status='PUBLISHED') then raise exception 'OPERATING_PUBLICATION_FAILED';end if;
end$$;
reset role;
rollback;`;
execFileSync("docker", ["exec", "-i", "supabase_db_uc-life-issues", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
console.log("PASS correction/retry/evidence; UI/DB policy classification, insert/update/rename/status guards, synthetic exemption, real publication RPC and privileges; ROLLBACK");

const { publishOffering } = load("src/app/actions.ts", {
 "@/lib/auth/mfa-message": { MFA_REAUTH_MESSAGE: "MFA" }, "next/cache": { revalidatePath() {} },
 "@/lib/supabase/server": { createServerSupabaseClient: async () => ({ rpc: async () => ({ error: { message: "NON_OPERATIONAL_ENROLLMENT_POLICY" } }) }) },
 "@/lib/auth/session": { getSessionIdentity: async () => ({}) }, "@/lib/portal/data": { UUID: /^[0-9a-f-]{36}$/i },
 "@/lib/course-opening/working-copy": {}, "@/lib/course-guide/locations": {},
});
const form = new FormData();
for (const name of ["offering", "enrollment_policy", "completion_policy"]) form.set(name, target);
const result = await publishOffering({}, form);
assert(!result.ok && result.message.includes("실제 운영 안내를 새 버전으로 작성·승인"));
console.log("PASS publication action displays a concrete correction message");
