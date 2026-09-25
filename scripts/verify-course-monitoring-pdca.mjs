import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as model from "../src/lib/course-monitoring/model.ts";

const { ANNUAL_MONTHS, monitoringProgress, monitoringSignal, overlapsMonth, parseGuidePeriod } = model;

const today = "2026-09-25";
const baseline = {
  plan_due_on: "2026-09-01", plan_done_on: "2026-09-01",
  preparation_due_on: "2026-08-01", preparation_done_on: "2026-08-01",
  operation_plan_due_on: "2026-08-15", operation_plan_done_on: "2026-08-15",
  recruitment_due_on: "2026-09-01", recruitment_done_on: "2026-09-01",
  delivery_starts_on: "2026-09-20", delivery_ends_on: "2026-10-20",
  check_due_on: "2026-10-27", check_done_on: null,
  act_due_on: "2026-11-03", act_done_on: null,
  next_year_decision: "UNDECIDED", blocked: false, issue_note: "", action_note: "",
  self_evaluation_target_count: 2, self_evaluation_first_on: null,
  self_evaluation_second_on: null, business_evaluation_on: null,
};
const actual = {
  id: "test", status: "PUBLISHED", starts_on: "2026-09-20", ends_on: "2026-10-20",
  scheduled_sessions: 4, ended_sessions: 1, enrolled: 10, attendance_recorded: 10,
  missing_attendance: 0, completion_pending: 0,
};
const approvedPlan = { id: "test", plan_status: "SUBMITTED", result_status: null };
assert.deepEqual(Object.fromEntries(Object.entries(monitoringProgress(baseline, actual, null))
  .map(([phase, value]) => [phase, value.percent])), { P: 0, D: 25, C: 0, A: 0 });
assert.equal(monitoringProgress(baseline, actual, approvedPlan).P.percent, 100);
assert.equal(monitoringProgress({ ...baseline, recruitment_done_on: null }, actual, approvedPlan).P.percent, 50);
assert.equal(monitoringProgress({ ...baseline, recruitment_done_on: null }, { ...actual, status: "CLOSED" }, approvedPlan).P.percent, 100);
assert.equal(monitoringProgress(baseline, { ...actual, attendance_recorded: 40 }, null).D.percent, 100);
assert.equal(monitoringProgress(baseline, { ...actual, enrolled: 50, attendance_recorded: 199 }, null).D.percent, 99);
assert.equal(monitoringProgress(baseline, { ...actual, attendance_recorded: 999 }, null).D.percent, 100);
assert.equal(monitoringProgress(baseline, { ...actual, enrolled: 0 }, null).D.percent, 0);
assert.equal(monitoringProgress(baseline, actual, { ...approvedPlan, result_status: "REVIEW" }).C.percent, 75);
assert.equal(monitoringProgress({ ...baseline, self_evaluation_first_on: today }, actual,
  { ...approvedPlan, result_status: "REVIEW" }).C.percent, 75);
assert.equal(monitoringProgress({ ...baseline, self_evaluation_first_on: today, self_evaluation_second_on: today }, actual,
  { ...approvedPlan, result_status: "REVIEW" }).C.percent, 100);
assert.equal(monitoringProgress({ ...baseline, self_evaluation_first_on: today }, actual, null).A.percent, 100);
assert.equal(monitoringProgress({ ...baseline, business_evaluation_on: today }, actual, null).A.percent, 100);

assert.deepEqual(parseGuidePeriod("2026.10.10–12.05", 2026),
  { start: "2026-10-10", end: "2026-12-05", tentativeMonth: null });
assert.deepEqual(parseGuidePeriod("2026년 12월 예정", 2026),
  { start: null, end: null, tentativeMonth: 12 });
assert.equal(overlapsMonth("2026-09-20", "2026-10-20", 2026, 9), true);
assert.equal(overlapsMonth("2026-09-20", "2026-10-20", 2026, 11), false);
assert.equal(ANNUAL_MONTHS.length, 14);
assert.equal(ANNUAL_MONTHS[0].key, "2026-01");
assert.equal(ANNUAL_MONTHS[12].key, "2027-01");
assert.equal(ANNUAL_MONTHS[13].key, "2027-02");
assert.equal(overlapsMonth("2026-12-20", "2027-02-05", 2027, 1), true);
assert.equal(monitoringSignal(null, null, today).signal, "unplanned");
assert.equal(monitoringSignal(baseline, actual, today, approvedPlan).signal, "normal");
assert.equal(monitoringSignal({ ...baseline, blocked: true, issue_note: "강사 섭외 지연" }, actual, today).signal, "blocked");
assert.equal(monitoringSignal({ ...baseline, preparation_due_on: null }, actual, today).signal, "unplanned");
assert.equal(monitoringSignal({ ...baseline, operation_plan_done_on: null }, actual, today).signal, "late");
assert.equal(monitoringSignal({ ...baseline, operation_plan_done_on: null }, actual, today, approvedPlan).signal, "normal");
assert.equal(monitoringSignal({ ...baseline, recruitment_done_on: null }, { ...actual, status: "CLOSED" }, today, approvedPlan).signal, "normal");
assert.equal(monitoringSignal({ ...baseline, recruitment_done_on: "2026-09-02" }, actual, today).signal, "late");
assert.equal(monitoringSignal({ ...baseline, act_done_on: today }, actual, today, approvedPlan).signal, "unplanned");
assert.equal(monitoringSignal({ ...baseline, act_done_on: today, next_year_decision: "REVISE", action_note: "차년도 개편" }, actual, today, approvedPlan).signal, "normal");
assert.equal(monitoringSignal(baseline, null, today).signal, "late");
assert.equal(monitoringSignal(baseline, { ...actual, status: "DRAFT" }, today).signal, "late");
assert.equal(monitoringSignal(baseline, { ...actual, starts_on: "2026-09-21" }, today).signal, "late");
assert.equal(monitoringSignal(baseline, { ...actual, ends_on: "2026-10-21" }, today).signal, "late");
assert.equal(monitoringSignal(baseline, { ...actual, scheduled_sessions: 0, ended_sessions: 0 }, today).signal, "late");
assert.equal(monitoringSignal({ ...baseline, delivery_ends_on: "2026-09-24", check_due_on: "2026-09-25" }, actual, today).signal, "late");
assert.equal(monitoringSignal({ ...baseline, delivery_ends_on: "2026-09-24", check_due_on: "2026-09-25" },
  { ...actual, ends_on: "2026-09-24", scheduled_sessions: 1, ended_sessions: 1 }, today,
  { id: "test", plan_status: "SUBMITTED", result_status: null }).signal, "normal");
assert.equal(monitoringSignal({ ...baseline, delivery_ends_on: "2026-09-24", check_due_on: "2026-09-25" },
  { ...actual, ends_on: "2026-09-24", scheduled_sessions: 1, ended_sessions: 1, attendance_recorded: 0 }, today,
  { id: "test", plan_status: "SUBMITTED", result_status: "SUBMITTED" }).signal, "late");
const completedDelivery = { ...actual, status: "ARCHIVED", ends_on: "2026-09-22",
  scheduled_sessions: 4, ended_sessions: 4, attendance_recorded: 40 };
const dueEvaluation = { ...baseline, delivery_ends_on: "2026-09-22", check_due_on: "2026-09-23",
  check_done_on: "2026-09-23", act_due_on: "2026-09-24" };
assert.match(monitoringSignal(dueEvaluation, completedDelivery, today,
  { ...approvedPlan, result_status: "REVIEW" }).reason, /C 과정별 성과평가/);
assert.match(monitoringSignal({ ...dueEvaluation, self_evaluation_first_on: "2026-09-23",
  self_evaluation_second_on: "2026-09-23" }, completedDelivery, today,
{ ...approvedPlan, result_status: "REVIEW" }).reason, /차년도 과정운영 판단/);

const require = createRequire(import.meta.url);
const source = readFileSync("src/components/admin/course-monitoring-plan-dashboard.tsx", "utf8");
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText;
const componentModule = { exports: {} };
new Function("require", "module", "exports", code)(name => {
  if (name === "next/link") return "a";
  if (name === "next/navigation") return { useRouter: () => ({ refresh() {} }) };
  if (name === "@/app/admin/monitoring/actions") return { saveMonitoringPlan: async () => ({ ok: false }) };
  if (name === "@/lib/course-monitoring/model") return model;
  return require(name);
}, componentModule, componentModule.exports);
const guides = Array.from({ length: 16 }, (_, index) => ({
  id: `2026-course-${index + 1}`, year: 2026, sort_order: index + 1,
  name: `과정 ${index + 1}`, academy: "라이프케어", period_label: "2026.09.01–10.15", offering_id: null,
}));
const html = renderToStaticMarkup(React.createElement(componentModule.exports.CourseMonitoringPlanDashboard, {
  guides, plans: [], documents: [], courses: [], today,
  summaryCards: React.createElement('div', null, '운영 현황 카드'),
}));
assert(html.includes("2026년 16개 과정 연간 일정"));
assert.equal((html.match(/>PDCA<\/button>/g) ?? []).length, 16);
assert(html.includes("&#x27;26.1월") && html.includes("&#x27;27.2월"));
assert(html.includes("운영계획서 제출") && html.includes("차년도 과정운영 반영"));
assert(html.includes("P 0%") && html.includes("D 0%") && html.includes("C 0%") && html.includes("A 0%"));
assert(html.includes("표시 과정 16 / 16개"));
assert(html.includes("계획전") && html.includes("16</strong>"));
assert(html.indexOf('진행 신호등') < html.indexOf('운영 현황 카드'));
assert(html.indexOf('운영 현황 카드') < html.indexOf('연간 PDCA 운영 흐름'));
console.log("검증 완료: 14개월·PDCA 실제 완성도·16개 과정 연간 일정 렌더링");
