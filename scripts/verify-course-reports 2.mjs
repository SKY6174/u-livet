import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { ensureLocalMfa } from "./local-mfa.mjs";
const status = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
assert.equal(
  status.API_URL,
  "http://127.0.0.1:55321",
  "Dedicated local database only",
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
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ok = (r) => {
  assert.equal(r.error, null, JSON.stringify(r.error));
  return r.data;
};
const denied = (r) => assert.ok(r.error, "Expected denied request");
const ORG = "10000000-0000-4000-8000-000000000001",
  YEAR = "10000000-0000-4000-8000-000000000002",
  PRIVACY = "20000000-0000-4000-8000-000000000011";
const password = "Local-Only-2026!";
async function account(label, role) {
  const email = `report-${label}@example.invalid`;
  let user = (
    await admin.auth.admin.listUsers({ perPage: 1000 })
  ).data.users.find((u) => u.email === email);
  if (!user)
    user = ok(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: `테스트 ${label}`,
          privacy_policy_id: PRIVACY,
          privacy_accepted: true,
        },
      }),
    ).user;
  const jar = new Map();
  const c = createServerClient(status.API_URL, status.ANON_KEY, {
    cookies: {
      getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
      setAll: (items) => items.forEach((i) => jar.set(i.name, i.value)),
    },
  });
  ok(await c.auth.signInWithPassword({ email, password }));
  await ensureLocalMfa(c);
  const p = ok(await c.rpc("life_identity")).id;
  if (role)
    sql(
      `insert into public.life_role_assignments(person_id,org_id,role) select '${p}','${ORG}','${role}' where not exists(select 1 from public.life_role_assignments where person_id='${p}' and org_id='${ORG}' and role='${role}');`,
    );
  await ensureLocalMfa(c);
  return { c, p, jar };
}
const manager = await account("manager", "COURSE_MANAGER"),
  teacher = await account("teacher", "INSTRUCTOR"),
  learner = await account("learner"),
  outsider = await account("outsider");
const iso = (n) => new Date(Date.now() + n * 86400000).toISOString(),
  day = (n) => iso(n).slice(0, 10);
const f = ok(
  await manager.c.rpc("life_create_offering", {
    o: ORG,
    y: YEAR,
    title: "[테스트] 반려동물 간식 교육 결과보고",
    academy: "로컬창업 아카데미",
    summary: "운영 보고서 검증용 가상 과정",
    curriculum: "영양 이론 및 간식 만들기 실습",
    mode: "OFFLINE",
    location: "실습실 302호",
    capacity: 20,
    selection_method: "REVIEW",
    apply_from: iso(-20),
    apply_until: iso(-11),
    starts_on: day(-10),
    ends_on: day(-1),
  }),
);
ok(
  await manager.c.rpc("life_assign_instructor", {
    f,
    p: teacher.p,
    enabled: true,
  }),
);
// A local synthetic enrollment; never load personal data from the supplied PDFs.
const application = randomUUID();
sql(
  `insert into public.life_applications(id,offering_id,person_id,status,policy_id) values('${application}','${f}','${learner.p}','ACCEPTED','20000000-0000-4000-8000-000000000012'); insert into public.life_enrollments(application_id,offering_id,person_id) values('${application}','${f}','${learner.p}');`,
);
const session = ok(
  await teacher.c.rpc("life_schedule_class", {
    f,
    title: "영양 이론과 수제간식 실습",
    starts_at: day(-5) + "T01:00:00Z",
    ends_at: day(-5) + "T06:00:00Z",
    replaces: null,
  }),
);
const load = () => manager.c.rpc("life_course_report", { f });
let bundle = ok(await load());
assert.equal(bundle.report, null);
assert.equal(bundle.attendance.length, 0);
const payload = {
  operator: "이연향 연구원",
  professor: "테스트 교수",
  program: "로컬창업 아카데미",
  reportDate: day(0),
  content: "반려동물 영양을 이해하고 수제간식을 실습했습니다.",
  method: "대면 이론·실습 병행",
  education: "영양 이론 및 간식 조리",
  promotion: "학교 홈페이지 안내",
  other: "가상 검증 자료",
  strengths: "실습 중심 교육",
  improvements: "재료 준비 보완",
  followUp: "차기 운영 반영",
  certificates: 0,
  employed: null,
  surveyResponses: 1,
  satisfaction: 98,
  budgets: [{ category: "재료비", planned: 200000, spent: 180000, note: "" }],
  participants: [
    { personId: learner.p, birthDate: "1990-01-01", note: "가상 학습자" },
  ],
  scholarships: [
    {
      personId: learner.p,
      category: "학습활동 우수",
      rate: 80,
      amount: 72000,
      bank: "테스트은행",
      account: "000-0000-1234",
      holder: "가상 학습자",
      paidOn: "",
      note: "",
    },
  ],
  fees: [
    {
      name: "가상 강사",
      kind: "외부강사",
      birthDate: "1980-01-01",
      dates: day(-5),
      hours: 2,
      rate: 150000,
      bank: "테스트은행",
      account: "000-0000-5678",
      holder: "가상 강사",
      paidOn: "",
      note: "",
    },
    {
      name: "가상 강사",
      kind: "외부강사",
      birthDate: "1980-01-01",
      dates: day(-5),
      hours: 3,
      rate: 80000,
      bank: "테스트은행",
      account: "000-0000-5678",
      holder: "가상 강사",
      paidOn: "",
      note: "",
    },
  ],
};
ok(
  await manager.c.rpc("life_save_course_report", {
    f,
    payload,
    expected_revision: 0,
  }),
);
bundle = ok(await load());
assert.deepEqual(bundle.report.payload, payload);
assert.equal(bundle.report.revision, 1);
console.log("PASS manager saves and reloads all report/payment fields");
for (const actor of [teacher, learner, outsider]) {
  denied(await actor.c.rpc("life_course_report", { f }));
  denied(
    await actor.c.rpc("life_save_course_report", {
      f,
      payload,
      expected_revision: 1,
    }),
  );
}
const foreignOrg = randomUUID();
sql(
  `insert into public.life_organizations(id,slug,name) values('${foreignOrg}','test-${foreignOrg}','가상 타기관');insert into public.life_role_assignments(person_id,org_id,role) values('${outsider.p}','${foreignOrg}','COURSE_MANAGER');`,
);
await ensureLocalMfa(outsider.c);
denied(await outsider.c.rpc("life_course_report", { f }));
const anon = createClient(status.API_URL, status.ANON_KEY);
denied(await anon.rpc("life_course_report", { f }));
denied(await manager.c.from("life_course_reports").select("*"));
denied(await manager.c.from("life_report_files").select("*"));
console.log(
  "PASS instructor, learner, foreign manager, anonymous, direct table access denied",
);
denied(
  await manager.c.rpc("life_save_course_report", {
    f,
    payload,
    expected_revision: 0,
  }),
);
for (const invalid of [
  { ...payload, fees: [{ ...payload.fees[0], rate: -1 }] },
  {
    ...payload,
    scholarships: [{ ...payload.scholarships[0], personId: outsider.p }],
  },
  { ...payload, satisfaction: 101 },
  { ...payload, reportDate: "2026-02-30" },
])
  denied(
    await manager.c.rpc("life_save_course_report", {
      f,
      payload: invalid,
      expected_revision: 1,
    }),
  );
ok(
  await manager.c.rpc("life_save_course_report", {
    f,
    payload,
    expected_revision: 1,
  }),
);
console.log(
  "PASS stale writes, invalid amounts/dates and foreign participant rejected",
);
denied(
  await manager.c.rpc("life_record_attendance", {
    s: session,
    p: learner.p,
    minutes: 300,
    reason: "관리자 입력 차단",
    expected_revision: 0,
  }),
);
ok(
  await teacher.c.rpc("life_record_attendance", {
    s: session,
    p: learner.p,
    minutes: 250,
    reason: "강사 확인",
    expected_revision: 0,
  }),
);
const log = ok(
  await teacher.c.rpc("life_submit_teaching", {
    s: session,
    minutes: 300,
    notes: "이론 및 실습 진행",
    expected_revision: 0,
  }),
);
ok(
  await manager.c.rpc("life_approve_teaching", {
    l: log,
    expected_revision: 1,
  }),
);
bundle = ok(await load());
assert.equal(bundle.attendance[0].credited_minutes, 250);
assert.equal(bundle.teaching[0].current, true);
console.log(
  "PASS attendance is instructor-only and teaching records use existing approval flow",
);
const fileArgs = {
  f,
  kind: "result",
  filename: "test.pdf",
  mime: "application/pdf",
  body: Buffer.from("%PDF-1.4\nreport fixture").toString("base64"),
  caption: "가상 원본",
};
const fileId = ok(await manager.c.rpc("life_save_report_file", fileArgs));
assert.equal(
  ok(await manager.c.rpc("life_report_file", { f, file_id: fileId })).body,
  fileArgs.body,
);
for (const actor of [teacher, outsider]) {
  denied(await actor.c.rpc("life_save_report_file", fileArgs));
  denied(await actor.c.rpc("life_report_file", { f, file_id: fileId }));
  denied(
    await actor.c.rpc("life_report_file", { f, file_id: fileId, remove: true }),
  );
}
denied(
  await manager.c.rpc("life_save_report_file", {
    ...fileArgs,
    body: Buffer.from("<html>wrong type</html>").toString("base64"),
  }),
);
const replacement = ok(await manager.c.rpc("life_save_report_file", fileArgs));
assert.notEqual(fileId, replacement);
assert.equal(
  ok(await manager.c.rpc("life_report_file", { f, file_id: fileId })),
  null,
);
assert.equal(ok(await load()).files.length, 1);
ok(
  await manager.c.rpc("life_report_file", {
    f,
    file_id: replacement,
    remove: true,
  }),
);
denied(
  await manager.c.rpc("life_save_report_file", {
    ...fileArgs,
    body: Buffer.concat([
      Buffer.from("%PDF-"),
      Buffer.alloc(4 * 1024 * 1024),
    ]).toString("base64"),
  }),
);
console.log(
  "PASS file authorization, signatures, size limit, replacement and deletion",
);
function module(path) {
  const out = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    { exports: out.exports, module: out, console, URL, Headers },
  );
  return out.exports;
}
const origin = module("src/lib/reports/request.ts");
assert.equal(
  origin.isSameOriginRequest({
    headers: new Headers({
      origin: "http://127.0.0.1:3101",
      host: "127.0.0.1:3101",
    }),
  }),
  true,
);
assert.equal(
  origin.isSameOriginRequest({
    headers: new Headers({
      origin: "https://attacker.invalid",
      host: "127.0.0.1:3101",
    }),
  }),
  false,
);
const helpers = module("src/lib/reports/types.ts"),
  validate = module("src/lib/reports/validation.ts");
assert.equal(validate.validateReport(payload), true);
assert.equal(validate.validDate("2026-02-30"), false);
assert.equal(
  validate.validateReport({
    ...payload,
    fees: [{ ...payload.fees[0], hours: 0.001 }],
  }),
  false,
);
assert.equal(
  helpers.feeAmount({ ...payload.fees[0], hours: 2.55, rate: 100 }),
  255,
);
assert.equal(helpers.maskAccount("000-0000-1234", false), "**** 1234");
assert.equal(helpers.attendanceSummary(bundle, learner.p).missing, 0);
assert.equal(
  helpers.isCompleted({
    ...bundle.members[0],
    approval: { approved_at: iso(0) },
    stale: true,
  }),
  false,
);
console.log(
  "PASS numeric precision, validation, masking and stale completion behavior",
);
mkdirSync("tmp/course-reports", { recursive: true });
writeFileSync(
  "tmp/course-reports/context.json",
  JSON.stringify({ offering: f, session, learner: learner.p }),
);
writeFileSync(
  "tmp/course-reports/browser-state.json",
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
writeFileSync(
  "tmp/course-reports/teacher-state.json",
  JSON.stringify({
    cookies: Array.from(teacher.jar, ([name, value]) => ({
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
console.log(
  "Report verification complete; browser fixture written under ignored tmp/course-reports.",
);
