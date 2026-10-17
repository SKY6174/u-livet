// Named synthetic local stack only. Every database mutation is rolled back.
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
const { COMPLETION_POLICY_WRITING_GUIDE, isOperationalCompletionPolicy } = load("src/lib/portal/recruitment-policy.ts");
const cases = [
  { title: "[검증용] 수료기준", version: "guard-title", body: "출석 80% 이상", operational: false },
  { title: "수료기준", version: "Issue124-guard-version", body: "출석 80% 이상", operational: false },
  { title: "수료기준", version: "guard-body", body: "dummy-09 검증 전용", operational: false },
  { title: "수료기준", version: "guard-content", body: "fixture completion body", operational: false },
  { title: "수료기준", version: "guard-guide", body: "\t\r\n" + COMPLETION_POLICY_WRITING_GUIDE.replaceAll("\n", "\r\n") + "\r\n ", operational: false },
  { title: "수료기준", version: "guard-operating", body: "전체 과정 80% 이상 출석시 수료가능", operational: true },
];
for (const item of cases) assert.equal(isOperationalCompletionPolicy(item), item.operational);
const migration = readFileSync("supabase/migrations/20261017043737_operational_completion_notices.sql", "utf8");
assert(migration.includes(createHash("sha256").update(cases.at(-1).body).digest("hex")));
const repair = migration.match(/do \$repair\$[\s\S]*?\$repair\$;/)[0];
const guard = migration.replace(/^begin;\s*/, "").replace(/commit;\s*$/, "").replace(repair, "");
const quote = value => `'${value.replaceAll("'", "''")}'`;
const target = "912a0200-12dc-4649-bd38-fb7c2ee2b9f5";
const course = "2ce01bf4-caa7-44a9-8c3a-583d6afa868f";
const original = "999d8d43-5f3a-4c81-8825-20f00fc26fd4";
const fixture = "7c282a46-94e7-467d-96c0-ab7d70da09d2";
const operating = "d4a18113-93f3-4f7e-8883-c6f1c22e8fab";
const org = "10000000-0000-4000-8000-000000000001";
const rejected = (setup, error) => `do $test$ begin begin ${setup}\n${repair}
 raise exception 'EXPECTED_REJECTION'; exception when raise_exception then
 if sqlerrm <> '${error}' then raise; end if; end; end $test$;`;
const sql = `begin;
do $$begin if exists(select 1 from public.life_offerings where id='${target}')
 or exists(select 1 from public.life_policy_versions where id in ('${fixture}','${operating}')) then
 raise exception 'EXPECTED_SYNTHETIC_LOCAL_DATABASE';end if;end$$;
${repair}
do $$declare project_year uuid; person uuid;begin
 select id into project_year from public.life_project_years where org_id='${org}' limit 1;
 select p.id into person from public.life_people p join public.life_auth_links a on a.person_id=p.id
 join auth.users u on u.id=a.auth_user_id where u.email like '%@example.invalid' limit 1;
 if project_year is null or person is null then raise exception 'SYNTHETIC_FIXTURES_REQUIRED';end if;
 perform set_config('test.person',person::text,true);
 insert into public.life_courses(id,org_id,title,academy) values('${course}','${org}','Synthetic Pilates','Synthetic');
 insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at)
 values('${fixture}','${org}','COMPLETION','pilates-local-fixture','[검증용] local','Synthetic historical evidence','APPROVED',person,now());
 insert into public.life_policy_versions(id,org_id,kind,version,title,body)
 values('${operating}','${org}','COMPLETION','2026-1','수료기준','전체 과정 80% 이상 출석시 수료가능');
 insert into public.life_course_versions(id,org_id,course_id,summary,curriculum,status,completion_policy_id,approved_by)
 values('${original}','${org}','${course}','Original summary','Original curriculum','APPROVED','${fixture}',person);
 insert into public.life_offerings(id,org_id,project_year_id,course_version_id,name,mode,location,capacity,status,
 apply_from,apply_until,starts_on,ends_on,academic_revision)
 values('${target}','${org}',project_year,'${original}','산과 필라테스 자격증과정','OFFLINE','Local',15,'PUBLISHED',
 now()-interval '2 days',now()-interval '1 day',current_date,current_date+30,3);
 -- A second offering shares the original version; it must not be rewritten.
 insert into public.life_offerings(org_id,project_year_id,course_version_id,name,mode,location,capacity,status,apply_from,apply_until,starts_on,ends_on)
 select org_id,project_year_id,course_version_id,'[검증용] Shared historical course',mode,location,capacity,status,apply_from,apply_until,starts_on,ends_on
 from public.life_offerings where id='${target}';
end$$;
${rejected("", "COMPLETION_APPROVED_POLICY_REQUIRED")}
${rejected(`update public.life_policy_versions set body='Unexpected body',status='APPROVED',approved_by=current_setting('test.person')::uuid,approved_at=now() where id='${operating}';`, "COMPLETION_APPROVED_POLICY_REQUIRED")}
${rejected(`update public.life_policy_versions set effective_from=now()+interval '1 day',status='APPROVED',approved_by=current_setting('test.person')::uuid,approved_at=now() where id='${operating}';`, "COMPLETION_APPROVED_POLICY_REQUIRED")}
update public.life_policy_versions set status='APPROVED',approved_by=current_setting('test.person')::uuid,approved_at=now() where id='${operating}';
${rejected(`update public.life_offerings set name='Different course' where id='${target}';`, "COMPLETION_POLICY_COURSE_MISMATCH")}
${rejected(`update public.life_course_versions set completion_policy_id=null where id='${original}';`, "COMPLETION_POLICY_LINK_CHANGED")}
${rejected(`update public.life_offerings set academic_sealed=true where id='${target}';`, "COMPLETION_POLICY_REVIEW_REQUIRED")}
create temp table before_policies as select * from public.life_policy_versions;
create temp table before_versions as select * from public.life_course_versions;
create temp table before_others as select * from public.life_offerings where id<>'${target}';
create temp table before_applications as select * from public.life_applications;
create temp table before_consents as select * from public.life_consent_events;
create temp table before_rules as select * from public.life_completion_rules;
create temp table before_runs as select * from public.life_completion_runs;
create temp table before_approvals as select * from public.life_completion_approvals;
${repair}
${guard}
${repair}
do $$begin
 if not exists(select 1 from public.life_offerings o join public.life_course_versions v on v.id=o.course_version_id
 where o.id='${target}' and o.academic_revision=4 and not o.academic_sealed and v.id<>'${original}'
 and v.course_id='${course}' and v.version=2 and v.completion_policy_id='${operating}'
 and v.summary='Original summary' and v.curriculum='Original curriculum' and v.status='APPROVED'
 and life_private.completion_attendance_threshold(o.id)=80) then raise exception 'LINK_NOT_CORRECTED';end if;
 if (select count(*) from public.life_audit_events where entity_id='${target}' and action='COMPLETION_POLICY_LINK_CORRECTED')<>1 then raise exception 'AUDIT_NOT_IDEMPOTENT';end if;
 if exists(select * from before_versions except select * from public.life_course_versions)
 or (select count(*) from public.life_course_versions)<>(select count(*)+1 from before_versions) then raise exception 'ORIGINAL_VERSIONS_CHANGED';end if;
end$$;
${["policies", "others", "applications", "consents", "rules", "runs", "approvals"].map(name => {
 const table = { policies: "life_policy_versions", others: "life_offerings where id<>'"+target+"'", applications: "life_applications", consents: "life_consent_events", rules: "life_completion_rules", runs: "life_completion_runs", approvals: "life_completion_approvals" }[name];
 return `do $$begin if exists((select * from public.${table} except select * from before_${name}) union all
 (select * from before_${name} except select * from public.${table})) then raise exception '${name.toUpperCase()}_CHANGED';end if;end$$;`;
}).join("\n")}
-- Exercise both association paths and compare SQL classification with TypeScript.
do $$declare item record; policy uuid; v uuid; original_version uuid; f uuid;begin
 select course_version_id into original_version from public.life_offerings where id='${target}';
 for item in select * from jsonb_to_recordset(${quote(JSON.stringify(cases))}::jsonb)
 as x(title text,version text,body text,operational boolean) loop
  insert into public.life_policy_versions(org_id,kind,title,version,body,status,approved_by,approved_at)
  values('${org}','COMPLETION',item.title,item.version,item.body,'APPROVED',current_setting('test.person')::uuid,now()) returning id into policy;
  insert into public.life_course_versions(org_id,course_id,version,summary,curriculum,completion_policy_id)
  select '${org}','${course}',max(version)+1,'Synthetic summary','Synthetic curriculum',policy
  from public.life_course_versions where course_id='${course}' returning id into v;
  begin
   update public.life_offerings set course_version_id=v where id='${target}';
   if not item.operational then raise exception 'EXPECTED_LINK_REJECTION';end if;
  exception when raise_exception then if item.operational or sqlerrm<>'NON_OPERATIONAL_COMPLETION_POLICY' then raise;end if;end;
  update public.life_offerings set course_version_id=original_version where id='${target}';
  begin
   update public.life_course_versions set completion_policy_id=policy where id=original_version;
   if not item.operational then raise exception 'EXPECTED_VERSION_REJECTION';end if;
  exception when raise_exception then if item.operational or sqlerrm<>'NON_OPERATIONAL_COMPLETION_POLICY' then raise;end if;end;
  update public.life_course_versions set completion_policy_id='${operating}' where id=original_version;
  begin
   insert into public.life_offerings(org_id,project_year_id,course_version_id,name,mode,location,capacity,status,apply_from,apply_until,starts_on,ends_on)
   select org_id,project_year_id,v,'Synthetic actual course',mode,location,capacity,'DRAFT',apply_from,apply_until,starts_on,ends_on
   from public.life_offerings where id='${target}';
   if not item.operational then raise exception 'EXPECTED_INSERT_REJECTION';end if;
  exception when raise_exception then if item.operational or sqlerrm<>'NON_OPERATIONAL_COMPLETION_POLICY' then raise;end if;end;
  if not item.operational then
   perform set_config('test.bad_policy',policy::text,true);
   insert into public.life_offerings(org_id,project_year_id,course_version_id,name,mode,location,capacity,status,apply_from,apply_until,starts_on,ends_on)
   select org_id,project_year_id,v,'[검증용] Explicit course',mode,location,capacity,'DRAFT',apply_from,apply_until,starts_on,ends_on
   from public.life_offerings where id='${target}' returning id into f;
   begin update public.life_offerings set name='Actual course' where id=f;raise exception 'EXPECTED_RENAME_REJECTION';
   exception when raise_exception then if sqlerrm<>'NON_OPERATIONAL_COMPLETION_POLICY' then raise;end if;end;
   update public.life_course_versions set completion_policy_id=policy where id=v;
  end if;
 end loop;
 if has_function_privilege('anon','life_private.guard_operational_completion_policy()','EXECUTE')
 or has_function_privilege('authenticated','life_private.guard_operational_completion_policy()','EXECUTE')
 or has_function_privilege('service_role','life_private.guard_operational_completion_policy()','EXECUTE') then raise exception 'TRIGGER_EXPOSED';end if;
end$$;
-- Use the real MFA publication path, not a mocked database function.
do $$declare actor record; manager uuid; f uuid; v uuid; enrollment uuid;begin
 for actor in select a.auth_user_id,a.person_id,s.id session_id from public.life_auth_links a
 join auth.users u on u.id=a.auth_user_id join auth.sessions s on s.user_id=u.id
 where u.email like '%@example.invalid' order by s.created_at desc loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.auth_user_id,'role','authenticated','aal','aal1','session_id',actor.session_id)::text,true);
  if life_private.mfa_verified() then manager:=actor.person_id;exit;end if;
 end loop;
 if manager is null then raise exception 'NO_SYNTHETIC_MFA_MANAGER';end if;
 insert into public.life_role_assignments(person_id,org_id,role) values(manager,'${org}','COURSE_MANAGER');
 insert into public.life_policy_versions(org_id,kind,version,title,body,status,approved_by,approved_at)
 values('${org}','ENROLLMENT','completion-guard-enrollment','모집 안내','신청 자격과 모집 기간을 확인해 주세요.','APPROVED',manager,now()) returning id into enrollment;
 insert into public.life_course_versions(org_id,course_id,version,summary,curriculum)
 select '${org}','${course}',max(version)+1,'Synthetic summary','Synthetic curriculum'
 from public.life_course_versions where course_id='${course}' returning id into v;
 insert into public.life_offerings(org_id,project_year_id,course_version_id,name,mode,location,capacity,status,apply_from,apply_until,starts_on,ends_on)
 select org_id,project_year_id,v,'Synthetic publication course',mode,location,capacity,'DRAFT',apply_from,apply_until,starts_on,ends_on
 from public.life_offerings where id='${target}' returning id into f;
 perform set_config('test.publish',f::text,true);perform set_config('test.enrollment',enrollment::text,true);
end$$;
set local role authenticated;
do $$declare f uuid:=current_setting('test.publish')::uuid;begin
 begin perform public.life_publish(f,current_setting('test.enrollment')::uuid,current_setting('test.bad_policy')::uuid);raise exception 'EXPECTED_RPC_REJECTION';
 exception when raise_exception then if sqlerrm<>'NON_OPERATIONAL_COMPLETION_POLICY' then raise;end if;end;
 if not exists(select 1 from public.life_offerings o join public.life_course_versions v on v.id=o.course_version_id
 where o.id=f and o.status='DRAFT' and o.enrollment_policy_id is null and v.completion_policy_id is null) then raise exception 'PARTIAL_PUBLICATION';end if;
 perform public.life_publish(f,current_setting('test.enrollment')::uuid,'${operating}');
 if not exists(select 1 from public.life_offerings where id=f and status='PUBLISHED') then raise exception 'OPERATING_PUBLICATION_FAILED';end if;
end$$;
reset role;
rollback;`;
try {
  execFileSync("docker", ["exec", "-i", "supabase_db_uc-life-issues", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
} catch (error) { console.error(error.stderr?.toString()); throw error; }
console.log("PASS absent Preview, approval/body/link/state guards, copied version/retry/audit/80% threshold, shared version and historical evidence preserved; ROLLBACK");
console.log("PASS UI/SQL classification; offering insert/update/rename, course-version update, explicit synthetic exemption, MFA publication RPC and private trigger privileges");
const { publishOffering } = load("src/app/actions.ts", {
  "@/lib/auth/mfa-message": { MFA_REAUTH_MESSAGE: "MFA" }, "next/cache": { revalidatePath() {} },
  "@/lib/supabase/server": { createServerSupabaseClient: async () => ({ rpc: async () => ({ error: { message: "NON_OPERATIONAL_COMPLETION_POLICY" } }) }) },
  "@/lib/auth/session": { getSessionIdentity: async () => ({}) }, "@/lib/portal/data": { UUID: /^[0-9a-f-]{36}$/i },
  "@/lib/course-opening/working-copy": {}, "@/lib/course-guide/locations": {},
});
const form = new FormData();
for (const name of ["offering", "enrollment_policy", "completion_policy"]) form.set(name, target);
const result = await publishOffering({}, form);
assert(!result.ok && result.message.includes("수료 안내") && result.message.includes("실제 운영 안내를 새 버전으로 작성·승인"));
console.log("PASS publication action displays the completion correction message");
