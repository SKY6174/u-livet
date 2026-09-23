// Local synthetic accounts only. Exercises actual PostgREST authorization and revision locks.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
assert.equal(status.API_URL, "http://127.0.0.1:55321");
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const run = Date.now().toString(36);
const schema = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync("src/lib/operation-documents/schema.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText,
  { exports: schema },
);
const model = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync("src/lib/operation-documents/model.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText,
  { exports: model, require: () => schema, Intl, Date, TextEncoder },
);
const photoMetadata = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync("src/lib/operation-documents/pdf-photo-metadata.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText,
  { exports: photoMetadata, Date },
);
const photoCrop = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync("src/lib/operation-documents/photo-crop.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText,
  { exports: photoCrop },
);
assert.deepEqual(
  JSON.parse(JSON.stringify(photoCrop.centerCropRect(1600, 900))),
  { x: 0, y: 0, width: 1600, height: 900 },
);
assert.deepEqual(
  JSON.parse(JSON.stringify(photoCrop.centerCropRect(1600, 1200))),
  { x: 0, y: 150, width: 1600, height: 900 },
);
assert.deepEqual(
  JSON.parse(JSON.stringify(photoCrop.centerCropRect(2000, 900))),
  { x: 200, y: 0, width: 1600, height: 900 },
);
assert.deepEqual(
  JSON.parse(JSON.stringify(photoCrop.operationPhotoSize(900, 1600, 960))),
  { width: 896, height: 504 },
);
assert.deepEqual(
  JSON.parse(JSON.stringify(photoMetadata.extractPhotoMetadata(
    "개강식(2026.07.14.) 운영사진 1（2026-7-14） 수료식(2026.02.30.)",
  ))),
  [
    { caption: "개강식", date: "2026-07-14" },
    { caption: "운영사진1", date: "2026-07-14" },
  ],
);
const legacySchedule = model.normalizeScheduleRow(
  {
    date: "2026.07.14. (11:00~13:00)",
    topic: "파크골프 이론",
    instructor: "조경호",
    hours: "2",
    assistant: "",
    assistantHours: "",
    location: "G-110",
  },
  "result",
);
assert.equal(legacySchedule.date, "2026-07-14");
assert.equal(legacySchedule.startTime, "11:00");
assert.equal(legacySchedule.endTime, "13:00");
assert.equal(
  model.validField("24:00", {
    key: "startTime",
    label: "시작시간",
    type: "time",
    max: 500,
  }),
  false,
);
const mergedPhotos = model.mergeImportedPhotos(
  [
    { caption: "개강식", date: "", image: "" },
    { caption: "수료식", date: "", image: "" },
    { caption: "운영사진1", date: "", image: "opening-image" },
    { caption: "운영사진2", date: "", image: "closing-image" },
  ],
  [
    { caption: "개강식", date: "2026-07-14", image: "opening-image" },
    { caption: "수료식", date: "2026-07-21", image: "closing-image" },
    { caption: "운영사진1", date: "2026-07-14", image: "class-image" },
  ],
);
assert.deepEqual(
  JSON.parse(JSON.stringify(mergedPhotos.map(({ caption, date }) => ({ caption, date })))),
  [
    { caption: "개강식", date: "2026-07-14" },
    { caption: "수료식", date: "2026-07-21" },
    { caption: "운영사진1", date: "2026-07-14" },
  ],
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
    { input: q, encoding: "utf8" },
  ).trim();
const ok = (r) => {
  assert.equal(r.error, null, JSON.stringify(r.error));
  return r.data;
};
const deny = (r, reason) => {
  assert.ok(r.error, "request must be denied");
  if (reason) assert.equal(r.error.message, reason);
};
let f;
const org = "10000000-0000-4000-8000-000000000001";
async function login(label) {
  const email = `operation-${run}-${label}@example.invalid`;
  ok(
    await admin.auth.admin.createUser({
      email,
      password: "Local-Only-2026!",
      email_confirm: true,
      user_metadata: {
        name: `테스트 ${label}`,
        privacy_policy_id: "20000000-0000-4000-8000-000000000011",
        privacy_accepted: true,
        mobile_phone: "+821000000000",
      },
    }),
  );
  const jar = new Map();
  const c = createServerClient(status.API_URL, status.ANON_KEY, {
    cookies: {
      getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
      setAll: (items) => items.forEach((i) => jar.set(i.name, i.value)),
    },
  });
  ok(await c.auth.signInWithPassword({ email, password: "Local-Only-2026!" }));
  await ensureLocalMfa(c);
  const p = ok(await c.rpc("life_identity")).id;
  if (label === "manager" || label.startsWith("teacher"))
    sql(
      `insert into public.life_role_assignments(person_id,org_id,role) values('${p}','${org}','${label === "manager" ? "COURSE_MANAGER" : "INSTRUCTOR"}');`,
    );
  return { c, p, jar };
}
const signup = JSON.parse(
  sql("select row_to_json(s) from life_private.signup_settings s"),
);
let manager, teacher, alternate, outsider, learner;
try {
  sql(
    "update life_private.signup_settings set enabled=true,policy_id='20000000-0000-4000-8000-000000000011',org_id='10000000-0000-4000-8000-000000000001'",
  );
  manager = await login("manager");
  teacher = await login("teacher");
  alternate = await login("teacher2");
  outsider = await login("outsider");
  learner = await login("learner");
} finally {
  sql(
    `update life_private.signup_settings set enabled=${signup.enabled},policy_id=${signup.policy_id ? "'" + signup.policy_id + "'" : "null"},org_id='${signup.org_id}'`,
  );
}

f = ok(
  await manager.c.rpc("life_create_offering", {
    o: org,
    y: "10000000-0000-4000-8000-000000000002",
    title: "[검증] 운영계획서·결과보고서 과정",
    academy: "로컬창업 아카데미",
    summary: "운영 문서 검증",
    curriculum: "프로그램 개발과 실습",
    mode: "OFFLINE",
    location: "302호",
    capacity: 20,
    selection_method: "REVIEW",
    apply_from: "2026-09-01T00:00:00Z",
    apply_until: "2026-09-10T00:00:00Z",
    starts_on: "2026-09-15",
    ends_on: "2026-09-30",
  }),
);
sql(
  `with application as (insert into public.life_applications(offering_id,person_id,status,policy_id) values('${f}','${learner.p}','ACCEPTED','20000000-0000-4000-8000-000000000012') returning id) insert into public.life_enrollments(application_id,offering_id,person_id) select id,'${f}','${learner.p}' from application;`,
);
ok(
  await manager.c.rpc("life_assign_instructor", {
    f,
    p: teacher.p,
    enabled: true,
  }),
);
const anon = createClient(status.API_URL, status.ANON_KEY, {
  auth: { persistSession: false },
});
const context = (c) => c.rpc("life_operation_context", { f });
let ctx = ok(await context(manager.c));
assert.equal(ctx.manager, true);
assert.equal(ctx.responsible, null);
assert.deepEqual(ctx.members.map((member) => member.person_id), [learner.p]);
for (const c of [teacher.c, outsider.c, learner.c, anon])
  deny(await context(c));
assert.ok(!JSON.stringify(ctx.legacy).includes("account"));
console.log(
  "PASS manager scope, anonymous/non-responsible denial, no payment PII",
);
ok(
  await manager.c.rpc("life_operation_assign", {
    f,
    p: teacher.p,
    expected_revision: 0,
  }),
);
ctx = ok(await context(teacher.c));
assert.equal(ctx.manager, false);
assert.equal(ctx.candidates.length, 0);
deny(
  await teacher.c.rpc("life_operation_assign", {
    f,
    p: teacher.p,
    expected_revision: 1,
  }),
  "FORBIDDEN",
);
assert.ok(
  ok(await teacher.c.rpc("life_operation_list")).some((r) => r.id === f),
);
let content = model.emptyContent("plan"),
  budget = model.emptyBudget("plan");
for (const field of schema.fields("plan"))
  content.fields[field.key] =
    field.type === "number"
      ? "10"
      : field.type === "date"
        ? "2026-09-22"
        : field.type === "time"
          ? "09:00"
        : `${field.label} 검증자료`;
content.fields.year = "2026";
content.fields.title = "[검증] 평생직업교육 프로그램";
content.fields.academy = "로컬창업 아카데미";
content.fields.audience = "성인학습자";
content.fields.professor = "테스트 teacher";
content.fields.program = "로컬창업 프로그램";
for (const table of schema.tables("plan"))
  if (table.min)
    content.tables[table.key] = [
      Object.fromEntries(
        table.columns.map((col) => [
          col.key,
          col.type === "number"
            ? "2"
            : col.type === "date"
              ? "2026-09-22"
              : col.type === "time"
                ? col.key === "endTime" ? "11:00" : "09:00"
                : `${col.label} 검증`,
        ]),
      ),
    ];
for (const r of budget.rows) r.planned = "0";
budget.rows.find((r) => r.category === "내부강사").planned = "100000";
budget.rows.find((r) => r.category === "외부강사").planned = "200000";
budget.rows.find((r) => r.category === "운영비").planned = "50000";
assert.equal(model.validContent(content, "plan"), true);
const save = (c, rev, b = undefined) =>
  c.rpc("life_operation_save", {
    f,
    k: "plan",
    c: content,
    b: b === undefined ? null : b,
    expected_revision: rev,
  });
deny(await save(teacher.c, 0, budget), "BUDGET_FORBIDDEN");
ctx = ok(await save(teacher.c, 0));
assert.equal(ctx.documents[0].budget.rows.length, 9);
assert.equal(ctx.documents[0].revision, 1);
deny(await save(teacher.c, 0), "REVISION_CHANGED");
console.log(
  "PASS explicit responsibility, budget tamper denied, revision conflicts and default budget rows",
);
const transition = (c, k, intent, revision, note = "", confirmed = true) =>
  c.rpc("life_operation_transition", {
    f,
    k,
    intent,
    expected_revision: revision,
    note,
    confirmed,
  });
deny(await transition(teacher.c, "plan", "submit", 1), "FORBIDDEN");
ctx = ok(await transition(teacher.c, "plan", "review", 1));
assert.equal(ctx.documents[0].status, "REVIEW");
deny(await save(teacher.c, 2), "DOCUMENT_LOCKED");
deny(await transition(manager.c, "plan", "submit", 2), "BUDGET_REQUIRED");
ctx = ok(await save(manager.c, 2, budget));
assert.equal(ctx.documents[0].status, "REVIEW");
ctx = ok(await transition(manager.c, "plan", "submit", 3));
assert.equal(ctx.documents[0].status, "SUBMITTED");
assert.equal(ctx.submissions.length, 1);
const firstSubmission = ctx.submissions[0];
deny(await save(manager.c, 4, budget), "DOCUMENT_LOCKED");
deny(await transition(manager.c, "plan", "reopen", 4), "REASON_REQUIRED");
ctx = ok(await transition(manager.c, "plan", "reopen", 4, "운영일정 보완"));
assert.equal(ctx.documents[0].status, "DRAFT");
content.fields.content = "수정된 주요내용";
ctx = ok(await save(teacher.c, 5));
const snapshot = ok(
  await manager.c.rpc("life_operation_submission", {
    f,
    s: firstSubmission.id,
  }),
);
assert.notEqual(snapshot.content.fields.content, content.fields.content);
deny(
  await outsider.c.rpc("life_operation_submission", {
    f,
    s: firstSubmission.id,
  }),
  "FORBIDDEN",
);
console.log(
  "PASS review locks, manager-only final submission, reopen reason, immutable prior version",
);
const malformed = structuredClone(content);
malformed.fields.year = "-1";
deny(
  await manager.c.rpc("life_operation_save", {
    f,
    k: "plan",
    c: malformed,
    b: budget,
    expected_revision: 6,
  }),
  "INVALID_CONTENT",
);
const xss = structuredClone(content);
xss.signature = "data:image/svg+xml;base64,PHN2Zz4=";
deny(
  await manager.c.rpc("life_operation_save", {
    f,
    k: "plan",
    c: xss,
    b: budget,
    expected_revision: 6,
  }),
  "INVALID_CONTENT",
);
const incomplete = model.emptyContent("result");
deny(
  await teacher.c.rpc("life_operation_save", {
    f, k: "result", c: incomplete, b: null, expected_revision: 0,
  }),
  "DOCUMENT_LOCKED",
);
ctx = ok(
  await manager.c.rpc("life_operation_save", {
    f,
    k: "result",
    c: incomplete,
    b: null,
    expected_revision: 0,
  }),
);
let storedBudget = ctx.documents.find((d) => d.kind === "result").budget;
assert.equal(
  storedBudget.rows.find((r) => r.category === "강사료").planned,
  "300000",
);
assert.equal(
  storedBudget.rows.find((r) => r.category === "운영비").planned,
  "50000",
);
assert.equal(
  ctx.documents
    .find((d) => d.kind === "plan")
    .budget.rows.find((r) => r.category === "외부강사").planned,
  "200000",
);
deny(await transition(manager.c, "result", "review", 1), "BUDGET_REQUIRED");
storedBudget.rows.forEach((row) => { row.planned ||= "0"; row.spent = "0"; });
storedBudget.scholarships = [{
  personId: learner.p,
  name: "테스트 learner",
  category: "학습활동 우수장학",
  rate: "100",
  amount: "84000",
  bank: "울산은행",
  account: "123-456",
  holder: "테스트 learner",
  paidOn: "2026-09-23",
  note: "검증 지급",
}];
storedBudget.scholarshipCount = "1";
storedBudget.scholarshipAmount = "84000";
ctx = ok(await manager.c.rpc("life_operation_save", {
  f, k: "result", c: incomplete, b: storedBudget, expected_revision: 1,
}));
const invalidScholarship = structuredClone(storedBudget);
invalidScholarship.scholarships[0].personId = outsider.p;
invalidScholarship.scholarships[0].name = "테스트 outsider";
deny(await manager.c.rpc("life_operation_save", {
  f, k: "result", c: incomplete, b: invalidScholarship, expected_revision: 2,
}), "INVALID_PARTICIPANT");
deny(await transition(teacher.c, "result", "review", 2), "FORBIDDEN");
ctx = ok(await transition(manager.c, "result", "review", 2));
assert.equal(ctx.documents.find((d) => d.kind === "result").status, "REVIEW");
const changedBudget = structuredClone(storedBudget);
changedBudget.rows[0].spent = "1";
deny(await manager.c.rpc("life_operation_save", {
  f, k: "result", c: incomplete, b: changedBudget, expected_revision: 3,
}), "BUDGET_LOCKED");
ctx = ok(await teacher.c.rpc("life_operation_save", {
  f, k: "result", c: incomplete, b: null, expected_revision: 3,
}));
const resultContent = model.emptyContent("result");
for (const field of schema.fields("result"))
  resultContent.fields[field.key] = field.type === "number" ? "2" :
    field.type === "date" ? "2026-09-22" :
      field.type === "time" ? "09:00" : `${field.label} 검증자료`;
resultContent.fields.year = "2026";
resultContent.fields.startsOn = "2026-09-21";
resultContent.fields.endsOn = "2026-09-23";
for (const table of schema.tables("result"))
  if (table.min)
    resultContent.tables[table.key] = [Object.fromEntries(table.columns.map((col) => [
      col.key, col.type === "number" ? "2" :
        col.type === "date" ? "2026-09-22" :
          col.type === "time" ? (col.key === "endTime" ? "11:00" : "09:00") : `${col.label} 검증자료`,
    ]))];
assert.equal(model.validContent(resultContent, "result"), true);
ctx = ok(await teacher.c.rpc("life_operation_save", {
  f, k: "result", c: resultContent, b: null, expected_revision: 4,
}));
deny(await transition(manager.c, "result", "submit", 5), "FORBIDDEN");
deny(await transition(teacher.c, "result", "submit", 5), "SIGNATURE_REQUIRED");
const managerSignature = structuredClone(resultContent);
managerSignature.signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9WvFIAAAAASUVORK5CYII=";
deny(await manager.c.rpc("life_operation_save", {
  f, k: "result", c: managerSignature, b: null, expected_revision: 5,
}), "SIGNATURE_FORBIDDEN");
resultContent.signature = managerSignature.signature;
ctx = ok(await teacher.c.rpc("life_operation_save", {
  f, k: "result", c: resultContent, b: null, expected_revision: 5,
}));
const changedAfterSigning = structuredClone(resultContent);
changedAfterSigning.fields.content = "서명 뒤 변경";
deny(await teacher.c.rpc("life_operation_save", {
  f, k: "result", c: changedAfterSigning, b: null, expected_revision: 6,
}), "SIGNATURE_STALE");
ctx = ok(await transition(teacher.c, "result", "submit", 6));
const resultDocument = ctx.documents.find((d) => d.kind === "result");
assert.equal(resultDocument.status, "SUBMITTED");
assert.equal(resultDocument.content.signature, resultContent.signature);
const resultSubmission = ctx.submissions.find((s) => s.kind === "result");
assert.equal(resultSubmission.name, "테스트 teacher");
ctx = ok(await transition(manager.c, "result", "reopen", 7, "예산 수정"));
assert.equal(ctx.documents.find((d) => d.kind === "result").content.signature, "");
assert.equal(ctx.documents.find((d) => d.kind === "result").status, "DRAFT");
const signedSnapshot = ok(await manager.c.rpc("life_operation_submission", { f, s: resultSubmission.id }));
assert.equal(signedSnapshot.content.signature, resultContent.signature);
console.log("PASS result budget-first gate, instructor-only signature/submit, immutable signed snapshot");
// A different institution's administrator cannot access this course.
sql(
  `insert into public.life_organizations(id,slug,name) values('99000000-0000-4000-8000-000000000099','operation-test-other','운영문서 다른기관 검증') on conflict do nothing; insert into public.life_role_assignments(person_id,org_id,role) select '${outsider.p}','99000000-0000-4000-8000-000000000099','SYSTEM_ADMIN' where not exists(select 1 from public.life_role_assignments where person_id='${outsider.p}' and org_id='99000000-0000-4000-8000-000000000099' and role='SYSTEM_ADMIN');`,
);
deny(await context(outsider.c), "FORBIDDEN");
sql(
  `update public.life_offering_instructors set valid_until=now() where offering_id='${f}' and person_id='${teacher.p}';`,
);
deny(await context(teacher.c), "FORBIDDEN");
sql(
  `update public.life_offering_instructors set valid_until=null where offering_id='${f}' and person_id='${teacher.p}';`,
);
const oldRole = sql(
  `select id from public.life_role_assignments where person_id='${manager.p}' and org_id='${org}' and role='COURSE_MANAGER' limit 1`,
);
sql(
  `update public.life_role_assignments set role='SYSTEM_ADMIN' where id='${oldRole}';`,
);
try {
  assert.equal(ok(await context(manager.c)).manager, true);
} finally {
  sql(
    `update public.life_role_assignments set role='COURSE_MANAGER' where id='${oldRole}';`,
  );
}
for (const table of [
  "life_operation_documents",
  "life_operation_responsibilities",
  "life_operation_submissions",
])
  deny(await teacher.c.from(table).select("*"));
console.log(
  "PASS different-org admin, expired teaching assignment, system admin support, table access denied",
);
// Confirm PostgreSQL immutable snapshot trigger, even outside API grants.
assert.throws(
  () =>
    sql(
      `update public.life_operation_submissions set revision=99 where id='${firstSubmission.id}';`,
    ),
  /SUBMISSION_IMMUTABLE/,
);
// Leave rich local fixtures for browser verification, with plan in DRAFT and result in the instructor stage.
ctx = ok(await context(manager.c));
const result = model.initialDocument(
  { ...ctx, documents: ctx.documents.filter((d) => d.kind !== "result") },
  "result",
);
for (const field of schema.fields("result"))
  if (!result.content.fields[field.key])
    result.content.fields[field.key] =
      field.type === "number"
        ? "0"
        : field.type === "date"
          ? "2026-09-22"
          : field.type === "time"
            ? "09:00"
          : `${field.label} 확인 완료`;
result.content.tables.schedule = content.tables.schedule.map((r) =>
  Object.fromEntries(
    schema.tables("result")[0].columns.map((c) => [c.key, r[c.key]]),
  ),
);
for (const r of result.budget.rows) {
  r.planned = "100000";
  r.spent = "90000";
}
result.budget.scholarships = storedBudget.scholarships;
result.budget.scholarshipCount = "1";
result.budget.scholarshipAmount = "84000";
ctx = ok(
  await manager.c.rpc("life_operation_save", {
    f,
    k: "result",
    c: result.content,
    b: result.budget,
    expected_revision: ctx.documents.find((d) => d.kind === "result").revision,
  }),
);
ctx = ok(await transition(manager.c, "result", "review", ctx.documents.find((d) => d.kind === "result").revision));

// The course-management selector is authoritative for both live document covers.
deny(
  await manager.c.rpc("life_assign_instructor", { f, p: teacher.p, enabled: false }),
  "RESPONSIBLE_INSTRUCTOR",
);
ok(await manager.c.rpc("life_assign_instructor", { f, p: alternate.p, enabled: true }));
ok(await manager.c.rpc("life_operation_assign", { f, p: alternate.p, expected_revision: 1 }));
ctx = ok(await context(manager.c));
assert.equal(ctx.responsible.name, "테스트 teacher2");
assert.ok(ctx.documents.every((d) => d.content.fields.professor === "테스트 teacher2" && d.status === "DRAFT"));
deny(await context(teacher.c), "FORBIDDEN");
assert.equal(ok(await context(alternate.c)).responsible.person_id, alternate.p);
const beforeRepeat = ctx.documents.map((d) => [d.kind, d.revision, d.status]);
ok(await manager.c.rpc("life_operation_assign", { f, p: alternate.p, expected_revision: 2 }));
ctx = ok(await context(manager.c));
assert.equal(ctx.responsible.revision, 2);
assert.deepEqual(ctx.documents.map((d) => [d.kind, d.revision, d.status]), beforeRepeat);
const forged = structuredClone(ctx.documents.find((d) => d.kind === "plan").content);
forged.fields.professor = "임의로 바꾼 강사";
ctx = ok(await alternate.c.rpc("life_operation_save", {
  f, k: "plan", c: forged, b: null,
  expected_revision: ctx.documents.find((d) => d.kind === "plan").revision,
}));
assert.equal(ctx.documents.find((d) => d.kind === "plan").content.fields.professor, "테스트 teacher2");
assert.equal(ok(await manager.c.rpc("life_operation_submission", { f, s: firstSubmission.id })).content.fields.professor, "테스트 teacher");
deny(await manager.c.rpc("life_assign_instructor", { f, p: alternate.p, enabled: false }), "RESPONSIBLE_INSTRUCTOR");
ok(await manager.c.rpc("life_operation_assign", { f, p: teacher.p, expected_revision: 2 }));
ctx = ok(await context(manager.c));
assert.ok(ctx.documents.every((d) => d.content.fields.professor === "테스트 teacher"));
deny(await context(alternate.c), "FORBIDDEN");
const resultRevision = ctx.documents.find((d) => d.kind === "result").revision;
ok(await transition(manager.c, "result", "review", resultRevision));
console.log("PASS responsible switch, canonical plan/result cover, no-op, snapshot, role and unassignment guard");
mkdirSync("tmp/operation-documents", { recursive: true });
writeFileSync(
  "tmp/operation-documents/context.json",
  JSON.stringify({ offering: f, teacher: teacher.p, manager: manager.p }),
);
for (const [label, a] of [
  ["manager", manager],
  ["teacher", teacher],
])
  writeFileSync(
    `tmp/operation-documents/${label}-state.json`,
    JSON.stringify({
      cookies: Array.from(a.jar, ([name, value]) => ({
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
  "All operation document checks passed. Browser fixtures: tmp/operation-documents",
);
