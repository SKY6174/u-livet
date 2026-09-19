import { ensureLocalMfa } from "./local-mfa.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { renderCertificate } from "../src/lib/certificates/pdf.ts";
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
      "-tA",
    ],
    { input: q, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
const anon = () =>
  createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const worker = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ok = (r) => {
  assert.equal(r.error, null, JSON.stringify(r.error));
  return r.data;
};
let checks = 0;
const pass = (s) => {
  checks++;
  console.log("PASS " + s);
};
async function actor(name) {
  const c = anon();
  ok(
    await c.auth.signInWithPassword({
      email: name + "@example.invalid",
      password: "Local-Only-2026!",
    }),
  );
  await ensureLocalMfa(c);
  return { c, p: ok(await c.rpc("life_identity")).id };
}
const learner = await actor("evaluation-learner"),
  teacher = await actor("instructor"),
  manager = await actor("operator"),
  reviewer = await actor("reviewer"),
  outsider = await actor("evaluation-outsider");
const org = "10000000-0000-4000-8000-000000000001";
const offering = sql(
  "select id from public.life_offerings where name='[테스트] 출결·시험·수료 연결' and status='PUBLISHED' order by created_at desc limit 1",
);
assert(offering);
assert.equal(
  sql(
    `select count(*) from public.life_certificate_requests where offering_id='${offering}'`,
  ),
  "0",
  "Run verify-learning.mjs first to create a fresh local course.",
);
const args = { f: offering, k: "COMPLETION", supersedes: null, reason: "" };
assert((await outsider.c.rpc("life_request_certificate", args)).error);
assert(
  (await teacher.c.rpc("life_request_certificate", { ...args, k: "TEACHING" }))
    .error,
);
pass(
  "unconfirmed learner and planned-only teaching hours cannot request certificates",
);
const req = ok(await learner.c.rpc("life_request_certificate", args));
assert.equal(ok(await learner.c.rpc("life_request_certificate", args)), req);
pass("duplicate request returns one existing request");
assert(
  (
    await reviewer.c.rpc("life_approve_certificate", {
      r: req,
      issuer: randomUUID(),
      template: randomUUID(),
    })
  ).error,
);
pass("CERTIFIER role alone is insufficient without valid issuer delegation");
const issuer = randomUUID(),
  completionTemplate = randomUUID(),
  teachingTemplate = randomUUID();
sql(`insert into public.life_issuer_authorizations(id,org_id,organization_name,title,holder_name,valid_from,valid_until,approval_reference,approved_by,approved_at,seal_omission_basis,test_only) values('${issuer}','${org}','[테스트] 앵커사업단','검증용 사업단장','가상 발급자',now()-interval '1 day',now()+interval '1 year','LOCAL-TEST-D05','${manager.p}',now(),'로컬 검증 전용 직인 생략',true);
insert into public.life_issuer_delegations(issuer_id,person_id,kind,valid_from,valid_until,approval_reference) values('${issuer}','${reviewer.p}','COMPLETION',now()-interval '1 day',now()+interval '1 year','LOCAL-TEST'),('${issuer}','${reviewer.p}','TEACHING',now()-interval '1 day',now()+interval '1 year','LOCAL-TEST');
insert into public.life_certificate_templates(id,org_id,kind,version,title,body,approved_by,approved_at,approval_reference) values('${completionTemplate}','${org}','COMPLETION','TEST-${completionTemplate}','이수증','위 사람은 확인된 기준에 따라 해당 교육과정을 이수하였음을 증명합니다. 이 문서는 기능 검증용입니다.','${manager.p}',now(),'LOCAL-TEST'),('${teachingTemplate}','${org}','TEACHING','TEST-${teachingTemplate}','강의경력증명서','위 사람의 승인된 실제 강의실적을 위와 같이 확인합니다. 이 문서는 기능 검증용입니다.','${manager.p}',now(),'LOCAL-TEST');`);
assert((await learner.c.from("life_issuer_authorizations").insert({})).error);
assert((await anon().from("life_certificate_issues").select("*")).error);
pass("issuer creation and raw public issuance ledger access denied");
assert(
  (
    await reviewer.c.rpc("life_approve_certificate", {
      r: req,
      issuer,
      template: teachingTemplate,
    })
  ).error,
);
pass("wrong certificate template kind rejected");
const [issue, duplicate] = await Promise.all([
  reviewer.c.rpc("life_approve_certificate", {
    r: req,
    issuer,
    template: completionTemplate,
  }),
  reviewer.c.rpc("life_approve_certificate", {
    r: req,
    issuer,
    template: completionTemplate,
  }),
]);
const issued = ok(issue);
assert.equal(issued, ok(duplicate));
pass("concurrent approval produces one issue and one number");
assert((await learner.c.rpc("life_claim_certificate", { i: issued })).error);
assert(
  (
    await learner.c.rpc("life_finish_certificate", {
      i: issued,
      nonce: randomUUID(),
      pdf_base64: "forged",
    })
  ).error,
);
pass("browser cannot claim generation or upload forged certificate bytes");
assert((await learner.c.rpc("life_download_certificate", { i: issued })).error);
pass("approval without finished PDF is not downloadable");
let job = ok(await worker.rpc("life_claim_certificate", { i: issued }));
assert(job.token);
assert.equal(
  ok(await worker.rpc("life_claim_certificate", { i: issued })),
  null,
);
pass("single worker lease prevents duplicate generation");
assert(
  (
    await worker.rpc("life_finish_certificate", {
      i: issued,
      nonce: job.nonce,
      pdf_base64: Buffer.from("NOT A PDF").toString("base64"),
    })
  ).error,
);
pass("invalid PDF cannot become issued");
ok(await worker.rpc("life_fail_certificate", { i: issued, nonce: job.nonce }));
const oldNonce = job.nonce;
job = ok(await worker.rpc("life_claim_certificate", { i: issued }));
assert.notEqual(job.nonce, oldNonce);
const pdf = await renderCertificate(job, "http://127.0.0.1:3100");
assert(
  (
    await worker.rpc("life_finish_certificate", {
      i: issued,
      nonce: oldNonce,
      pdf_base64: Buffer.from(pdf).toString("base64"),
    })
  ).error,
);
pass("failed generation can retry and superseded worker nonce is rejected");
// Revoking the approver's grant while rendering blocks finalization.
sql(
  `update public.life_issuer_delegations set valid_until=now()-interval '1 second' where issuer_id='${issuer}' and person_id='${reviewer.p}';`,
);
assert(
  (
    await worker.rpc("life_finish_certificate", {
      i: issued,
      nonce: job.nonce,
      pdf_base64: Buffer.from(pdf).toString("base64"),
    })
  ).error,
);
sql(
  `update public.life_issuer_delegations set valid_until=now()+interval '1 year' where issuer_id='${issuer}' and person_id='${reviewer.p}';`,
);
pass("delegation expiry during rendering blocks issuance");
const sha = ok(
  await worker.rpc("life_finish_certificate", {
    i: issued,
    nonce: job.nonce,
    pdf_base64: Buffer.from(pdf).toString("base64"),
  }),
);
assert.equal(sha, createHash("sha256").update(pdf).digest("hex"));
assert.equal(
  ok(
    await worker.rpc("life_finish_certificate", {
      i: issued,
      nonce: job.nonce,
      pdf_base64: "ignored",
    }),
  ),
  sha,
);
pass(
  "stored PDF hash matches rendered bytes and finalization retry is idempotent",
);
const download = ok(
  await learner.c.rpc("life_download_certificate", { i: issued }),
);
assert.equal(
  Buffer.compare(Buffer.from(download.base64, "base64"), Buffer.from(pdf)),
  0,
);
assert.equal(
  sql(
    `select count(*) from life_private.certificate_tokens where issue_id='${issued}'`,
  ),
  "0",
);
pass(
  "repeat download preserves original bytes and completed job discards plaintext token",
);
assert(
  (await outsider.c.rpc("life_download_certificate", { i: issued })).error,
);
assert((await outsider.c.rpc("life_certificate_detail", { i: issued })).error);
pass("another user cannot view details or download original");
const verified = ok(
  await anon().rpc("life_verify_certificate", { token: job.token }),
);
assert.equal(verified.state, "ISSUED");
assert(!JSON.stringify(verified).includes(learner.p));
assert(!JSON.stringify(verified).includes("evaluation-learner"));
assert.equal(verified.test_only, true);
pass("opaque-token verification returns current minimal masked test record");
assert.equal(
  ok(await anon().rpc("life_verify_certificate", { token: "0".repeat(64) }))
    .state,
  "NOT_FOUND",
);
pass("unknown token means unconfirmed, not forged");
const sessions = ok(
  await teacher.c
    .from("life_class_sessions")
    .select("*")
    .eq("offering_id", offering)
    .eq("status", "SCHEDULED"),
);
const session = sessions[0];
assert(
  (
    await learner.c.rpc("life_submit_teaching", {
      s: session.id,
      minutes: 60,
      notes: "forged",
      expected_revision: 0,
    })
  ).error,
);
const log = ok(
  await teacher.c.rpc("life_submit_teaching", {
    s: session.id,
    minutes: 30,
    notes: "실제 강의 30분, 검증용 기록",
    expected_revision: 0,
  }),
);
assert(
  (await teacher.c.rpc("life_request_certificate", { ...args, k: "TEACHING" }))
    .error,
);
pass(
  "only assigned instructor submits actual teaching; unapproved log is insufficient",
);
const tempRole = randomUUID();
sql(
  `insert into public.life_role_assignments(id,person_id,org_id,role) values('${tempRole}','${teacher.p}','${org}','COURSE_MANAGER');`,
);
assert.equal(
  (
    await teacher.c.rpc("life_approve_teaching", {
      l: log,
      expected_revision: 1,
    })
  ).error.message,
  "SELF_APPROVAL_FORBIDDEN",
);
sql(`delete from public.life_role_assignments where id='${tempRole}';`);
pass("instructor cannot approve own teaching even with manager role");
ok(
  await manager.c.rpc("life_approve_teaching", {
    l: log,
    expected_revision: 1,
  }),
);
const teachingReq = ok(
  await teacher.c.rpc("life_request_certificate", { ...args, k: "TEACHING" }),
);
const teachingIssue = ok(
  await reviewer.c.rpc("life_approve_certificate", {
    r: teachingReq,
    issuer,
    template: teachingTemplate,
  }),
);
const teachingJob = ok(
  await worker.rpc("life_claim_certificate", { i: teachingIssue }),
);
assert.equal(teachingJob.snapshot.evidence.minutes, 30);
pass(
  "career certificate sums confirmed actual 30 minutes instead of 120 scheduled minutes",
);
const teachingPdf = await renderCertificate(
  teachingJob,
  "http://127.0.0.1:3100",
);
ok(
  await worker.rpc("life_finish_certificate", {
    i: teachingIssue,
    nonce: teachingJob.nonce,
    pdf_base64: Buffer.from(teachingPdf).toString("base64"),
  }),
);
ok(
  await teacher.c.rpc("life_submit_teaching", {
    s: session.id,
    minutes: 45,
    notes: "강의실적 정정 45분",
    expected_revision: 1,
  }),
);
assert.equal(
  ok(await anon().rpc("life_verify_certificate", { token: teachingJob.token }))
    .state,
  "STALE",
);
assert(
  (await teacher.c.rpc("life_download_certificate", { i: teachingIssue }))
    .error,
);
pass(
  "corrected teaching evidence invalidates old certificate download and public status",
);
assert(
  (
    await teacher.c.rpc("life_request_certificate", {
      ...args,
      k: "TEACHING",
      supersedes: teachingIssue,
      reason: "정정",
    })
  ).error,
);
ok(
  await manager.c.rpc("life_approve_teaching", {
    l: log,
    expected_revision: 2,
  }),
);
const correction = ok(
  await teacher.c.rpc("life_request_certificate", {
    ...args,
    k: "TEACHING",
    supersedes: teachingIssue,
    reason: "강의실적 45분으로 정정 승인",
  }),
);
const replacement = ok(
  await reviewer.c.rpc("life_approve_certificate", {
    r: correction,
    issuer,
    template: teachingTemplate,
  }),
);
const replacementJob = ok(
  await worker.rpc("life_claim_certificate", { i: replacement }),
);
const replacementPdf = await renderCertificate(
  replacementJob,
  "http://127.0.0.1:3100",
);
ok(
  await worker.rpc("life_finish_certificate", {
    i: replacement,
    nonce: replacementJob.nonce,
    pdf_base64: Buffer.from(replacementPdf).toString("base64"),
  }),
);
assert.notEqual(replacementJob.number, teachingJob.number);
assert.equal(
  ok(await anon().rpc("life_verify_certificate", { token: teachingJob.token }))
    .state,
  "SUPERSEDED",
);
pass(
  "approved correction creates new numbered original and supersedes old original",
);
assert(
  (
    await learner.c.rpc("life_revoke_certificate", {
      i: replacement,
      reason: "unauthorized",
    })
  ).error,
);
ok(
  await reviewer.c.rpc("life_revoke_certificate", {
    i: replacement,
    reason: "로컬 취소 검증",
  }),
);
assert.equal(
  ok(
    await anon().rpc("life_verify_certificate", {
      token: replacementJob.token,
    }),
  ).state,
  "REVOKED",
);
assert(
  (await teacher.c.rpc("life_download_certificate", { i: replacement })).error,
);
pass("only delegated issuer can revoke; revoked original is not downloadable");
// Generate a fresh pending correction for the browser to approve through the actual server worker.
const browserRequest = ok(
  await teacher.c.rpc("life_request_certificate", {
    ...args,
    k: "TEACHING",
    supersedes: replacement,
    reason: "브라우저 발급 기능 검증",
  }),
);
let limited;
for (let i = 0; i < 31; i++)
  limited = ok(
    await anon().rpc("life_verify_certificate", {
      token: randomUUID().replaceAll("-", "").repeat(2),
    }),
  );
for (let i = 0; i < 31; i++)
  limited = ok(
    await anon().rpc("life_verify_certificate", { token: "1".repeat(64) }),
  );
assert.equal(limited.state, "RATE_LIMITED");
pass(
  "public verification applies database rate limit without exposing issuer ledger",
);
mkdirSync("output/pdf", { recursive: true });
writeFileSync("output/pdf/test-completion.pdf", pdf);
writeFileSync("output/pdf/test-teaching.pdf", replacementPdf);
writeFileSync(
  "/tmp/uc-life-certificate-browser.json",
  JSON.stringify({
    offering,
    issuer,
    completionTemplate,
    teachingTemplate,
    issued,
    teachingIssue,
    replacement,
    browserRequest,
    token: job.token,
    number: job.number,
  }),
  { mode: 0o600 },
);
console.log(
  `Verified ${checks} certificate checks. PDFs are explicitly test-only.`,
);
