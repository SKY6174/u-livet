// Run verify-course-reports.mjs first; all mutations below are synthetic/local.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { ensureLocalMfa } from "./local-mfa.mjs";
const status = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
assert.equal(status.API_URL, "http://127.0.0.1:55321");
const { offering: f, learner } = JSON.parse(
  readFileSync("tmp/course-reports/context.json", "utf8"),
);
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
const ok = (r) => {
  assert.equal(r.error, null, JSON.stringify(r.error));
  return r.data;
};
const denied = (r) => assert.ok(r.error, "Expected denied request");
async function account(label) {
  const jar = new Map();
  const c = createServerClient(status.API_URL, status.ANON_KEY, {
    cookies: {
      getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
      setAll: (items) => items.forEach((i) => jar.set(i.name, i.value)),
    },
  });
  ok(
    await c.auth.signInWithPassword({
      email: `report-${label}@example.invalid`,
      password: "Local-Only-2026!",
    }),
  );
  if (label === "manager") denied(await c.rpc("life_course_workspace", { f }));
  await ensureLocalMfa(c);
  return { c, jar, p: ok(await c.rpc("life_identity")).id };
}
const manager = await account("manager");
const teacher = await account("teacher");
const outsider = await account("outsider");
const student = await account("learner");
const load = async () =>
  ok(await manager.c.rpc("life_course_workspace", { f }))[0];
let c = await load();
assert.equal(c.enrolled, 1);
assert.equal(c.attendance_recorded, 1);
assert.equal(c.missing_attendance, 0);
assert.equal(c.fee_count, 2);
assert.equal(c.fee_unpaid, 2);
assert.equal(c.fee_total, 540000);
assert.equal(c.scholarship_count, 1);
assert.equal(c.teaching_pending, 0);
assert.deepEqual(c.report_missing, []);
assert.equal(c.report_revision, 2);
for (const forbidden of [
  "body",
  "account",
  "members",
  "payload",
  "person_id",
  "evidence",
])
  assert.ok(!JSON.stringify(c).includes(`"${forbidden}":`));
console.log(
  "PASS minimal aggregate reflects saved reports/payments/teaching without private details",
);

const anon = createClient(status.API_URL, status.ANON_KEY);
denied(await anon.rpc("life_course_workspace", { f }));
for (const actor of [teacher, outsider, student]) {
  denied(await actor.c.rpc("life_course_workspace", { f }));
  assert.ok(
    !ok(await actor.c.rpc("life_course_workspace", { f: null })).some(
      (row) => row.id === f,
    ),
  );
}
denied(await manager.c.rpc("life_course_workspace", { f: randomUUID() }));
console.log(
  "PASS anonymous, AAL1, instructor, learner and other-organization boundaries",
);

const past = randomUUID(),
  future = randomUUID(),
  cancelled = randomUUID();
sql(`insert into life_class_sessions(id,offering_id,title,starts_at,ends_at,status) values
 ('${past}','${f}','종료 수업 검증',now()-interval '2 days',now()-interval '2 days'+interval '1 hour','SCHEDULED'),
 ('${future}','${f}','예정 수업 검증',now()+interval '2 days',now()+interval '2 days'+interval '1 hour','SCHEDULED'),
 ('${cancelled}','${f}','휴강 검증',now()-interval '3 days',now()-interval '3 days'+interval '1 hour','CANCELLED');`);
c = await load();
assert.equal(c.scheduled_sessions, 3);
assert.equal(c.ended_sessions, 2);
assert.equal(c.missing_attendance, 1);
ok(
  await teacher.c.rpc("life_record_attendance", {
    s: past,
    p: learner,
    minutes: 0,
    reason: "합성 자료 결석 확인",
    expected_revision: 0,
  }),
);
c = await load();
assert.equal(c.attendance_expected, 2);
assert.equal(c.attendance_recorded, 2);
assert.equal(c.missing_attendance, 0);
console.log(
  "PASS future/cancelled sessions excluded; recorded absence is not missing attendance",
);

const policy = sql(
  "select id from life_policy_versions where kind='COMPLETION' and status='APPROVED' and life_private.policy_valid(id,org_id,'COMPLETION') limit 1;",
);
assert.match(policy, /^[0-9a-f-]{36}$/);
const run = randomUUID();
sql(`insert into life_completion_runs(id,enrollment_id,offering_id,person_id,input_revision,outcome,reasons,evidence,calculated_by)
 select '${run}',e.id,e.offering_id,e.person_id,o.academic_revision,'READY','[]','{"policy_id":"${policy}"}','${manager.p}' from life_enrollments e join life_offerings o on o.id=e.offering_id where e.offering_id='${f}' and e.person_id='${learner}';
 insert into life_completion_approvals(run_id,approved_by) values('${run}','${teacher.p}');`);
c = await load();
assert.equal(c.completed, 1);
assert.equal(c.completion_pending, 0);
sql(
  `update life_offerings set academic_revision=academic_revision+1 where id='${f}';`,
);
c = await load();
assert.equal(c.completed, 0);
assert.equal(c.completion_pending, 1);
sql(
  `update life_completion_runs set input_revision=(select academic_revision from life_offerings where id='${f}'),evidence='{"policy_id":"${randomUUID()}"}' where id='${run}';`,
);
c = await load();
assert.equal(c.completed, 0);
assert.equal(c.completion_pending, 1);
console.log(
  "PASS changed academic data and invalid approval policies invalidate completion totals",
);

const bundle = ok(await manager.c.rpc("life_course_report", { f }));
const payload = {
  ...bundle.report.payload,
  professor: "",
  fees: bundle.report.payload.fees.map((row) => ({
    ...row,
    paidOn: "2026-09-20",
  })),
};
ok(
  await manager.c.rpc("life_save_course_report", {
    f,
    payload,
    expected_revision: bundle.report.revision,
  }),
);
c = await load();
assert.equal(c.report_revision, 3);
assert.equal(c.fee_unpaid, 0);
assert.deepEqual(c.report_missing, ["담당 교수"]);
const file = ok(
  await manager.c.rpc("life_save_report_file", {
    f,
    kind: "result",
    filename: "synthetic.pdf",
    mime: "application/pdf",
    body: Buffer.from("%PDF-1.4\nSynthetic workspace fixture").toString(
      "base64",
    ),
    caption: "합성 검증",
  }),
);
c = await load();
assert.deepEqual(c.document_kinds, ["result"]);
assert.equal(c.result_file_id, file);
ok(await manager.c.rpc("life_report_file", { f, file_id: file, remove: true }));
c = await load();
assert.deepEqual(c.document_kinds, []);
assert.equal(c.result_file_id, null);
console.log(
  "PASS report edits and attachment add/remove immediately update the shared summary",
);

const archive = randomUUID();
const source = {
  filename: "synthetic-original.pdf",
  sha256: "0".repeat(64),
  enrolled: 14,
  completed: 14,
  educationHours: 30,
  classCount: 7,
  scholarshipAmount: 1008000,
  scholarshipRecipients: 14,
  notes: "검토용 합성 자료입니다. 원본 집계와 개인별 전산 기록을 구분합니다.",
};
sql(`insert into life_offerings select (jsonb_populate_record(null::life_offerings,to_jsonb(o)||jsonb_build_object('id','${archive}','name','[검토용 예시] 보관 과정 운영 검증','status','ARCHIVED','apply_from',null,'apply_until',null,'tuition',null,'selection_method',null))).* from life_offerings o where id='${f}';
 insert into life_course_reports(offering_id,payload,updated_by) select '${archive}',payload||jsonb_build_object('sourceReport','${JSON.stringify(source)}'::jsonb,'participants','[]'::jsonb,'fees','[]'::jsonb,'scholarships','[]'::jsonb),'${manager.p}' from life_course_reports where offering_id='${f}';`);
const archived = ok(
  await manager.c.rpc("life_course_workspace", { f: archive }),
)[0];
assert.equal(archived.source.enrolled, 14);
assert.equal(archived.enrolled, 0);
assert.equal(archived.completed, 0);
assert.equal(archived.source.hours, 30);
const all = ok(await manager.c.rpc("life_course_workspace", { f: null }));
assert.ok(all.some((row) => row.id === archive));
assert.ok(all.every((row) => row.org_id === c.org_id));
console.log(
  "PASS archive source totals remain distinct from individual records; collection is organization-scoped",
);
writeFileSync(
  "tmp/course-reports/workspace-context.json",
  JSON.stringify({ offering: f, archive }),
  { mode: 0o600 },
);
writeFileSync(
  "tmp/course-reports/workspace-state.json",
  JSON.stringify({
    cookies: Array.from(manager.jar, ([name, value]) => ({
      name,
      value,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
      expires: -1,
    })),
    origins: [],
  }),
  { mode: 0o600 },
);
console.log("Workspace verification complete.");
