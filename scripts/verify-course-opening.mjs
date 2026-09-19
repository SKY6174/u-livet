import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = new URL("../", import.meta.url);
const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const data = JSON.parse(read("docs/operations/2026-course-opening-plans.json"));
const previous = JSON.parse(read("src/lib/course-plan/data-2026.json"));

// Compile the actual modules, replacing only framework boundaries for this test.
function load(path, dependencies = {}) {
  const compiled = ts.transpileModule(read(path), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: path,
  }).outputText;
  const module = { exports: {} };
  const resolve = (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name);
  new Function("require", "module", "exports", compiled)(resolve, module, module.exports);
  return module.exports;
}
const oldModel = load("src/lib/course-plan/model.ts");
const model = load("src/lib/course-opening/model.ts", { "@/lib/course-plan/model": oldModel });
const { normalizeOpeningFilters, filterOpeningCourses } = model;
const all = normalizeOpeningFilters({});
const { CourseOpeningView } = load("src/components/course-plan/course-opening-view.tsx", {
  "@/lib/course-plan/model": oldModel,
  "@/lib/course-opening/model": model,
  "next/link": ({ children, ...props }) => React.createElement("a", props, children),
});
const render = (plan = data, filters = all) => renderToStaticMarkup(React.createElement(CourseOpeningView, { plan, filters }));
let checks = 0;
async function check(name, action) { await action(); checks++; console.log("PASS " + name); }

await check("16 plan documents reconcile without replacing the original 14-course source", () => {
  assert.equal(data.sources.length, 16);
  assert.equal(data.sources.reduce((sum, source) => sum + source.pages, 0), 122);
  assert.equal(new Set(data.courses.map((course) => course.sourceId)).size, 16);
  assert.equal(previous.courses.length, 14);
  assert.deepEqual(data.courses.filter((course) => !course.existingCourseId).map((course) => course.sourceId), ["P03", "P07", "P15"]);
  assert.equal(data.courses.filter((course) => course.existingCourseId).length, 13);
  assert.deepEqual(previous.courses.filter((course) => !data.courses.some((item) => item.existingCourseId === course.id)).map((course) => course.id), ["2026-life-care-06"]);
  for (const course of data.courses) {
    const source = data.sources.find((source) => source.id === course.sourceId);
    assert.ok(source);
    for (const page of Object.values(course.sourcePages)) assert.ok(page === null || (page >= 1 && page <= source.pages));
    if (course.existingCourseId) assert.ok(previous.courses.some((item) => item.id === course.existingCourseId));
  }
});
await check("Academy and total counts use 244 places / 541 hours from plans only", () => {
  assert.deepEqual(data.totals.academies.map((academy) => academy.courses), [0, 6, 6, 4]);
  for (const academy of data.totals.academies) {
    const courses = data.courses.filter((course) => course.academy === academy.academy);
    assert.equal(courses.length, academy.courses);
    assert.equal(courses.reduce((n, c) => n + c.capacity, 0), academy.capacity);
    assert.equal(courses.reduce((n, c) => n + c.teachingHours, 0), academy.hours);
  }
  assert.equal(data.courses.reduce((n, c) => n + c.capacity, 0), 244);
  assert.equal(data.courses.reduce((n, c) => n + c.teachingHours, 0), 541);
  for (const c of data.courses) {
    assert.equal(c.staff.teachers.reduce((n, p) => n + p.hours, 0), c.teachingHours);
    assert.equal(c.schedule.teachingHoursByDate.reduce((n, h) => n + h, 0), c.teachingHours);
    assert.equal(c.schedule.sessionDatesAsWritten.length, c.schedule.teachingHoursByDate.length);
  }
});
await check("No approved fee, schedule, policy or opening state is fabricated", () => {
  for (const c of data.courses) {
    assert.equal(c.approvalStatus, "PLAN_ONLY_NOT_OPENING_APPROVAL");
    assert.equal(c.schedule.confirmed, false);
    assert.equal(c.tuition.confirmedPerPerson, null);
    assert.equal(c.tuition.includesQualificationCosts, null);
    assert.ok(Object.values(c.missingOpeningConditions).every((value) => value === null));
  }
});
await check("Search handles Korean decomposition, staff, curriculum and combined coverage", () => {
  const search = (params) => filterOpeningCourses(data.courses, normalizeOpeningFilters(params));
  assert.equal(search({ q: "우철호" }).length, 2);
  assert.equal(search({ q: "김두영" }).length, 1);
  assert.equal(search({ q: "액자".normalize("NFD") }).length, 1);
  assert.equal(search({ coverage: "additional" }).length, 3);
  assert.equal(search({ coverage: "matched" }).length, 13);
  assert.equal(search({ academy: "로컬창업", coverage: "additional", affiliation: "INTERNAL" }).length, 1);
  assert.equal(search({ academy: "스마트테크" }).length, 0);
  assert.equal(search({ q: "존재하지 않는 과정" }).length, 0);
});
await check("Affiliation includes assistant instructors but never the coordinator or support staff", () => {
  const sample = structuredClone(data.courses[0]);
  sample.staff.teachers = [{ name: "강사", classification: "교외", affiliationAndPosition: "기관", hours: 30 }];
  sample.staff.assistantInstructors = [{ name: "보조강사", classification: "교내", affiliationAndPosition: "울산과학대학교", hours: 10 }];
  const internal = { ...all, affiliation: "INTERNAL" };
  assert.equal(filterOpeningCourses([sample], internal).length, 1);
  sample.staff.assistantInstructors = [];
  sample.facultyCoordinator = "교내 담당교수";
  sample.staff.supportStaff[0].classification = "교내";
  assert.equal(filterOpeningCourses([sample], internal).length, 0);
});
await check("Invalid and repeated URL values are ignored and queries are bounded", () => {
  assert.deepEqual(normalizeOpeningFilters({ q: ["bad"], academy: ["팝업"], affiliation: "constructor", coverage: ["additional"] }), all);
  assert.deepEqual(normalizeOpeningFilters({ academy: "unknown", coverage: "constructor" }), all);
  assert.equal(normalizeOpeningFilters({ q: " x ".repeat(101) }).q.length, 100);
});
await check("Server rendering preserves source conflicts, staff distinctions and source page references", () => {
  const html = render();
  assert.equal((html.match(/<article /g) ?? []).length, 16);
  for (const id of ["P05", "P08", "P10", "P11"]) assert.ok(html.includes(`id="${id}"`));
  for (const text of ["2025-08-05", "2026-10-06", "2026-11-03", "2,225,000원", "2,250,000원", "144,000원", "126,000원", "미기재", "미정 2명", "해당없음", "최종 금액 미확정", "PDF 물리 쪽수", "담당교수 (계획서)"]) assert.ok(html.includes(text), text);
  assert.ok(html.includes('/admin/course-plan#2026-life-care-06'));
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes('method="post"'));
});
await check("Empty filters and user/source strings render accessibly and safely", () => {
  const empty = render(data, normalizeOpeningFilters({ academy: "스마트테크" }));
  assert.ok(empty.includes("스마트테크 운영계획서가 제공되지 않았습니다"));
  assert.ok(!empty.includes("<article "));
  const hostile = structuredClone(data);
  hostile.courses[0].title = '<script>alert("unsafe")</script>';
  const html = render(hostile, { ...all, q: '<img src=x onerror="alert(1)">' });
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<img"));
  const sourceHtml = render(hostile);
  assert.ok(sourceHtml.includes("&lt;script&gt;"));
  assert.ok(!sourceHtml.includes("<script"));
});
await check("Actual loader enforces identity/MFA redirects and rejects non-managers before returning data", async () => {
  const loader = (requireIdentity) => load("src/lib/course-opening/server.ts", {
    "server-only": {},
    "next/navigation": { notFound: () => { throw new Error("NOT_FOUND"); } },
    "@/lib/auth/session": { requireIdentity },
    "../../../docs/operations/2026-course-opening-plans.json": data,
  }).getCourseOpeningPlan;
  for (const state of ["LOGIN_REQUIRED", "MFA_REQUIRED"]) {
    await assert.rejects(loader(async () => { throw new Error(state); })(), new RegExp(state));
  }
  await assert.rejects(loader(async () => ({ roles: [{ role: "SYSTEM_ADMIN" }] }))(), /NOT_FOUND/);
  assert.equal(await loader(async (returnTo) => {
    assert.equal(returnTo, "/admin/course-plan/opening");
    return { roles: [{ role: "COURSE_MANAGER" }] };
  })(), data);
  assert.match(read("src/lib/course-opening/server.ts"), /import "server-only"/);
});
console.log(`${checks} course-opening checks passed.`);
