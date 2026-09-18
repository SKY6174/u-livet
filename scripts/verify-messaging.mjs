import { ensureLocalMfa } from "./local-mfa.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
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
const denied = (r) => assert(r.error, "Operation must be denied");
let count = 0;
const pass = (s) => {
  count++;
  console.log("PASS " + s);
};
const ORG = "10000000-0000-4000-8000-000000000001",
  YEAR = "10000000-0000-4000-8000-000000000002";
const PRIVACY = "20000000-0000-4000-8000-000000000011",
  ENROLL = "20000000-0000-4000-8000-000000000012",
  COMPLETE = "20000000-0000-4000-8000-000000000013";
async function account(label, role) {
  const email = label + "@example.invalid";
  let user = ok(
    await service.auth.admin.listUsers({ perPage: 1000 }),
  ).users.find((u) => u.email === email);
  if (!user)
    user = ok(
      await service.auth.admin.createUser({
        email,
        password: "Local-Only-2026!",
        email_confirm: true,
        user_metadata: {
          name: "테스트 " + label,
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
  return { c, p, user };
}
const manager = await account("operator", "COURSE_MANAGER"),
  learner = await account("message-learner"),
  stranger = await account("message-outsider"),
  noPhone = await account("message-unverified");
const iso = (ms) => new Date(Date.now() + ms).toISOString();
const offering = ok(
  await manager.c.rpc("life_create_offering", {
    o: ORG,
    y: YEAR,
    title: "[테스트] 안내문자 예약 검증",
    academy: "로컬 검증",
    summary: "가상 대상·선택동의 검증",
    curriculum: "실제 발송 없음",
    mode: "ONLINE",
    location: "로컬",
    capacity: 20,
    selection_method: "FIRST_COME",
    apply_from: iso(-86400000),
    apply_until: iso(86400000),
    starts_on: iso(86400000).slice(0, 10),
    ends_on: iso(864000000).slice(0, 10),
  }),
);
ok(
  await manager.c.rpc("life_publish", {
    f: offering,
    enrollment_policy: ENROLL,
    completion_policy: COMPLETE,
  }),
);
for (const a of [learner, stranger, noPhone])
  ok(await a.c.rpc("life_apply", { f: offering, policy: ENROLL }));
const unregistered = randomUUID(),
  policy = randomUUID(),
  expiredPolicy = randomUUID(),
  other = randomUUID(),
  otherTemplate = randomUUID(),
  ops = randomUUID(),
  marketing = randomUUID(),
  completed = randomUUID(),
  pending = randomUUID();
sql(`insert into public.life_organizations(id,slug,name) values('${other}','test-message-${other}','테스트 다른 기관');
insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at) values('${policy}','${ORG}','MARKETING','TEST-${policy}','[테스트] SMS 홍보 선택동의','로컬 가상 검증 전용. 목적: 가상 홍보 수신 여부 검증. 항목: 가상 연락처 참조. 보유: 로컬 환경 삭제까지. 거부해도 학습 이용에 제한 없음. 실제 광고·문자 전송 없음.','APPROVED','${manager.p}',now());
insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at,effective_from,effective_until) values('${expiredPolicy}','${ORG}','MARKETING','TEST-${expiredPolicy}','만료 테스트','가상','APPROVED','${manager.p}',now(),now()-interval '2 days',now()-interval '1 day');
insert into public.life_message_settings(org_id,mode) values('${ORG}','DISABLED') on conflict(org_id) do update set mode='DISABLED';`);
sql(`insert into public.life_message_marketing_policies(policy_id,org_id,approval_reference) values('${policy}','${ORG}','TEST-SMS'),('${expiredPolicy}','${ORG}','TEST-SMS');
insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at) values('${unregistered}','${ORG}','MARKETING','TEST-${unregistered}','다른 채널용 테스트 동의','가상','APPROVED','${manager.p}',now());`);
function template(id, kind, audience, org = ORG) {
  sql(
    `insert into public.life_message_templates(id,org_id,kind,audience,title,version,body,approved_by,approved_at,approval_reference) values('${id}','${org}','${kind}','${audience}','[테스트] ${kind === "MARKETING" ? "홍보 안내" : "운영 안내"} ${audience}','TEST-${id}','[로컬 테스트] {{course}} 과정 안내입니다. 실제 발송되지 않습니다.','${manager.p}',now(),'LOCAL-ONLY');`,
  );
}
template(ops, "OPERATIONS", "ACTIVE");
template(marketing, "MARKETING", "ACTIVE");
template(otherTemplate, "OPERATIONS", "ACTIVE", other);
template(completed, "OPERATIONS", "COMPLETED");
template(pending, "OPERATIONS", "PENDING_PAYMENT");
function contact(p, valid = true) {
  sql(
    `update life_private.message_contacts set disabled_at=now() where org_id='${ORG}' and person_id='${p}' and disabled_at is null;`,
  );
  return sql(
    `insert into life_private.message_contacts(org_id,person_id,recipient_ref,masked_label,verified_until,verification_reference,privacy_reference) values('${ORG}','${p}','test-opaque-${randomUUID()}','010-****-1234',now()${valid ? "+" : "-"}interval '1 day','LOCAL-FAKE-VERIFICATION','LOCAL-SYNTHETIC-PRIVACY') returning id;`,
  );
}
let lc = contact(learner.p);
contact(stranger.p);
const preferences = () => learner.c.rpc("life_notification_preferences");
const consent = (accepted, policyId = policy) =>
  learner.c.rpc("life_set_marketing", { o: ORG, policy: policyId, accepted });
const preview = (t = ops, args = {}) =>
  manager.c.rpc("life_message_preview", {
    f: offering,
    t,
    scheduled: iso(3600000),
    request_key: randomUUID(),
    ...args,
  });
const view = async (j) =>
  ok(await manager.c.rpc("life_message_overview", { j }))[0];
const queue = async (j) => ok(await manager.c.rpc("life_message_queue", { j }));
const due = (j) =>
  sql(
    `update public.life_message_jobs set scheduled_at=now()-interval '1 second' where id='${j}';`,
  );
const claim = async (j) =>
  ok(await service.rpc("life_message_test_claim", { j }));
const finish = async (x) =>
  ok(
    await service.rpc("life_message_test_finish", { d: x.id, token: x.token }),
  );
const enable = () =>
  sql(
    `update public.life_message_settings set mode='TEST' where org_id='${ORG}';`,
  );
for (const table of [
  "life_message_marketing_policies",
  "life_message_templates",
  "life_message_jobs",
  "life_message_deliveries",
  "life_message_preferences",
  "life_message_consent_events",
  "life_message_events",
  "life_message_settings",
])
  denied(await learner.c.from(table).select("*"));
pass("all messaging tables reject direct browser reads");
denied(
  await learner.c
    .from("life_message_preferences")
    .insert({
      org_id: ORG,
      person_id: learner.p,
      accepted: true,
      policy_id: policy,
    }),
);
denied(
  await learner.c
    .from("life_message_jobs")
    .update({ status: "FINISHED" })
    .eq("offering_id", offering),
);
pass("direct consent and outcome forgery denied");
denied(await client().rpc("life_notification_preferences"));
denied(await client().rpc("life_message_options"));
pass("anonymous preferences and operations denied");
denied(
  await learner.c.rpc("life_message_preview", {
    f: offering,
    t: ops,
    scheduled: iso(3600000),
    request_key: randomUUID(),
  }),
);
assert.equal(ok(await learner.c.rpc("life_message_overview")).length, 0);
pass("learner cannot preview or enumerate staff jobs");
denied(await preview(otherTemplate));
pass("cross-organization template denied");
denied(await consent(true, expiredPolicy));
denied(await consent(true, ENROLL));
denied(await consent(true, null));
pass("expired, unrelated, and absent marketing policies denied");
denied(await consent(true, unregistered));
assert(
  !ok(await preferences())
    .find((s) => s.id === ORG)
    .policies.some((p) => p.id === unregistered),
);
assert(ok(await preferences()).every(s => s.id === ORG));
pass("non-SMS marketing policy cannot authorize SMS; unrelated organizations omitted");
ok(await consent(false, null));
assert.equal(ok(await preferences()).find((s) => s.id === ORG).accepted, false);
pass("withdrawal works without a current policy");
let job = ok(await preview(marketing));
assert.equal((await view(job)).counts.ELIGIBLE, undefined);
assert.equal((await view(job)).exclusions.NO_MARKETING_CONSENT, 2);
denied(await manager.c.rpc("life_message_queue", { j: job }));
pass("marketing without consent excluded and empty queue denied");
job = ok(await preview());
assert.equal((await view(job)).counts.ELIGIBLE, 2);
assert.equal((await view(job)).exclusions.NO_VERIFIED_CONTACT, 1);
pass(
  "operations independent of optional marketing and unverified contact excluded",
);
assert(!JSON.stringify(await view(job)).includes("test-opaque"));
assert(!JSON.stringify(ok(await preferences())).includes("recipient_ref"));
pass("read responses omit provider recipient references");
await queue(job);
await queue(job);
assert.equal((await view(job)).status, "BLOCKED_CONFIG");
denied(await service.rpc("life_message_test_claim", { j: job }));
pass("unconfigured provider blocks dispatch and queue replay is idempotent");
ok(await manager.c.rpc("life_message_cancel", { j: job }));
ok(await manager.c.rpc("life_message_cancel", { j: job }));
assert.equal((await view(job)).status, "CANCELLED");
denied(await manager.c.rpc("life_message_queue", { j: job }));
pass("cancellation idempotent and cancelled job cannot be requeued");
const key = randomUUID(),
  scheduled = iso(3600000);
const same = () => preview(ops, { request_key: key, scheduled });
const pair = await Promise.all([same(), same()]);
assert.equal(ok(pair[0]), ok(pair[1]));
denied(await preview(marketing, { request_key: key, scheduled }));
pass("concurrent duplicate preview coalesces and changed payload conflicts");
job = ok(await same());
sql(
  `update public.life_message_jobs set expires_at=now()-interval '1 second' where id='${job}';`,
);
denied(await manager.c.rpc("life_message_queue", { j: job }));
pass("expired preview cannot queue");
denied(await preview(ops, { scheduled: iso(-60000) }));
denied(await preview(ops, { scheduled: iso(31 * 86400000) }));
pass("past and over-30-day schedules rejected");
job = ok(await preview());
denied(await stranger.c.rpc("life_message_overview", { j: job }));
denied(await stranger.c.rpc("life_message_queue", { j: job }));
denied(await stranger.c.rpc("life_message_cancel", { j: job }));
pass("job detail and mutations enforce staff ownership scope");
denied(await manager.c.rpc("life_message_test_claim", { j: job }));
denied(
  await learner.c.rpc("life_message_test_finish", {
    d: randomUUID(),
    token: randomUUID(),
  }),
);
pass("test worker inaccessible to normal staff and learners");
assert.equal(
  (await view(ok(await preview(completed)))).counts.ELIGIBLE,
  undefined,
);
assert.equal(
  (await view(ok(await preview(pending)))).counts.ELIGIBLE,
  undefined,
);
pass("completion and payment audiences require real matching evidence");
ok(await consent(true));
assert.equal(ok(await preferences()).find((s) => s.id === ORG).effective, true);
assert.equal(
  ok(await stranger.c.rpc("life_notification_preferences")).find(
    (s) => s.id === ORG,
  ).accepted,
  false,
);
pass(
  "consent changes only the authenticated person and retains policy history",
);
enable();
job = ok(await preview(marketing));
assert.equal((await view(job)).counts.ELIGIBLE, 1);
await queue(job);
ok(await consent(false, null));
assert.equal((await view(job)).counts.SKIPPED, 3);
due(job);
assert.deepEqual(await claim(job), []);
assert.equal((await view(job)).exclusions.CONSENT_WITHDRAWN, 1);
pass("scheduled marketing immediately excluded on withdrawal");
ok(await consent(true));
job = ok(await preview(marketing));
await queue(job);
assert.deepEqual(await claim(job), []);
pass("worker cannot claim before schedule");
due(job);
const item = (await claim(job))[0];
assert(item);
assert.deepEqual(await claim(job), []);
pass("concurrent retry cannot claim a leased delivery twice");
ok(await consent(false, null));
await finish(item);
assert.equal((await view(job)).counts.TEST_PROCESSED, undefined);
pass("withdrawal during processing rechecked before recording test outcome");
ok(await consent(true));
job = ok(await preview(marketing));
lc = contact(learner.p);
denied(await manager.c.rpc("life_message_queue", { j: job }));
pass("contact change after preview cannot silently retarget recipient");
job = ok(await preview(marketing));
await queue(job);
ok(await learner.c.rpc("life_disconnect_contact", { o: ORG }));
assert.equal((await view(job)).exclusions.CONTACT_DISCONNECTED, 1);
assert.equal(ok(await preferences()).find((s) => s.id === ORG).contact, null);
assert(
  ok(await stranger.c.rpc("life_notification_preferences")).find(
    (s) => s.id === ORG,
  ).contact,
);
pass(
  "disconnect cancels own pending targets and preserves another learner contact",
);
contact(learner.p, false);
job = ok(await preview(marketing));
assert.equal((await view(job)).counts.ELIGIBLE, undefined);
pass("expired contact excluded");
lc = contact(learner.p);
job = ok(await preview(marketing));
await queue(job);
sql(`update public.life_people set active=false where id='${learner.p}';`);
due(job);
assert.deepEqual(await claim(job), []);
assert.equal((await view(job)).exclusions.ACCOUNT_INACTIVE, 1);
sql(`update public.life_people set active=true where id='${learner.p}';`);
pass("deactivated learner excluded at processing time");
job = ok(await preview(marketing));
await queue(job);
sql(
  `update public.life_auth_links set auth_user_id=null where person_id='${learner.p}';`,
);
due(job);
assert.deepEqual(await claim(job), []);
sql(
  `update public.life_auth_links set auth_user_id='${learner.user.id}' where person_id='${learner.p}';`,
);
pass("deleted authentication link excluded despite retained learning records");
job = ok(await preview(marketing));
await queue(job);
sql(
  `update public.life_message_templates set enabled=false where id='${marketing}';`,
);
due(job);
assert.deepEqual(await claim(job), []);
assert.equal((await view(job)).exclusions.TEMPLATE_DISABLED, 1);
sql(
  `update public.life_message_templates set enabled=true where id='${marketing}';`,
);
pass("withdrawn template excluded at processing time");
assert.throws(() =>
  sql(
    `update public.life_message_templates set body='unapproved' where id='${marketing}';`,
  ),
);
assert.throws(() =>
  sql(
    `update life_private.message_contacts set recipient_ref='changed' where id='${lc}';`,
  ),
);
pass("approved body and contact version cannot be rewritten");
job = ok(await preview(marketing));
await queue(job);
sql(
  `update public.life_role_assignments set valid_until=now()-interval '1 second',valid_from=now()-interval '1 day' where person_id='${manager.p}' and org_id='${ORG}' and role='COURSE_MANAGER';`,
);
due(job);
assert.deepEqual(await claim(job), []);
sql(
  `update public.life_role_assignments set valid_until=null where person_id='${manager.p}' and org_id='${ORG}' and role='COURSE_MANAGER';`,
);
assert.equal((await view(job)).exclusions.CREATOR_REVOKED, 1);
pass("creator role revocation stops pending dispatch");
job = ok(await preview(marketing));
await queue(job);
due(job);
const unknown = (await claim(job))[0];
sql(
  `update public.life_message_deliveries set lease_until=now()-interval '1 second' where id='${unknown.id}';`,
);
denied(
  await service.rpc("life_message_test_finish", {
    d: unknown.id,
    token: unknown.token,
  }),
);
assert.deepEqual(await claim(job), []);
assert.equal((await view(job)).counts.UNKNOWN, 1);
denied(await manager.c.rpc("life_message_cancel", { j: job }));
pass(
  "expired lease becomes unknown with no automatic duplicate retry or cancellation",
);
job = ok(await preview(marketing));
await queue(job);
due(job);
const successful = (await claim(job))[0];
denied(
  await service.rpc("life_message_test_finish", {
    d: successful.id,
    token: randomUUID(),
  }),
);
await finish(successful);
const events = (await view(job)).events.length;
await finish(successful);
assert.equal((await view(job)).events.length, events);
assert.equal((await view(job)).counts.TEST_PROCESSED, 1);
assert.equal((await view(job)).status, "FINISHED");
pass(
  "correct lease finishes once and labels test outcome distinct from delivery",
);
job = ok(await preview(marketing));
await queue(job);
sql(
  `update public.life_message_preferences set policy_id='${expiredPolicy}' where org_id='${ORG}' and person_id='${learner.p}';`,
);
due(job);
assert.deepEqual(await claim(job), []);
assert.equal((await view(job)).exclusions.NO_MARKETING_CONSENT, 2);
ok(await consent(true));
pass("policy validity rechecked after reservation");
job = ok(await preview(marketing));
await queue(job);
sql(
  `update public.life_applications set status='CANCELLED' where offering_id='${offering}' and person_id='${learner.p}';update public.life_enrollments set status='WITHDRAWN' where offering_id='${offering}' and person_id='${learner.p}';`,
);
due(job);
assert.deepEqual(await claim(job), []);
assert.equal((await view(job)).exclusions.OUTSIDE_AUDIENCE, 1);
sql(
  `update public.life_applications set status='ACCEPTED' where offering_id='${offering}' and person_id='${learner.p}';update public.life_enrollments set status='ACTIVE' where offering_id='${offering}' and person_id='${learner.p}';`,
);
pass("withdrawn enrollment rechecked before processing");
job = ok(await preview(marketing));
await queue(job);
due(job);
const race = await Promise.all([
  service.rpc("life_message_test_claim", { j: job }),
  service.rpc("life_message_test_claim", { j: job }),
]);
assert.equal(ok(race[0]).length + ok(race[1]).length, 1);
await finish([...race[0].data, ...race[1].data][0]);
pass("parallel workers claim only one delivery");
job = ok(await preview(marketing));
await queue(job);
ok(await manager.c.rpc("life_message_cancel", { j: job }));
due(job);
assert.deepEqual(await claim(job), []);
pass("cancelled reservation never reaches worker");
assert.throws(() =>
  sql(
    `update public.life_message_settings set mode='LIVE' where org_id='${ORG}';`,
  ),
);
pass("live sending cannot be enabled by changing configuration");
// Leave fresh, readable synthetic data for browser review. No actual contacts or SMS.
sql(
  `update public.life_message_settings set mode='DISABLED' where org_id='${ORG}';`,
);
const browserJob = ok(await preview(marketing));
writeFileSync(
  "/tmp/uc-life-messaging-browser.json",
  JSON.stringify({ offering, job: browserJob, ops, marketing, policy }),
  { mode: 0o600 },
);
console.log(`Messaging verification passed: ${count} checks. No SMS sent.`);
