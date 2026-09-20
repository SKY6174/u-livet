import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const plan = JSON.parse(read("docs/operations/2026-course-opening-plans.json"));
function load(path, dependencies = {}) {
  const code = ts.transpileModule(read(path), {
    fileName: path,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)((name) => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), module, module.exports);
  return module.exports;
}
const prefill = load("src/lib/course-opening/prefill.ts");
const oldModel = load("src/lib/course-plan/model.ts");
const openingModel = load("src/lib/course-opening/model.ts", { "@/lib/course-plan/model": oldModel });
const Link = ({ children, ...props }) => React.createElement("a", props, children);
const createOffering = () => { throw new Error("Rendering must not save an offering"); };
const { OfferingDraftForm } = load("src/components/course-plan/offering-draft-form.tsx", {
  "./working-copy-form": { WorkingCopyForm: ({ children }) => React.createElement("form", {}, children) },
  "next/link": Link,
  "@/app/actions": { createOffering },
  "@/lib/course-opening/prefill": prefill,
  "@/lib/course-plan/model": oldModel,
  "@/components/portal/action-form": { ActionForm: ({ action, children, label }) => {
    assert.equal(action, createOffering);
    return React.createElement("form", {}, children, React.createElement("button", { type: "submit" }, label));
  } },
});
const years = [{ id: "year-2026", label: "2026 사업연도" }];
const render = (course) => renderToStaticMarkup(React.createElement(OfferingDraftForm, { orgId: "test-org", years, plan: course }));
const input = (html, name) => html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0] ?? "";
const select = (html, name) => html.match(new RegExp(`<select[^>]*name="${name}"[^>]*>[\\s\\S]*?</select>`))?.[0] ?? "";
let checks = 0;
async function check(name, action) { await action(); checks++; console.log("PASS " + name); }

await check("All 16 plans map only the six editable content fields within form limits", () => {
  const snapshot = JSON.stringify(plan);
  for (const course of plan.courses) {
    assert.equal(prefill.findOpeningCourse(plan, course.sourceId), course);
    const values = prefill.createOfferingPrefill(course);
    assert.deepEqual(Object.keys(values), ["title", "academy", "capacity", "location", "summary", "curriculum"]);
    assert.equal(values.title, course.title);
    assert.equal(values.capacity, course.capacity);
    assert.equal(values.location, course.schedule.location);
    assert.equal(values.summary, course.summaryFromPlan);
    for (const item of course.curriculumFromPlan) assert.ok(values.curriculum.includes(item));
    assert.ok(values.curriculum.includes(course.targetAsPlanned));
    assert.ok(values.curriculum.includes("실제 지원자격"));
    for (const [field, max] of Object.entries({ title: 200, academy: 100, location: 200, summary: 3000, curriculum: 20000 })) {
      assert.ok(values[field].length > 0 && values[field].length <= max, course.sourceId + field);
    }
    assert.ok(!values.curriculum.includes(course.facultyCoordinator));
    assert.ok(!values.curriculum.includes("2025-"));
  }
  assert.equal(JSON.stringify(plan), snapshot);
});
await check("Unknown, multi-value and injected plan identifiers never select a course", () => {
  for (const value of [undefined, null, "", "p01", "P00", "P17", ["P01"], { sourceId: "P01" }, "P01&mode=ONLINE", "<script>", "x".repeat(10000)]) {
    assert.equal(prefill.findOpeningCourse(plan, value), undefined);
  }
});
await check("Prefilled form is editable while all seven undecided required values start empty", () => {
  for (const course of plan.courses) {
    const html = render(course);
    assert.match(html, /id="offering-draft" open=""/);
    assert.match(input(html, "capacity"), new RegExp(`value="${course.capacity}"`));
    assert.ok(!input(html, "title").includes("readOnly"));
    for (const name of ["year", "mode", "selection_method"]) {
      assert.match(select(html, name), /required=""/);
      assert.match(select(html, name), /<option value="" disabled="" selected="">/);
    }
    for (const name of ["apply_from", "apply_until", "starts_on", "ends_on"]) {
      assert.match(input(html, name), /required=""/);
      assert.ok(!input(html, name).includes("value="), name);
    }
    for (const name of ["fee", "tuition", "instructor", "sourceId"]) assert.equal(input(html, name), "");
    assert.ok(html.includes("아직 저장되지 않았으며"));
    assert.ok(html.includes(`/admin/course-plan/opening#${course.sourceId}`));
    assert.ok(html.includes("기수 초안은 무료로 등록됩니다"));
  }
});
await check("Reference retains known source conflicts without making them submitted defaults", () => {
  for (const [id, snippets] of Object.entries({ P05: ["2026-10-06", "2026-11-03"], P08: ["2025-08-05", "2026-08-05"], P10: ["2,225,000", "2,250,000"], P11: ["42시간", "48시간", "144,000원"] })) {
    const html = render(prefill.findOpeningCourse(plan, id));
    for (const text of snippets) assert.ok(html.includes(text), id + text);
  }
});
await check("Manual registration keeps its existing defaults and closed panel", () => {
  const html = render();
  assert.ok(!html.includes('id="offering-draft" open=""'));
  assert.ok(!html.includes("불러온 운영계획서"));
  assert.match(select(html, "mode"), /value="OFFLINE" selected=""/);
  assert.match(select(html, "selection_method"), /value="REVIEW" selected=""/);
});
await check("All 16 review cards link to their own registration form without a write action", () => {
  const { CourseOpeningView } = load("src/components/course-plan/course-opening-view.tsx", {
    "next/link": Link, "@/lib/course-plan/model": oldModel, "@/lib/course-opening/model": openingModel,
  });
  const html = renderToStaticMarkup(React.createElement(CourseOpeningView, { plan, filters: openingModel.normalizeOpeningFilters({}) }));
  for (const course of plan.courses) assert.ok(html.includes(`/admin/courses?plan=${course.sourceId}#offering-draft`));
  assert.ok(!html.includes('method="post"'));
});
await check("Admin route checks identity and role before loading a plan, and handles invalid IDs", async () => {
  let reads = 0;
  const makePage = (requireIdentity) => load("src/app/admin/courses/page.tsx", {
    "@/lib/auth/workspace-navigation": { courseOperationLinks: [] },
    "next/link": Link,
    "next/navigation": { notFound: () => { throw new Error("NOT_FOUND"); } },
    "@/lib/auth/session": { requireIdentity },
    "@/lib/course-opening/working-copy-server": { getOpeningWorkingCopy: async () => ({ copy: null, unavailable: false }) },
    "@/lib/course-opening/server": { getCourseOpeningPlan: async () => { reads++; return plan; } },
    "@/lib/course-opening/prefill": prefill,
    "@/components/course-plan/offering-draft-form": { OfferingDraftForm },
    "@/lib/course-workspace/data": { getCourseWorkspaces: async () => ({ courses: [], unavailable: false }) },
    "@/components/course-workspace/course-list": { CourseList: () => null },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => ({ from: (table) => {
      assert.equal(table, "life_project_years");
      return { select: () => ({ in: async () => ({ data: [{ ...years[0], org_id: "test-org" }, { id: "other-year", label: "타기관", org_id: "other-org" }] }) }) };
    } }) },
    "@/components/portal/ui": { PageIntro: ({ children }) => React.createElement("div", {}, children), Empty: () => null },
  }).default;
  await assert.rejects(makePage(async () => { throw new Error("LOGIN_REQUIRED"); })({ searchParams: Promise.resolve({ plan: "P01" }) }), /LOGIN_REQUIRED/);
  await assert.rejects(makePage(async () => ({ roles: [{ role: "SYSTEM_ADMIN" }] }))({ searchParams: Promise.resolve({ plan: "P01" }) }), /NOT_FOUND/);
  assert.equal(reads, 0);
  const admin = makePage(async () => ({ roles: [{ role: "COURSE_MANAGER", org_id: "test-org" }] }));
  for (const value of ["", "P17", ["P01"]]) await assert.rejects(admin({ searchParams: Promise.resolve({ plan: value }) }), /NOT_FOUND/);
  const tree = await admin({ searchParams: Promise.resolve({ plan: "P08", title: "injected", year: "other-year" }) });
  const findForm = (node) => {
    if (node?.type === OfferingDraftForm) return node;
    return React.Children.toArray(node?.props?.children).map(findForm).find(Boolean);
  };
  const form = findForm(tree);
  const registration = React.Children.toArray(tree.props.children).find((child) => child.props?.id === "new-course");
  assert.equal(registration.props.open, true);
  assert.equal(form.props.plan.sourceId, "P08");
  assert.ok(form.key.includes("P08"));
  assert.deepEqual(form.props.years, years);
  assert.equal(form.props.orgId, "test-org");
  const before = reads;
  const manual = await admin({ searchParams: Promise.resolve({}) });
  assert.equal(reads, before);
  assert.equal(findForm(manual).props.plan, undefined);
  assert.equal(React.Children.toArray(manual.props.children).find((child) => child.props?.id === "new-course").props.open, false);
  const create = await admin({ searchParams: Promise.resolve({ create: "1" }) });
  assert.equal(React.Children.toArray(create.props.children).find((child) => child.props?.id === "new-course").props.open, true);
});
console.log(`${checks} course-opening prefill checks passed.`);
