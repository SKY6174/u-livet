import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { ensureLocalMfa } from "./local-mfa.mjs";

const status = JSON.parse(execFileSync("supabase", ["status", "-o", "json"], {
  encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
}));
assert.equal(status.API_URL, "http://127.0.0.1:55321");
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const run = Date.now().toString(36);
const sql = query => execFileSync("docker", ["exec", "-i", "supabase_db_uc-life-core", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"], { input: query, encoding: "utf8" }).trim();
const ok = result => { assert.equal(result.error, null, JSON.stringify(result.error)); return result.data; };
const deny = (result, expected) => { assert.ok(result.error, "expected denial"); if (expected) assert.equal(result.error.message, expected); };
const signup = JSON.parse(sql("select row_to_json(s) from life_private.signup_settings s"));
const org = sql(`insert into public.life_organizations(slug,name) values('learner-doc-${run}','수강생 서류 검증 조직') returning id`).split("\n")[0];
const year = sql(`insert into public.life_project_years(org_id,label,starts_on,ends_on) values('${org}','2026 검증','2026-03-01','2027-02-28') returning id`).split("\n")[0];

async function account(label, role = null) {
  const email = `learner-doc-${run}-${label}@example.invalid`;
  ok(await admin.auth.admin.createUser({ email, password: "Local-Only-2026!", email_confirm: true,
    user_metadata: { name: `서류 검증 ${label}`, privacy_policy_id: "20000000-0000-4000-8000-000000000011", privacy_accepted: true, mobile_phone: "+821000000000" } }));
  const jar = new Map();
  const client = createServerClient(status.API_URL, status.ANON_KEY, { cookies: {
    getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
    setAll: items => items.forEach(item => jar.set(item.name, item.value)),
  } });
  ok(await client.auth.signInWithPassword({ email, password: "Local-Only-2026!" }));
  await ensureLocalMfa(client);
  const person = ok(await client.rpc("life_identity")).id;
  if (role) sql(`insert into public.life_role_assignments(person_id,org_id,role) values('${person}','${org}','${role}')`);
  return { client, person, jar };
}

let manager, learner, outsider;
try {
  sql("update life_private.signup_settings set enabled=true,policy_id='20000000-0000-4000-8000-000000000011',org_id='10000000-0000-4000-8000-000000000001'");
  manager = await account("manager", "COURSE_MANAGER");
  learner = await account("learner");
  outsider = await account("outsider");
} finally {
  sql(`update life_private.signup_settings set enabled=${signup.enabled},policy_id=${signup.policy_id ? `'${signup.policy_id}'` : "null"},org_id='${signup.org_id}'`);
}

const offering = ok(await manager.client.rpc("life_create_offering", {
  o: org, y: year, title: `[검증] 환불 과정 ${run}`, academy: "라이프케어", summary: "서류 처리 검증",
  curriculum: "수업", mode: "OFFLINE", location: "검증실", capacity: 10, selection_method: "REVIEW",
  apply_from: "2026-09-01T00:00:00Z", apply_until: "2026-09-20T00:00:00Z", starts_on: "2026-09-21", ends_on: "2026-10-31",
}));
sql(`update public.life_offerings set tuition=300000,status='PUBLISHED' where id='${offering}'`);
const pdf = Buffer.from("%PDF-1.7\n% synthetic local workflow fixture\n%%EOF\n");
const pdfBase64 = pdf.toString("base64");
const pdfSha256 = createHash("sha256").update(pdf).digest("hex");
const requestKey = crypto.randomUUID();
const args = { k: "REFUND", f: offering, request_key: requestKey, course_name: "ignored", applicant_name: "서류 검증 learner",
  phone: "010-1234-5678", occurrence: "before-sixth", amount: 250000, pdf_base64: pdfBase64, pdf_sha256: pdfSha256 };
const request = ok(await learner.client.rpc("life_submit_learner_document", args));
assert.equal(ok(await learner.client.rpc("life_submit_learner_document", args)), request, "idempotent retry must return same id");
deny(await learner.client.rpc("life_submit_learner_document", { ...args, request_key: crypto.randomUUID(), amount: 249999 }), "REFUND_AMOUNT_MISMATCH");
assert.equal(sql("select to_regclass('public.life_learner_documents_queue_kind')"), "life_learner_documents_queue_kind");
assert.equal(sql("select to_regclass('public.life_learner_documents_course_search')"), "life_learner_documents_course_search");
assert.equal(sql("select to_regclass('public.life_learner_documents_applicant_search')"), "life_learner_documents_applicant_search");
const adminFunction = sql("select pg_get_functiondef('life_private.admin_learner_documents(text,text,text)'::regprocedure)");
assert.match(adminFunction, /authorized_orgs as materialized/i);
assert.match(adminFunction, /limit 500/i);

const mine = ok(await learner.client.rpc("life_my_learner_documents"));
assert.equal(mine.length, 1);
assert.equal(mine[0].amount, 250000);
assert.equal(mine[0].status, "RECEIVED");
assert.equal(mine[0].events.length, 1);
assert.equal(ok(await outsider.client.rpc("life_my_learner_documents")).length, 0);
deny(await outsider.client.rpc("life_learner_document_file", { r: request }), "FORBIDDEN");
const ownerFile = ok(await learner.client.rpc("life_learner_document_file", { r: request }));
assert.equal(ownerFile.sha256, pdfSha256);
assert.equal(Buffer.from(ownerFile.base64, "base64").toString(), pdf.toString());

let dashboard = ok(await manager.client.rpc("life_admin_learner_documents", { k: "REFUND", s: null, q: "환불" }));
let row = dashboard.requests.find(item => item.id === request);
assert.equal(row.phone_masked, "010-****-5678");
assert.equal(row.revision, 1);
assert.equal(ok(await manager.client.rpc("life_learner_document_file", { r: request })).sha256, pdfSha256);
ok(await manager.client.rpc("life_decide_learner_document", { r: request, next_status: "REVIEWING", note: "계좌와 반환 기준을 확인하고 있습니다.", expected_revision: 1 }));
deny(await manager.client.rpc("life_decide_learner_document", { r: request, next_status: "APPROVED", note: "오래된 화면", expected_revision: 1 }), "STALE_REVISION");
ok(await manager.client.rpc("life_decide_learner_document", { r: request, next_status: "APPROVED", note: "반환액 250,000원을 승인했습니다.", expected_revision: 2 }));
ok(await manager.client.rpc("life_decide_learner_document", { r: request, next_status: "COMPLETED", note: "행정 처리가 완료되었습니다.", expected_revision: 3 }));
dashboard = ok(await manager.client.rpc("life_admin_learner_documents", { k: null, s: "COMPLETED", q: null }));
row = dashboard.requests.find(item => item.id === request);
assert.equal(row.status, "COMPLETED");
assert.equal(row.revision, 4);
assert.equal(row.events.length, 4);
dashboard = ok(await manager.client.rpc("life_admin_learner_documents", { k: "REFUND", s: "COMPLETED", q: "환불" }));
assert.equal(dashboard.requests.find(item => item.id === request)?.id, request, "combined queue filters must preserve the request");

const cancelId = ok(await learner.client.rpc("life_submit_learner_document", { ...args, k: "APPLICATION", f: null,
  request_key: crypto.randomUUID(), course_name: "직접 입력 과정", occurrence: null, amount: null }));
ok(await learner.client.rpc("life_cancel_learner_document", { r: cancelId }));
const pendingId = ok(await learner.client.rpc("life_submit_learner_document", { ...args, k: "SCHOLARSHIP", f: offering,
  request_key: crypto.randomUUID(), occurrence: null, amount: null }));
deny(await learner.client.rpc("life_cancel_learner_document", { r: request }), "FORBIDDEN");
deny(await learner.client.from("life_learner_document_requests").select("*"));
deny(await manager.client.from("life_learner_document_events").select("*"));

mkdirSync("tmp/learner-document-workflow", { recursive: true });
for (const [label, actor] of [["learner", learner], ["manager", manager]]) {
  writeFileSync(`tmp/learner-document-workflow/${label}-cookies.txt`,
    Array.from(actor.jar, ([name, value]) => `${name}=${value}`).join("; "), { mode: 0o600 });
}
writeFileSync("tmp/learner-document-workflow/fixture.json", JSON.stringify({ request, pendingId, offering }), { mode: 0o600 });

console.log("PASS idempotent submission, refund calculation, tenant isolation, immutable PDF, optimized queue filters, status history, optimistic locking and table isolation");
