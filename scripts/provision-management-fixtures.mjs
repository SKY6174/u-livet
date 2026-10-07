// Explicitly authorized issue-124 production fixtures. No email is sent.
// Credentials stay in ignored ops/evidence; output contains synthetic identifiers only.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

assert.ok(process.argv.includes("--production"), "Pass --production only after explicit user authorization.");
const project = process.argv[process.argv.indexOf("--project-ref") + 1];
assert.equal(project, "uoebygejgglgiivzgyks", "Only the reviewed u-livet project is allowed.");
const query = text => {
  const output = execFileSync("supabase", ["db", "query", "--linked", "--project-ref", project, "-o", "json", text], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return JSON.parse(output.slice(output.indexOf("{"))).rows;
};
const keys = JSON.parse(execFileSync("supabase", ["projects", "api-keys", "--project-ref", project, "--reveal", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
const url = `https://${project}.supabase.co`;
const client = key => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = client(keys.find(k=>k.name === "service_role").api_key);
const anon = keys.find(k=>k.name === "anon").api_key;
const ok = r => { if (r.error) throw new Error(`${r.error.code ?? "AUTH"}: ${r.error.message}`); return r.data; };
const setup = query(`with manager as (
 select l.auth_user_id from public.life_role_assignments r
 join public.life_auth_links l on l.person_id=r.person_id join public.life_people p on p.id=r.person_id and p.active
 where r.org_id='10000000-0000-4000-8000-000000000001' and r.role='COURSE_MANAGER' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
 and exists(select 1 from public.life_role_assignments s where s.person_id=r.person_id and s.org_id=r.org_id and s.role='SYSTEM_ADMIN' and s.valid_from<=now() and (s.valid_until is null or s.valid_until>now())) limit 1
) select jsonb_build_object('privacy',(select policy_id from life_private.signup_settings where enabled),
 'org','10000000-0000-4000-8000-000000000001','year','10000000-0000-4000-8000-000000000002',
 'manager',(select auth_user_id from manager)) setup`)[0].setup;
for (const id of Object.values(setup)) assert.match(id, /^[0-9a-f-]{36}$/);
// Admin-generated link is verified in memory, with no email or password reset.
// The resulting native Auth session uses the administrator's existing roles.
const operator = ok(await admin.auth.admin.getUserById(setup.manager)).user;
const link = ok(await admin.auth.admin.generateLink({ type: "magiclink", email: operator.email }));
const staff = client(anon);
const verified = ok(await staff.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" }));
assert.equal(verified.user.id, setup.manager);
const me = ok(await staff.rpc("life_identity"));
assert.ok(me?.roles.some(r=>r.role === "COURSE_MANAGER" && r.org_id === setup.org));
assert.ok(me.roles.some(r=>r.role === "SYSTEM_ADMIN" && r.org_id === setup.org));
const jwt = JSON.parse(Buffer.from(verified.session.access_token.split('.')[1], 'base64url').toString());
const claims = JSON.stringify({ sub: jwt.sub, session_id: jwt.session_id, role: "authenticated", aal: jwt.aal });
try {
// Main-organization fixtures remain inside the existing account administrator's
// strict all-affiliations write scope. No cross-organization role is granted.
query(`do $$ declare actor uuid; begin
 perform set_config('request.jwt.claims','${claims}',true);
 actor:=life_private.person_id();
 if not life_private.has_role('${setup.org}','SYSTEM_ADMIN') or not life_private.has_role('${setup.org}','COURSE_MANAGER') then raise exception 'FORBIDDEN'; end if;
 insert into public.life_policy_versions(org_id,kind,version,title,body,status,approved_by,approved_at)
 select '${setup.org}',kind,'issue124-fixture-v1','[검증용] Issue124 '||kind,
  'dummy-00~09 관리 기능 검증 전용입니다. 실제 교육, 수료, 증명서 발급이나 납부를 진행하지 않습니다. 검증 계정은 관리자가 비활성화할 수 있으며 신청 이력은 보존됩니다.',
  'APPROVED',actor,now() from unnest(array['ENROLLMENT','COMPLETION']) as kinds(kind)
 where not exists(select 1 from public.life_policy_versions p where p.org_id='${setup.org}' and p.kind=kinds.kind and p.version='issue124-fixture-v1');
end $$;`);
for (const p of query(`select id,kind from public.life_policy_versions where org_id='${setup.org}' and version='issue124-fixture-v1'`)) setup[p.kind.toLowerCase()] = p.id;
for (const id of Object.values(setup)) assert.match(id, /^[0-9a-f-]{36}$/);
assert.ok(query(`select life_private.policy_valid('${setup.enrollment}','${setup.org}','ENROLLMENT') and life_private.policy_valid('${setup.completion}','${setup.org}','COMPLETION') valid`)[0].valid);
const privatePath = resolve("ops/evidence/issue-124-fixtures.private.json");
mkdirSync(resolve("ops/evidence"), { recursive: true });
const record = existsSync(privatePath) ? JSON.parse(readFileSync(privatePath,"utf8")) : { project, password: `Dummy124-${randomBytes(24).toString("hex")}!`, accounts: [] };
assert.equal(record.project, project);
const save = () => { writeFileSync(privatePath, JSON.stringify(record,null,2)+"\n", { mode: 0o600 }); chmodSync(privatePath,0o600); };
save();
const title = "[검증용] Issue124 신청·수강생 관리";
let offering = query(`select id from public.life_offerings where org_id='${setup.org}' and name='${title}'`)[0]?.id;
if (!offering) {
  const now = Date.now();
  const day = n=>new Date(now+n*86400000).toISOString().slice(0,10);
  offering = ok(await staff.rpc("life_create_offering", { o: setup.org, y: setup.year, title, academy: "검증용",
   summary: "dummy-00~09 관리자 기능 검증. 실제 교육·수료 대상이 아닙니다.",
   curriculum: "관리자 신청 조회·심사·삭제 확인용 합성 데이터입니다. 실제 교육이나 증명서 발급을 진행하지 않습니다.",
   mode: "ONLINE", location: "검증용 온라인 공간", capacity: 10, selection_method: "REVIEW",
   apply_from: new Date(now-86400000).toISOString(), apply_until: new Date(now+7*86400000).toISOString(), starts_on: day(9), ends_on: day(10),
  }));
  ok(await staff.rpc("life_publish", { f: offering, enrollment_policy: setup.enrollment, completion_policy: setup.completion }));
  offering = query(`select id from public.life_offerings where org_id='${setup.org}' and name='${title}'`)[0]?.id;
}
assert.match(offering, /^[0-9a-f-]{36}$/);
record.offering = offering; save();
for (let i=0;i<10;i++) {
  const name = `dummy-${String(i).padStart(2,"0")}`;
  let account = record.accounts.find(a=>a.name === name);
  if (!account) {
    const email = `${name}-issue124@example.invalid`;
    const user = ok(await admin.auth.admin.createUser({ email, password: record.password, email_confirm: true, user_metadata: {
      name, privacy_policy_id: setup.privacy, privacy_accepted: true, mobile_phone: `+8210000012${String(i).padStart(2,"0")}`,
    } })).user;
    account = { name, email, user: user.id }; record.accounts.push(account); save();
  }
  const learner = client(anon);
  ok(await learner.auth.signInWithPassword({ email: account.email, password: record.password }));
  account.person = ok(await learner.rpc("life_identity")).id;
  account.application = ok(await learner.rpc("life_apply", { f: offering, policy: setup.enrollment }));
  assert.equal(ok(await learner.rpc("life_application_detail", { a: account.application })).application.person_id, account.person);
  assert.ok((await learner.rpc("life_management_applications", { f: offering })).error);
  await learner.auth.signOut(); save();
  console.log(`Verified ${name}: actual Auth + life_apply + own detail; manager list denied`);
}
const board = ok(await staff.rpc("life_management_applications", { f: offering }));
assert.equal(board?.count,10);
assert.deepEqual(board.items.map(a=>a.name).sort(),record.accounts.map(a=>a.name).sort());
assert.ok(board.items.every(a=>a.status === "SUBMITTED"));
for (const account of record.accounts) {
 const directory = ok(await staff.rpc("life_member_directory", { p_group: "learner", p_query: "", p_page: 1, p_person: account.person }));
 assert.equal(directory.items[0]?.id, account.person);
 assert.equal(directory.items[0]?.can_manage,true, "Existing administrator can soft-delete each fixture.");
}
const result = { verifiedAt: new Date().toISOString(), project, offering, title, organization: "앵커사업단 (기존 COURSE_MANAGER·SYSTEM_ADMIN 범위)", names: record.accounts.map(a=>a.name), count: board.count, statuses: ["SUBMITTED"], retained: true, cleanupPermissionVerified: true,
  checks: ["10 real Auth users with no mail", "10 life_apply rows", "native authenticated administrator RPC matches all 10", "administrator account deletion scope verified for all 10", "own detail authorized", "learner management API denied"],
  cleanup: "관리자 구성원 관리에서 dummy-00~09 검색 → 각 수강생 삭제. 신청 이력은 보존됩니다. 검증용 과정은 모집 종료로 변경할 수 있습니다.",
};
writeFileSync(resolve("ops/evidence/issue-124-production-result.json"), JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify(result,null,2));

} finally { await staff.auth.signOut({ scope: "local" }); }
