// Synthetic local database only; every mutation is rolled back.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}
const helper = load("src/lib/portal/recruitment-policy.ts");
const cases = [
  { title: "[검증용] 환불 규정", version: "guard-title", body: "취소 접수 후 규정에 따라 검토합니다.", operational: false },
  { title: "환불 규정", version: "Issue124-guard-version", body: "취소 접수 후 규정에 따라 검토합니다.", operational: false },
  { title: "환불 규정", version: "guard-body", body: "dummy-09 검증용", operational: false },
  { title: "환불 규정", version: "guard-content", body: "fixture refund body", operational: false },
  { title: "환불 규정", version: "guard-local", body: "로컬 검증 전용", operational: false },
  { title: "[테스트] 환불 규정", version: "guard-test", body: "실제 기관 규정이 아닙니다.", operational: false },
  { title: "환불 규정", version: "guard-guide", body: "\t\r\n" + helper.REFUND_POLICY_WRITING_GUIDE.replaceAll("\n", "\r\n") + "\r\n ", operational: false },
  { title: "환불 규정", version: "guard-operating", body: "과정 시작 전 취소는 승인된 조항에 따라 검토합니다.", operational: true },
];
for (const item of cases) assert.equal(helper.isOperationalRefundPolicy(item), item.operational);
const { RefundNotice } = load("src/components/portal/refund-notice.tsx", {
  "@/lib/portal/recruitment-policy": helper,
  "next/link": ({ href, children, ...props }) => createElement("a", { href, ...props }, children),
});
const render = (tuition, finance = null) => renderToStaticMarkup(createElement(RefundNotice, { tuition, finance }));
assert(render(0).includes("수강료가 무료이므로 환불할 수강료가 없습니다"));
assert(render(0).includes("자격시험 응시료·자격증 발급비"));
assert(render(0).includes('href="/mypage"') && render(0).includes('href="/terms#help-title"'));
assert(render(null).includes("수강료 정보가 등록되지 않았습니다"));
assert(!render(null).includes("수강료가 무료"));
for (const item of cases) {
  const html = render(10000, { ...item, valid: true });
  assert.equal(html.includes(item.body), item.operational);
  assert.equal(html.includes("승인된 수강료 환불 규정을 확인 중"), !item.operational);
}
assert(!render(10000, { ...cases.at(-1), valid: false }).includes(cases.at(-1).body));
assert(render(10000).includes("승인된 수강료 환불 규정을 확인 중"));
console.log("PASS free/unknown/approved/expired/fixture/writing-guide notice states, separate qualification costs and cancellation/contact links");

const migration = readFileSync("supabase/migrations/20261017045228_operational_refund_notices.sql", "utf8").replace(/^begin;\s*/, "").replace(/commit;\s*$/, "");
const quote = value => `'${value.replaceAll("'", "''")}'`;
const org = "10000000-0000-4000-8000-000000000001";
const ledgers = ["life_invoices", "life_payments", "life_payment_allocations", "life_refunds", "life_refund_allocations", "life_refund_transfers", "life_credit_notes", "life_finance_events"];
const sql = `begin;
${migration}
${ledgers.map(t => `create temp table before_${t} as select * from public.${t};`).join("\n")}
create temp table before_policies as select * from public.life_policy_versions;
create temp table before_rules as select * from public.life_refund_rules;
create temp table guard_cases(policy_id uuid, operational boolean);
do $$declare actor record; manager uuid; course uuid; v uuid; year uuid; f uuid; item record; policy uuid;begin
 for actor in select a.auth_user_id,a.person_id,s.id session_id from public.life_auth_links a
 join auth.users u on u.id=a.auth_user_id join auth.sessions s on s.user_id=u.id
 where u.email like '%@example.invalid' order by s.created_at desc loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.auth_user_id,'role','authenticated','aal','aal1','session_id',actor.session_id)::text,true);
  if life_private.mfa_verified() then manager:=actor.person_id;exit;end if;
 end loop;
 if manager is null then raise exception 'NO_SYNTHETIC_MFA_MANAGER';end if;
 insert into public.life_role_assignments(person_id,org_id,role) values(manager,'${org}','COURSE_MANAGER') on conflict do nothing;
 select id into year from public.life_project_years where org_id='${org}' limit 1;
 insert into public.life_courses(org_id,title,academy) values('${org}','Refund notice guard course','Local') returning id into course;
 insert into public.life_course_versions(org_id,course_id,summary,curriculum) values('${org}',course,'Local summary','Local curriculum') returning id into v;
 insert into public.life_offerings(org_id,project_year_id,course_version_id,name,mode,location,capacity,status,apply_from,apply_until,starts_on,ends_on)
 values('${org}',year,v,'Refund notice guard course','OFFLINE','Local',10,'DRAFT',now()-interval '1 day',now()+interval '1 day',current_date+2,current_date+30) returning id into f;
 perform set_config('test.refund_offering',f::text,true);perform set_config('test.refund_manager',manager::text,true);
 for item in select * from jsonb_to_recordset(${quote(JSON.stringify(cases))}::jsonb)
 as x(title text,version text,body text,operational boolean) loop
  insert into public.life_policy_versions(org_id,kind,title,version,body,status,approved_by,approved_at)
  values('${org}','REFUND',item.title,item.version,item.body,'APPROVED',manager,now()) returning id into policy;
  insert into public.life_refund_rules(policy_id,label,basis,numerator,denominator) values(policy,'Local approved clause','TUITION',1,1);
  insert into guard_cases values(policy,item.operational);
  if item.operational then perform set_config('test.operating_refund',policy::text,true);
  else perform set_config('test.bad_refund',policy::text,true);end if;
 end loop;
end$$;
grant select on guard_cases to authenticated;
set local role authenticated;
do $$declare item record; f uuid:=current_setting('test.refund_offering')::uuid; rev bigint; fee bigint;begin
 for item in select * from guard_cases loop
  select academic_revision,tuition into rev,fee from public.life_offerings where id=f;
  begin
   perform public.life_configure_course_finance(f,rev,10000,item.policy_id,72,'Local payment instructions');
   if not item.operational then raise exception 'EXPECTED_RPC_REJECTION';end if;
  exception when raise_exception then if item.operational or sqlerrm<>'NON_OPERATIONAL_REFUND_POLICY' then raise;end if;end;
  if not item.operational and (exists(select 1 from public.life_offerings where id=f and academic_revision<>rev)
    or exists(select 1 from public.life_offerings where id=f and tuition<>fee)) then raise exception 'PARTIAL_FINANCE_CHANGE';end if;
 end loop;
end$$;
reset role;
-- Normal policy is configured by the successful RPC; direct updates/inserts and
-- a fixture-to-real rename must be covered by the same SQL classification.
do $$declare item record; f uuid:=current_setting('test.refund_offering')::uuid; synthetic uuid;begin
 for item in select * from guard_cases where not operational loop
  begin update public.life_offering_finance set policy_id=item.policy_id where offering_id=f;raise exception 'EXPECTED_UPDATE_REJECTION';
  exception when raise_exception then if sqlerrm<>'NON_OPERATIONAL_REFUND_POLICY' then raise;end if;end;
  insert into public.life_offerings(org_id,project_year_id,course_version_id,name,mode,location,capacity,status,apply_from,apply_until,starts_on,ends_on)
  select org_id,project_year_id,course_version_id,'[검증용] Explicit refund course',mode,location,capacity,'DRAFT',apply_from,apply_until,starts_on,ends_on
  from public.life_offerings where id=f returning id into synthetic;
  insert into public.life_offering_finance(offering_id,org_id,policy_id,reservation_hours,instructions,configured_by)
  values(synthetic,'${org}',item.policy_id,72,'Local instructions',current_setting('test.refund_manager')::uuid);
  begin update public.life_offerings set name='Actual refund course' where id=synthetic;raise exception 'EXPECTED_RENAME_REJECTION';
  exception when raise_exception then if sqlerrm<>'NON_OPERATIONAL_REFUND_POLICY' then raise;end if;end;
 end loop;
 if not exists(select 1 from public.life_offering_finance where offering_id=f and policy_id=current_setting('test.operating_refund')::uuid)
 then raise exception 'VALID_FINANCE_MISSING';end if;
 if has_function_privilege('anon','life_private.guard_operational_refund_policy()','EXECUTE')
 or has_function_privilege('authenticated','life_private.guard_operational_refund_policy()','EXECUTE')
 or has_function_privilege('service_role','life_private.guard_operational_refund_policy()','EXECUTE') then raise exception 'TRIGGER_EXPOSED';end if;
end$$;
${ledgers.map(t => `do $$begin if exists((select * from public.${t} except select * from before_${t}) union all
(select * from before_${t} except select * from public.${t})) then raise exception '${t}_CHANGED';end if;end$$;`).join("\n")}
do $$begin if exists(select * from before_policies except select * from public.life_policy_versions)
 or exists(select * from before_rules except select * from public.life_refund_rules) then raise exception 'EXISTING_POLICY_CHANGED';end if;end$$;
rollback;`;
try {
  execFileSync("docker", ["exec", "-i", "supabase_db_uc-life-issues", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
} catch (error) { console.error(error.stderr?.toString()); throw error; }
console.log("PASS TS/SQL policy classification; real MFA finance RPC atomic rejection/success, policy update/explicit synthetic/rename guards, immutable historical policies and financial ledgers, private privileges; ROLLBACK");
const { configureFinance } = load("src/app/finance-actions.ts", {
  "@/lib/auth/mfa-message": { MFA_REAUTH_MESSAGE: "MFA" }, "next/cache": { revalidatePath() {} },
  "@/lib/supabase/server": { createServerSupabaseClient: async () => ({ rpc: async () => ({ error: { message: "NON_OPERATIONAL_REFUND_POLICY" } }) }) },
  "@/lib/auth/session": { getSessionIdentity: async () => ({}) }, "@/lib/portal/data": { UUID: /^[0-9a-f-]{36}$/i },
});
const form = new FormData();
for (const k of ["f", "policy"]) form.set(k,"10000000-0000-4000-8000-000000000001");
for (const [k,v] of Object.entries({tuition:"10000",hours:"72",expected_revision:"1",instructions:"Local instructions"})) form.set(k,v);
const result = await configureFinance({},form);
assert(!result.ok && result.message.includes("실제 운영 규정과 계산 조항을 새 버전으로 작성·승인"));
console.log("PASS finance action displays the refund policy correction message");
