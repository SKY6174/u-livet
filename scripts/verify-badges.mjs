import { ensureLocalMfa } from "./local-mfa.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const status = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
assert.equal(status.API_URL, "http://127.0.0.1:55321");
const sql = (q) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_uc-life-core",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-qtA",
    ],
    { input: q, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
const client = () =>
  createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ok = (r) => {
  assert.equal(r.error, null, JSON.stringify(r.error));
  return r.data;
};
const denied = (r) => assert(r.error, "must reject");
const hash = (s) => createHash("sha256").update(s).digest("hex");
let checks = 0;
const pass = (s) => {
  checks++;
  console.log("PASS " + s);
};
const ORG = "10000000-0000-4000-8000-000000000001",
  YEAR = "10000000-0000-4000-8000-000000000002",
  PRIVACY = "20000000-0000-4000-8000-000000000011",
  ENROLL = "20000000-0000-4000-8000-000000000012",
  COMPLETE = "20000000-0000-4000-8000-000000000013";
const iso = (n) => new Date(Date.now() + n * 86400000).toISOString(),
  day = (n) =>
    new Date(Date.now() + 9 * 3600000 + n * 86400000)
      .toISOString()
      .slice(0, 10);
async function account(label, role) {
  const email = label + "@example.invalid";
  let u = ok(await service.auth.admin.listUsers({ perPage: 1000 })).users.find(
    (x) => x.email === email,
  );
  if (!u)
    u = ok(
      await service.auth.admin.createUser({
        email,
        password: "Local-Only-2026!",
        email_confirm: true,
        user_metadata: {
          name: "검증 " + label,
          privacy_policy_id: PRIVACY,
          privacy_accepted: true,
        },
      }),
    ).user;
  const c = client();
  ok(await c.auth.signInWithPassword({ email, password: "Local-Only-2026!" }));
  await ensureLocalMfa(c);
  const p = ok(await c.rpc("life_identity")).id;
  if (role)
    sql(
      `insert into public.life_role_assignments(person_id,org_id,role) select '${p}','${ORG}','${role}' where not exists(select 1 from public.life_role_assignments where person_id='${p}' and org_id='${ORG}' and role='${role}');`,
    );
  return { c, p };
}
const manager = await account("operator", "COURSE_MANAGER"),
  issuer = await account("badge-issuer", "CERTIFIER"),
  learner = await account("badge-learner"),
  other = await account("badge-outsider"),
  teacher = await account("instructor", "INSTRUCTOR");
const year = sql(
  `select id from public.life_project_years where org_id='${ORG}' order by starts_on limit 1;`,
);
assert(year);
const f = ok(
  await manager.c.rpc("life_create_offering", {
    o: ORG,
    y: year,
    title: "[테스트] 디지털배지 발급",
    academy: "로컬 배지 검증",
    summary: "가상 배지 검증",
    curriculum: "자료 및 개인정보 없음",
    mode: "ONLINE",
    location: "로컬",
    capacity: 10,
    selection_method: "FIRST_COME",
    apply_from: iso(-1),
    apply_until: iso(1),
    starts_on: day(-10),
    ends_on: day(-2),
  }),
);
ok(
  await manager.c.rpc("life_publish", {
    f,
    enrollment_policy: ENROLL,
    completion_policy: COMPLETE,
  }),
);
ok(await learner.c.rpc("life_apply", { f, policy: ENROLL }));
const policy = randomUUID(),
  sharePolicy = randomUUID(),
  authority = randomUUID();
sql(`insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at) values('${policy}','${ORG}','BADGE','TEST-${policy}','[검증용] 내부 배지 발급','가상 수료 배지 발급 및 보관. 이름·기수·수료사실·발급이력. 보유: 전용 로컬 환경 삭제까지. 선택 신청이며 증명·수료에 영향 없음.','APPROVED','${manager.p}',now()),('${sharePolicy}','${ORG}','BADGE_SHARE','TEST-${sharePolicy}','[검증용] 배지 공유','링크 소지자에게 마스킹 이름·과정·업적·기관·발급/만료일·원본해시·현재상태 공개. 선택사항. 철회 즉시 조회 중단하나 이미 복사한 정보는 회수 불가. 보유: 로컬 환경 삭제까지.','APPROVED','${manager.p}',now());
insert into public.life_issuer_authorizations(id,org_id,organization_name,title,holder_name,valid_from,valid_until,approval_reference,approved_by,approved_at,seal_omission_basis,test_only) values('${authority}','${ORG}','가상 앵커사업단','검증용 단장','가상 발급자',now()-interval '1 day',now()+interval '30 days','LOCAL-BADGE-AUTHORITY','${manager.p}',now(),'로컬 테스트 직인 생략',true);`);
const defArgs = {
  f,
  issuer: authority,
  policy,
  title: "[검증용] 직업역량 과정 이수",
  description: "홈페이지 내부 발급 검증",
  achievement: "승인된 과정 수료 기준 충족",
  days: null,
};
denied(await learner.c.rpc("life_create_badge_definition", defArgs));
denied(await teacher.c.rpc("life_create_badge_definition", defArgs));
denied(
  await manager.c.rpc("life_create_badge_definition", {
    ...defArgs,
    policy: ENROLL,
  }),
);
pass("definitions require course manager and explicit BADGE policy");
const d = ok(await manager.c.rpc("life_create_badge_definition", defArgs));
denied(
  await issuer.c.rpc("life_approve_badge_definition", {
    d,
    reference: "위임 없음",
  }),
);
pass("certificate role alone cannot approve badge definition");
for (const p of [issuer.p, manager.p])
  sql(
    `insert into public.life_issuer_delegations(issuer_id,person_id,kind,valid_from,valid_until,approval_reference) values('${authority}','${p}','BADGE',now()-interval '1 day',now()+interval '20 days','LOCAL-BADGE');`,
  );
sql(
  `insert into public.life_role_assignments(person_id,org_id,role) select '${manager.p}','${ORG}','CERTIFIER' where not exists(select 1 from public.life_role_assignments where person_id='${manager.p}' and org_id='${ORG}' and role='CERTIFIER');`,
);
assert.equal(
  (
    await manager.c.rpc("life_approve_badge_definition", {
      d,
      reference: "자기 승인",
    })
  ).error?.message,
  "SELF_APPROVAL_FORBIDDEN",
);
pass("dual-role definition author cannot approve own definition");
const reqArgs = { d, policy, confirmed: true, supersedes: null, reason: "" };
denied(await learner.c.rpc("life_request_badge", reqArgs));
ok(
  await issuer.c.rpc("life_approve_badge_definition", {
    d,
    reference: "LOCAL-APPROVED",
  }),
);
assert.throws(() =>
  sql(
    `update public.life_badge_definitions set title='overwrite' where id='${d}';`,
  ),
);
pass("definition approval required and approved contents frozen");
denied(await learner.c.rpc("life_request_badge", reqArgs));
pass("enrollment without current approved completion cannot claim badge");
function approveCompletion(p = learner.p) {
  sql(`update public.life_offerings set academic_sealed=true where id='${f}';`);
  const run = sql(
    `insert into public.life_completion_runs(enrollment_id,offering_id,person_id,input_revision,outcome,reasons,evidence,calculated_by) select e.id,e.offering_id,e.person_id,o.academic_revision,'READY','[]','{"policy_id":"${COMPLETE}"}','${manager.p}' from public.life_enrollments e join public.life_offerings o on o.id=e.offering_id where e.offering_id='${f}' and e.person_id='${p}' returning id;`,
  );
  sql(
    `insert into public.life_completion_approvals(run_id,approved_by) values('${run}','${issuer.p}');`,
  );
  return run;
}
approveCompletion();
denied(
  await learner.c.rpc("life_request_badge", { ...reqArgs, confirmed: false }),
);
denied(
  await learner.c.rpc("life_request_badge", { ...reqArgs, policy: ENROLL }),
);
denied(await other.c.rpc("life_request_badge", reqArgs));
pass("claim requires own approved completion and exact acknowledged policy");
let req = ok(await learner.c.rpc("life_request_badge", reqArgs));
assert.equal(ok(await learner.c.rpc("life_request_badge", reqArgs)), req);
denied(
  await other.c.rpc("life_cancel_badge_request", { r: req, reason: "타인" }),
);
ok(
  await learner.c.rpc("life_cancel_badge_request", {
    r: req,
    reason: "검증 신청 철회",
  }),
);
denied(await issuer.c.rpc("life_issue_badge", { r: req, reference: "철회됨" }));
req = ok(await learner.c.rpc("life_request_badge", reqArgs));
pass("duplicate claim is idempotent, owner cancellation allows new claim");
ok(
  await issuer.c.rpc("life_reject_badge_request", {
    r: req,
    reason: "가상 반려 검증",
  }),
);
req = ok(await learner.c.rpc("life_request_badge", reqArgs));
pass("rejected claim retained and owner may reapply");
for (const t of [
  "life_badge_definitions",
  "life_badge_requests",
  "life_badge_awards",
  "life_badge_events",
])
  denied(await manager.c.from(t).select("*"));
denied(await learner.c.schema("life_private").from("badge_shares").select("*"));
denied(await client().rpc("life_badge_wallet"));
denied(await teacher.c.rpc("life_badge_board", { f }));
pass(
  "no direct ledgers, private tokens, anonymous wallet or teacher staff access",
);
const options = ok(await issuer.c.rpc("life_badge_options"));
assert(options.issuers.some((i) => i.id === authority && i.can_issue));
assert(
  ok(await manager.c.rpc("life_badge_board", { f })).requests.some(
    (r) => r.id === req,
  ),
);
pass("authorized staff can inspect configured definition and claim");
sql(
  `insert into public.life_role_assignments(person_id,org_id,role) values('${learner.p}','${ORG}','CERTIFIER');insert into public.life_issuer_delegations(issuer_id,person_id,kind,valid_from,valid_until,approval_reference) values('${authority}','${learner.p}','BADGE',now()-interval '1 day',now()+interval '1 day','LOCAL-SELF-TEST');`,
);
assert.equal(
  (await learner.c.rpc("life_issue_badge", { r: req, reference: "자기 발급" }))
    .error?.message,
  "SELF_APPROVAL_FORBIDDEN",
);
sql(
  `delete from public.life_issuer_delegations where issuer_id='${authority}' and person_id='${learner.p}';delete from public.life_role_assignments where person_id='${learner.p}' and role='CERTIFIER';`,
);
pass("recipient cannot issue own badge even with active delegation");
const issued = await Promise.all([
  issuer.c.rpc("life_issue_badge", { r: req, reference: "LOCAL-ISSUED" }),
  issuer.c.rpc("life_issue_badge", { r: req, reference: "LOCAL-ISSUED" }),
]);
assert.equal(ok(issued[0]), ok(issued[1]));
const award = issued[0].data;
assert.equal(
  sql(
    `select count(*) from public.life_badge_awards where request_id='${req}';`,
  ),
  "1",
);
pass("concurrent approval creates exactly one stored original");
const detail = async (c = learner.c, i = award) =>
  ok(await c.rpc("life_badge_detail", { i }));
let a = await detail();
assert.equal(a.state, "ISSUED");
assert.equal(a.share.enabled, false);
assert.equal(a.artifact.issuer.test_only, true);
assert.equal(a.artifact.format, "U_LIFE_BADGE_V1");
assert(!("@context" in a.artifact));
pass(
  "real internal-format artifact starts private and test issuer remains visibly synthetic",
);
const download = ok(await learner.c.rpc("life_badge_download", { i: award }));
assert.equal(hash(download.body), download.sha256);
assert.equal(hash(download.body), a.sha256);
assert.throws(() =>
  sql(
    `update public.life_badge_awards set artifact_text='{}' where id='${award}';`,
  ),
);
pass("stored JSON and SHA256 match exactly and original cannot be overwritten");
denied(await other.c.rpc("life_badge_detail", { i: award }));
denied(await other.c.rpc("life_badge_download", { i: award }));
denied(await client().rpc("life_badge_download", { i: award }));
pass(
  "other learner and anonymous requester cannot read full subject or artifact",
);
const share = (
  enabled = true,
  revision = 0,
  p = sharePolicy,
  confirmed = true,
  i = award,
) =>
  learner.c.rpc("life_set_badge_share", {
    i,
    enabled,
    policy: p,
    confirmed,
    revision,
  });
denied(await share(true, 0, ENROLL));
denied(await share(true, 0, sharePolicy, false));
denied(
  await other.c.rpc("life_set_badge_share", {
    i: award,
    enabled: true,
    policy: sharePolicy,
    confirmed: true,
    revision: 0,
  }),
);
pass(
  "sharing needs recipient, exact approved sharing policy and separate opt-in",
);
let link = ok(await share());
assert.match(link.token, /^[0-9a-f]{64}$/);
assert.equal(
  sql(
    `select token_hash from life_private.badge_shares where award_id='${award}';`,
  ),
  hash(link.token),
);
assert(!JSON.stringify(await detail()).includes(link.token));
assert(
  !sql(
    `select coalesce(string_agg(reason,''),'') from public.life_badge_events where entity_id='${award}';`,
  ).includes(link.token),
);
pass(
  "only token hash persists and routine reads/audit never expose raw share secret",
);
const verify = async (token) =>
  ok(await client().rpc("life_verify_badge", { token }));
let pub = await verify(link.token);
assert.equal(pub.state, "ISSUED");
assert.equal(pub.sha256, download.sha256);
for (const k of [
  "person_id",
  "email",
  "phone",
  "completion_run",
  "policy_body",
  "recipient_name",
  "reason",
])
  assert(!(k in pub));
assert.notEqual(pub.name, a.artifact.recipient_name);
pass(
  "public verification exposes only masked approved summary and original hash",
);
denied(await share(true, 0));
const firstToken = link.token;
link = ok(await share(true, 1));
assert.equal((await verify(firstToken)).state, "NOT_FOUND");
assert.equal((await verify(link.token)).state, "ISSUED");
pass("optimistic share revision and rotation invalidate previous link");
ok(await share(false, 2, null, false));
assert.equal((await verify(link.token)).state, "NOT_FOUND");
assert.equal((await detail()).share.enabled, false);
link = ok(await share(true, 3));
pass(
  "withdrawal requires no approval and immediately hides public verification",
);
sql(`update public.life_people set active=false where id='${learner.p}';`);
assert.equal((await verify(link.token)).state, "NOT_FOUND");
sql(`update public.life_people set active=true where id='${learner.p}';`);
pass("inactive recipient immediately stops public exposure");
const authUser = sql(
  `select auth_user_id from public.life_auth_links where person_id='${learner.p}';`,
);
sql(
  `update public.life_auth_links set auth_user_id=null where person_id='${learner.p}';`,
);
assert.equal((await verify(link.token)).state, "NOT_FOUND");
sql(
  `update public.life_auth_links set auth_user_id='${authUser}' where person_id='${learner.p}';`,
);
pass(
  "detached authentication identity stops public exposure without erasing issuance history",
);
// Immutable policy fixture expires naturally; production policies are never rewritten.
const expiringShare = randomUUID();
sql(
  `insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at,effective_until) values('${expiringShare}','${ORG}','BADGE_SHARE','TEST-${expiringShare}','가상 단기 공유','가상 만료 검증','APPROVED','${manager.p}',now(),now()+interval '2 seconds');`,
);
link = ok(await share(true, 4, expiringShare));
await new Promise((r) => setTimeout(r, 2100));
assert.equal((await verify(link.token)).state, "NOT_FOUND");
link = ok(await share(true, 5));
pass("expired sharing policy disables existing links");
const newDraft = ok(
  await manager.c.rpc("life_create_badge_definition", {
    ...defArgs,
    title: "[검증용] 직업역량 과정 이수 v2",
  }),
);
assert.equal((await detail()).state, "ISSUED");
denied(await other.c.rpc("life_request_badge", { ...reqArgs, d: newDraft }));
ok(
  await issuer.c.rpc("life_approve_badge_definition", {
    d: newDraft,
    reference: "LOCAL-V2",
  }),
);
pass("new definition versions do not rewrite historical awards");
// A newer unapproved run with unchanged academic revision must supersede eligibility of the old approved run.
const unresolved = sql(
  `insert into public.life_completion_runs(enrollment_id,offering_id,person_id,input_revision,outcome,reasons,evidence,calculated_by) select e.id,e.offering_id,e.person_id,o.academic_revision,'NEEDS_REVIEW','[]','{"policy_id":"${COMPLETE}"}','${manager.p}' from public.life_enrollments e join public.life_offerings o on o.id=e.offering_id where e.offering_id='${f}' and e.person_id='${learner.p}' returning id;`,
);
assert(unresolved);
assert.equal((await detail()).state, "STALE");
assert.equal((await verify(link.token)).state, "STALE");
denied(await learner.c.rpc("life_badge_download", { i: award }));
denied(await share(true, 6));
denied(
  await learner.c.rpc("life_request_badge", {
    ...reqArgs,
    d: newDraft,
    supersedes: award,
    reason: "재검토 중",
  }),
);
pass(
  "latest unresolved completion blocks old badge download, sharing and replacement",
);
approveCompletion();
const correctionArgs = {
  ...reqArgs,
  d: newDraft,
  supersedes: award,
  reason: "새 수료 검토 반영",
};
const replacementReq = ok(
  await learner.c.rpc("life_request_badge", correctionArgs),
);
const replacement = ok(
  await issuer.c.rpc("life_issue_badge", {
    r: replacementReq,
    reference: "LOCAL-CORRECTION",
  }),
);
assert.equal((await detail()).state, "SUPERSEDED");
assert.equal((await verify(link.token)).state, "SUPERSEDED");
let current = await detail(learner.c, replacement);
assert.equal(current.state, "ISSUED");
assert.equal(current.supersedes_id, award);
assert.equal(current.share.enabled, false);
assert.equal(
  sql(`select sha256 from public.life_badge_awards where id='${award}';`),
  download.sha256,
);
pass(
  "replacement atomically supersedes old badge and does not inherit public sharing",
);
denied(
  await learner.c.rpc("life_request_badge", {
    ...correctionArgs,
    supersedes: replacement,
  }),
);
pass("current valid badge cannot be repeatedly replaced");
let replacementLink = ok(await share(true, 0, sharePolicy, true, replacement));
denied(
  await other.c.rpc("life_revoke_badge", {
    i: replacement,
    reason: "타인 취소",
  }),
);
denied(await issuer.c.rpc("life_revoke_badge", { i: replacement, reason: "" }));
ok(
  await issuer.c.rpc("life_revoke_badge", {
    i: replacement,
    reason: "가상 취소 검증",
  }),
);
assert.equal((await verify(replacementLink.token)).state, "REVOKED");
denied(await learner.c.rpc("life_badge_download", { i: replacement }));
pass("delegated revocation requires reason and blocks use of old artifact");
// Definition retirement is explicit and affects every award tied to it.
ok(
  await issuer.c.rpc("life_retire_badge_definition", {
    d: newDraft,
    reason: "가상 정의 철회",
  }),
);
denied(await learner.c.rpc("life_request_badge", correctionArgs));
pass("retired definition cannot issue new badges");
const third = ok(
  await manager.c.rpc("life_create_badge_definition", {
    ...defArgs,
    title: "[검증용] 현재 배지",
    days: 30,
  }),
);
ok(
  await issuer.c.rpc("life_approve_badge_definition", {
    d: third,
    reference: "LOCAL-V3",
  }),
);
const thirdReq = ok(
  await learner.c.rpc("life_request_badge", {
    ...reqArgs,
    d: third,
    supersedes: replacement,
    reason: "취소 정정",
  }),
);
sql(
  `update public.life_issuer_delegations set valid_until=now()-interval '1 second' where issuer_id='${authority}' and person_id='${issuer.p}';`,
);
denied(
  await issuer.c.rpc("life_issue_badge", {
    r: thirdReq,
    reference: "만료 위임",
  }),
);
sql(
  `update public.life_issuer_delegations set valid_until=now()+interval '20 days' where issuer_id='${authority}' and person_id='${issuer.p}';`,
);
pass("expired BADGE delegation prevents new issuance");
const thirdAward = ok(
  await issuer.c.rpc("life_issue_badge", {
    r: thirdReq,
    reference: "LOCAL-V3-ISSUED",
  }),
);
current = await detail(learner.c, thirdAward);
assert(current.expires_at);
assert.equal(current.state, "ISSUED");
const currentLink = ok(await share(true, 0, sharePolicy, true, thirdAward));
sql(
  `update public.life_issuer_delegations set valid_until=now()-interval '1 second' where issuer_id='${authority}' and person_id='${issuer.p}';`,
);
assert.equal((await verify(currentLink.token)).state, "ISSUED");
sql(
  `update public.life_issuer_delegations set valid_until=now()+interval '20 days' where issuer_id='${authority}' and person_id='${issuer.p}';`,
);
pass("delegation ending later does not retroactively revoke a valid award");
// Insert a distinct historical immutable fixture to test expiration without changing a stored original.
const expired = randomUUID(),
  expiredRequest = randomUUID();
sql(
  `insert into public.life_badge_requests(id,offering_id,definition_id,person_id,policy_id,status,reason) values('${expiredRequest}','${f}','${third}','${learner.p}','${policy}','CANCELLED','독립 만료 검증 원장');insert into public.life_badge_awards(id,request_id,definition_id,org_id,person_id,offering_id,issuer_id,number,completion_run_id,evidence_hash,artifact_text,sha256,issued_by,issued_at,expires_at) select '${expired}','${expiredRequest}',definition_id,org_id,person_id,offering_id,issuer_id,'B-${expired}',completion_run_id,evidence_hash,artifact_text,sha256,issued_by,now()-interval '2 days',now()-interval '1 day' from public.life_badge_awards where id='${thirdAward}';insert into life_private.badge_shares(award_id) values('${expired}');`,
);
assert.equal((await detail(learner.c, expired)).state, "EXPIRED");
denied(await learner.c.rpc("life_badge_download", { i: expired }));
pass("expired award cannot be downloaded as current");
sql(
  `insert into life_private.verification_limits values('badge-${hash(currentLink.token)}',now(),30) on conflict(key) do update set hits=30,window_start=now();`,
);
assert.equal((await verify(currentLink.token)).state, "RATE_LIMITED");
sql(`delete from life_private.verification_limits where key like 'badge-%';`);
assert.equal((await verify("bad")).state, "NOT_FOUND");
assert.equal((await verify("f".repeat(64))).state, "NOT_FOUND");
pass("public verification rate limit and indistinguishable unknown tokens");
const foreign = randomUUID();
sql(
  `insert into public.life_organizations(id,slug,name) values('${foreign}','badge-${foreign}','가상 타기관');update public.life_role_assignments set org_id='${foreign}' where person_id='${issuer.p}' and role='CERTIFIER';`,
);
denied(await issuer.c.rpc("life_badge_board", { f }));
denied(await issuer.c.rpc("life_badge_download", { i: thirdAward }));
sql(
  `update public.life_role_assignments set org_id='${ORG}' where person_id='${issuer.p}' and role='CERTIFIER';`,
);
pass("cross-organization role cannot reuse an issuer delegation");
// Leave an additional synthetic learner at a true pending request for browser issuing and sharing.
const browserLearner = await account("badge-browser");
ok(await browserLearner.c.rpc("life_apply", { f, policy: ENROLL }));
approveCompletion(browserLearner.p);
const browserRequest = ok(
  await browserLearner.c.rpc("life_request_badge", { ...reqArgs, d: third }),
);
writeFileSync(
  "/tmp/uc-life-badges-browser.json",
  JSON.stringify({
    offering: f,
    definition: third,
    authority,
    policy,
    sharePolicy,
    request: browserRequest,
    award: thirdAward,
  }),
  { mode: 0o600 },
);
console.log(
  `Badge verification passed: ${checks} checks. Synthetic local records; no external badge service.`,
);
