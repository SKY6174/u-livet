import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const ANCHOR = "10000000-0000-4000-8000-000000000001";
const SANHAK = "ecf8450f-d89c-46fa-b47c-0db802c1d0c2";

function load(file, mocks = {}) {
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) => name in mocks ? mocks[name] : require(name), module, module.exports,
  );
  return module.exports;
}

const Link = ({ children, ...props }) => React.createElement("a", props, children);
const Dashboard = load("src/components/course-workspace/operations-dashboard.tsx", {
  "next/link": Link,
  "@/lib/course-budget/model": { budgetTotal: () => 0, won: () => "0" },
  "./budget-panel": { BudgetPanel: () => null },
}).OperationsDashboard;

let identity;
let expectedOrg;
const Page = load("src/app/admin/courses/page.tsx", {
  "next/link": Link,
  "next/navigation": { notFound: () => { throw Error("NOT_FOUND"); } },
  "@/lib/auth/session": { requireIdentity: async () => identity },
  "@/lib/course-workspace/data": { getCourseWorkspaces: async () => ({ courses: [], unavailable: false }) },
  "@/components/course-workspace/course-list": { CourseList: () => null },
  "@/components/course-workspace/operations-dashboard": { OperationsDashboard: Dashboard },
  "@/lib/course-budget/data": { getCourseBudgets: async (org) => {
    assert.equal(org, expectedOrg);
    return { courses: [{ id: "course", name: "검증 과정", academy: "검증", org_id: org, budget: { program_id: "P01" }, workspace: { id: "offering", status: "PUBLISHED" } }], workbooks: [], unavailable: false };
  } },
  "@/lib/course-budget/model": { mergeOperationCourses: (courses) => courses },
  "@/lib/supabase/server": { createServerSupabaseClient: async () => ({
    from: (table) => {
      assert.equal(table, "life_project_years");
      return { select: () => ({ in: async (_field, orgs) => {
        assert.deepEqual(orgs, [expectedOrg]);
        return { data: [] };
      } }) };
    },
    rpc: async () => ({ data: [], error: null }),
  }) },
  "@/components/portal/ui": {
    PageIntro: ({ title, children }) => React.createElement("header", null, title, children),
    Empty: ({ title }) => React.createElement("p", null, title),
  },
  "@/components/course-plan/offering-draft-form": { OfferingDraftForm: () => React.createElement("p", null, "등록 양식") },
  "@/lib/course-opening/server": { getCourseOpeningPlan: async () => { throw Error("Unexpected plan read"); } },
  "@/lib/course-opening/working-copy-server": { getOpeningWorkingCopy: async () => { throw Error("Unexpected copy read"); } },
  "@/lib/course-opening/prefill": { findOpeningCourse: () => null },
}).default;

async function render(roles, query = {}) {
  identity = { roles: roles.map(([role, org_id]) => ({ role, org_id })) };
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query) }));
}

expectedOrg = ANCHOR;
let html = await render([["COURSE_MANAGER", ANCHOR], ["COURSE_MANAGER", SANHAK]], { org: SANHAK });
assert(html.includes("울산과학대학교 앵커사업단"));
assert(!html.includes("name=\"org\""));
assert(!html.includes("02c1d0c2"));
for (const href of ["/admin/course-plan", "/admin/course-plan/opening", "/admin/development"])
  assert(html.includes(`href="${href}"`), href);
assert(html.indexOf("연간 계획에서 개설까지") < html.indexOf("과정 개발·심의"));
assert(!html.includes("/admin/messages") && !html.includes("/operation-documents/result"));
assert(!html.includes("결과보고서"));
const tabs = html.indexOf('aria-label="과정 관리 화면"');
const register = html.indexOf("새 과정 등록", tabs);
const views = html.indexOf('aria-label="보기 방식"', tabs);
assert(tabs >= 0 && register > tabs && register < views);
assert.match(html.slice(tabs, views), /href="\/admin\/courses\?org=10000000-0000-4000-8000-000000000001&amp;create=1#new-course"[^>]*bg-red-600|bg-red-600[^>]*href="\/admin\/courses\?org=10000000-0000-4000-8000-000000000001&amp;create=1#new-course"/);
assert(!html.includes("/operation-documents/offering/result"));
console.log("PASS anchor manager sees focused organization, grouped workflow and relocated red registration action");

expectedOrg = SANHAK;
html = await render([["COURSE_MANAGER", SANHAK]]);
assert(html.includes("02c1d0c2") && !html.includes("울산과학대학교 앵커사업단"));
console.log("PASS manager with only a separate organization retains authorized access");

expectedOrg = ANCHOR;
html = await render([["SYSTEM_ADMIN", ANCHOR]]);
assert(!html.includes("연간 계획에서 개설까지"));
assert(!html.includes("bg-red-600"));
console.log("PASS non-manager administrator cannot see course registration action");
