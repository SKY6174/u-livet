import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as model from "../src/lib/course-monitoring/model.ts";

const { monitoringSignal, overlapsMonth, parseGuidePeriod } = model;

const today = "2026-09-25";
const baseline = {
  plan_due_on: "2026-09-01", plan_done_on: "2026-09-01",
  delivery_starts_on: "2026-09-20", delivery_ends_on: "2026-10-20",
  check_due_on: "2026-10-27", check_done_on: null,
  act_due_on: "2026-11-03", act_done_on: null,
  blocked: false, issue_note: "", action_note: "",
};
const actual = {
  id: "test", status: "PUBLISHED", starts_on: "2026-09-20", ends_on: "2026-10-20",
  scheduled_sessions: 4, ended_sessions: 1, missing_attendance: 0, completion_pending: 0,
};

assert.deepEqual(parseGuidePeriod("2026.10.10–12.05", 2026),
  { start: "2026-10-10", end: "2026-12-05", tentativeMonth: null });
assert.deepEqual(parseGuidePeriod("2026년 12월 예정", 2026),
  { start: null, end: null, tentativeMonth: 12 });
assert.equal(overlapsMonth("2026-09-20", "2026-10-20", 2026, 9), true);
assert.equal(overlapsMonth("2026-09-20", "2026-10-20", 2026, 11), false);
assert.equal(monitoringSignal(null, null, today).signal, "unplanned");
assert.equal(monitoringSignal(baseline, actual, today).signal, "normal");
assert.equal(monitoringSignal({ ...baseline, blocked: true, issue_note: "강사 섭외 지연" }, actual, today).signal, "blocked");
assert.equal(monitoringSignal({ ...baseline, plan_done_on: null }, actual, today).signal, "late");
assert.equal(monitoringSignal({ ...baseline, plan_done_on: "2026-09-02" }, actual, today).signal, "late");
assert.equal(monitoringSignal(baseline, null, today).signal, "late");
assert.equal(monitoringSignal(baseline, { ...actual, status: "DRAFT" }, today).signal, "late");
assert.equal(monitoringSignal(baseline, { ...actual, starts_on: "2026-09-21" }, today).signal, "late");
assert.equal(monitoringSignal(baseline, { ...actual, ends_on: "2026-10-21" }, today).signal, "late");
assert.equal(monitoringSignal(baseline, { ...actual, scheduled_sessions: 0, ended_sessions: 0 }, today).signal, "late");
assert.equal(monitoringSignal({ ...baseline, delivery_ends_on: "2026-09-24", check_due_on: "2026-09-25" }, actual, today).signal, "late");
assert.equal(monitoringSignal({ ...baseline, delivery_ends_on: "2026-09-24", check_due_on: "2026-09-25" },
  { ...actual, scheduled_sessions: 1, ended_sessions: 1 }, today, { id: "test", plan_status: "SUBMITTED", result_status: null }).signal, "late");

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
}));
assert(html.includes("2026년 16개 과정 연간 일정"));
assert.equal((html.match(/>PDCA<\/button>/g) ?? []).length, 16);
assert(html.includes("12월") && html.includes("1월"));
assert(html.includes("표시 과정 16 / 16개"));
assert(html.includes("계획전") && html.includes("16</strong>"));
console.log("검증 완료: 기간·신호등 16건, 16개 과정 연간 일정 렌더링");
