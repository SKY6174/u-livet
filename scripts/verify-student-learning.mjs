import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) => (name in mocks ? mocks[name] : require(name)),
    module,
    module.exports,
  );
  return module.exports;
}
const attendance = load("src/lib/attendance/model.ts");
const model = load("src/lib/student-learning/model.ts", {
  "@/lib/attendance/model": attendance,
});
const menuHint = load("src/components/navigation/menu-hint.tsx");
let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed++;
  console.log("PASS " + name);
};
const now = Date.parse("2026-09-21T09:00:00Z");
const base = {
  application_id: "application",
  id: "offering",
  course_id: "course",
  name: "기초 과정",
  academy: "기술",
  status: "ACCEPTED",
  active: true,
  starts_on: "2026-09-01",
  ends_on: "2026-10-01",
  instructors: [],
  sessions: [],
  lessons: [],
  completion: null,
  mode: "OFFLINE",
  location: "교실",
  submitted_at: "2026-09-01T00:00:00Z",
};
const session = (id, start, end, credit = null, status = "SCHEDULED") => ({
  id,
  title: id,
  starts_at: start,
  ends_at: end,
  credited_minutes: credit,
  status,
  reason: "",
  replaces_id: null,
});
const past = session(
  "past",
  "2026-09-20T00:00:00Z",
  "2026-09-20T01:00:00Z",
  60,
);
const missing = session(
  "missing",
  "2026-09-20T02:00:00Z",
  "2026-09-20T03:00:00Z",
);
const future = session(
  "future",
  "2026-09-22T00:00:00Z",
  "2026-09-22T01:00:00Z",
);
await test("missing attendance remains unknown; cancellations and future sessions never dilute attendance", () => {
  assert.equal(
    model.courseAttendance({ ...base, sessions: [past, missing, future] }, now)
      .percent,
    null,
  );
  assert.equal(
    model.courseAttendance(
      {
        ...base,
        sessions: [past, { ...missing, status: "CANCELLED" }, future],
      },
      now,
    ).percent,
    100,
  );
  assert.equal(
    model.courseAttendance(
      { ...base, sessions: [past, { ...missing, credited_minutes: 0 }] },
      now,
    ).percent,
    50,
  );
});
await test("next class requires active enrollment and ignores cancelled or ended sessions", () => {
  assert.equal(
    model.nextClass([{ ...base, active: false, sessions: [future] }], now),
    null,
  );
  assert.equal(
    model.nextClass(
      [{ ...base, sessions: [past, { ...future, status: "CANCELLED" }] }],
      now,
    ),
    null,
  );
  assert.equal(
    model.nextClass([{ ...base, sessions: [future] }], now).session.id,
    "future",
  );
  assert.equal(model.courseStage(base, "2026-10-02"), "past");
});
await test("recommendations exclude own linked courses and prioritize the same academy", () => {
  const courses = [
    {
      id: "guide",
      offering_id: "offering",
      name: "Guide alias",
      academy: "기술",
    },
    { id: "offering", name: "Offering alias", academy: "기술" },
    { id: "same-title", name: "기초과정", academy: "기술" },
    { id: "other", name: "취미", academy: "문화" },
    { id: "related", name: "심화", academy: "기술" },
  ];
  assert.deepEqual(
    model.recommendCourses(courses, [base]).map((c) => [c.id, c.related]),
    [
      ["related", true],
      ["other", false],
    ],
  );
});
let calls = [],
  identity = true,
  response = { data: "id", error: null };
const mocks = {
  "@/lib/auth/session": {
    getSessionIdentity: async () => (identity ? { id: "self" } : null),
  },
  "@/lib/supabase/server": {
    createServerSupabaseClient: async () => ({
      rpc: async (name, args) => {
        calls.push({ name, args });
        return response;
      },
    }),
  },
  "next/cache": { revalidatePath: () => {} },
  "@/lib/portal/data": { UUID: /^[a-f0-9-]{36}$/i },
};
const actions = load("src/app/learning-request-actions.ts", mocks);
const form = (values = {}) => {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    org: "10000000-0000-4000-8000-000000000001",
    title: "새로운 학습",
    goal: "주말에 업무 자동화를 배우고 싶어요.",
    schedule: "토요일",
    ...values,
  }))
    f.set(k, v);
  return f;
};
await test("action rejects invalid input and unauthenticated calls before issuing RPC", async () => {
  for (const v of [
    { org: "bad" },
    { title: "x" },
    { goal: "short" },
    { schedule: "x".repeat(201) },
  ])
    assert(!(await actions.submitLearningRequest({}, form(v))).ok);
  identity = false;
  assert(!(await actions.submitLearningRequest({}, form())).ok);
  assert.equal(calls.length, 0);
  identity = true;
  assert((await actions.submitLearningRequest({}, form())).ok);
  assert.equal(calls.length, 1);
  assert(!("person" in calls[0].args));
  response = { error: { message: "RATE_LIMIT" } };
  assert(
    (await actions.submitLearningRequest({}, form())).message.includes("5건"),
  );
});
const portal = {
  dateTime: (v) => v,
  modeLabel: { OFFLINE: "대면" },
  statusLabel: { ACCEPTED: "수강 확정" },
  outcomeLabels: {},
};
const documentTypes = load("src/lib/learner-document-workflow/types.ts");
const approvedDocument = {
  id: "document-1", kind: "APPLICATION", offering_id: null,
  course_name: "도수물리치료인력양성과정", status: "APPROVED",
  submitted_at: "2026-09-23T11:44:00Z", current_note: "승인되었습니다.",
};
let documentResponse = { data: [approvedDocument], error: null };
const learningData = load("src/lib/student-learning/data.ts", {
  "@/lib/supabase/server": {
    createServerSupabaseClient: async () => ({
      rpc: async (name) => name === "life_my_learner_documents"
        ? documentResponse
        : { data: name === "life_my_learning" ? { courses: [], scholarships: [], organizations: [], requests: [] } : [], error: null },
    }),
  },
  "@/lib/course-guide/data": { getCourseCatalog: async () => ({ courses: [], unavailable: false }) },
});
await test("learning data loads own approved documents and preserves document-query failures", async () => {
  assert.deepEqual((await learningData.getStudentLearning()).documents, [approvedDocument]);
  documentResponse = { data: null, error: { message: "unavailable" } };
  assert.equal((await learningData.getStudentLearning()).documents, null);
  documentResponse = { data: [approvedDocument], error: null };
});
const Dashboard = load("src/components/student-learning/dashboard.tsx", {
  "next/link": "a",
  "@/components/navigation/menu-hint": menuHint,
  "@/components/instructor-documents/document-popup": {
    DocumentPopup: ({ children, href }) => React.createElement("a", { href }, children),
  },
  "@/lib/learner-documents/model": {
    applicationDocumentHref: (id) => `/mypage/documents?type=application&course=${id}`,
  },
  "@/components/student-learning/learning-record-journey": {
    LearningRecordJourney: () => null,
  },
  "@/components/portal/action-form": {
    ActionForm: ({ children, label }) =>
      React.createElement(
        "form",
        null,
        children,
        React.createElement("button", null, label),
      ),
  },
  "@/app/actions": { decideApplication: () => {} },
  "@/app/learning-request-actions": actions,
  "@/lib/attendance/model": attendance,
  "@/lib/portal/data": portal,
  "@/lib/portal/evaluation": portal,
  "@/lib/learner-document-workflow/types": documentTypes,
  "@/lib/student-learning/model": model,
}).StudentDashboard;
await test("empty, failed and populated screens keep distinct truthful states and useful navigation", () => {
  const render = (hub, documents = []) =>
    renderToStaticMarkup(
      React.createElement(Dashboard, {
        name: "김배움",
        data: {
          hub,
          history: [],
          surveys: [],
          documents,
          catalog: { courses: [], unavailable: false },
          now,
        },
      }),
    );
  const empty = render({
    courses: [],
    scholarships: [],
    organizations: [{ id: "org", name: "기관" }],
    requests: [],
  });
  assert(empty.includes("김배움님의 학습"));
  assert(empty.includes("새로운 배움을 시작"));
  assert(empty.includes("희망 과목 제안하기"));
  const failed = render(null);
  assert(failed.includes("학습 정보를 불러오지 못했습니다"));
  assert(!failed.includes("새로운 배움을 시작"));
  const full = render({
    courses: [{ ...base, sessions: [past, missing, future] }],
    scholarships: [
      {
        offering_id: "offering",
        name: "기초 과정",
        category: "장학금",
        amount: 120000,
        paid_on: "2026-09-20",
      },
    ],
    organizations: [],
    requests: [],
  });
  assert(full.includes("출석 확인 중"));
  assert(full.includes("120,000"));
  assert(full.includes("/learning/offering/attendance"));
  assert(full.includes("주차별 학습자료"));
  const approved = render({ courses: [], scholarships: [], organizations: [], requests: [] }, [approvedDocument]);
  assert(approved.includes("승인된 원서"));
  assert(approved.includes("도수물리치료인력양성과정"));
  assert(approved.includes("아직 수강 등록은 확인되지 않았습니다"));
  assert(approved.includes("내 강의실"));
  const documentsFailed = render({ courses: [], scholarships: [], organizations: [], requests: [] }, null);
  assert(documentsFailed.includes("원서 처리 현황을 불러오지 못했습니다"));
  assert(!documentsFailed.includes("제출한 수강신청원서가 없습니다"));
});
console.log(`${passed} student learning checks passed.`);
