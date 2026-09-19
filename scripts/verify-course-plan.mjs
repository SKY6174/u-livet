import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const data = JSON.parse(readFileSync(new URL("src/lib/course-plan/data-2026.json", root), "utf8"));
const modelSource = readFileSync(new URL("src/lib/course-plan/model.ts", root), "utf8");
const compiled = ts.transpileModule(modelSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { filterCourses, sumCourses, normalizeFilters, formatSourceNumber, formatSourceText } =
  await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
let checks = 0;
function check(name, action) {
  action();
  checks++;
  console.log("PASS " + name);
}
const all = normalizeFilters({});
check("PDF has 14 detailed courses, with no invented Smart Tech course", () => {
  assert.equal(data.courses.length, 14);
  assert.deepEqual(data.academySummaries.map((s) => data.courses.filter((c) => c.academy === s.academy).length), [0, 7, 4, 3]);
  assert.equal(new Set(data.courses.map((c) => c.id)).size, 14);
});
check("Every source title and course order is preserved", () => {
  assert.deepEqual(data.courses.map((c) => c.title), [
    "도수물리치료인력양성과정", "산과필라테스자격증과정", "실버푸드전문가과정",
    "건강식생활지도사", "파크골프지도사양성과정", "재활운동지도사 자격증과정",
    "스포츠테이핑관리사(자격증)양성과정", "로컬쿠키창업마스터클래스",
    "반려동물수제간식만들기", "반려동물행동교정사3급양성과정", "애견미용사3급양성과정",
    "가구소품전문시공인력양성과정", "도배전문시공인력양성과정", "인테리어목공전문인력양성과정",
  ]);
});
check("Detailed totals differ from PDF totals without overwriting either", () => {
  assert.deepEqual(sumCourses(data.courses), { count: 14, capacity: 212, hours: 523, budget: 109608320 });
  assert.equal(data.total.capacity, 267);
  assert.equal(data.total.hours, 543);
  assert.deepEqual(data.academySummaries.map((s) => s.capacity), [15, 114, 76, 62]);
  assert.deepEqual(data.academySummaries.map((s) => sumCourses(data.courses.filter((c) => c.academy === s.academy)).capacity), [0, 114, 56, 42]);
});
check("All six budget columns match the PDF total", () => {
  const expected = { materials: 21265800, printing: 2915000, instructors: 53470000, operations: 8203000, support: 4067220, scholarships: 19687300 };
  for (const [key, total] of Object.entries(expected)) {
    assert.equal(data.total.budget[key], total);
    assert.equal(data.courses.reduce((n, c) => n + (typeof c.budget[key] === "number" ? c.budget[key] : 0), 0), total);
  }
});
check("Each course and academy budget reconciles with its source total", () => {
  for (const c of data.courses) {
    assert.equal(Object.entries(c.budget).reduce((n, [k, v]) => n + (k !== "total" && typeof v === "number" ? v : 0), 0), c.budget.total, c.title);
  }
  for (const s of data.academySummaries.filter((s) => s.academy !== "스마트테크")) {
    assert.equal(sumCourses(data.courses.filter((c) => c.academy === s.academy)).budget, s.budget.total);
  }
});
check("Recruitment and completion blanks remain unknown", () => {
  assert.ok(data.courses.every((c) => c.recruited === null && c.completed === null));
  assert.equal(formatSourceNumber(null, "명"), "미기재");
  assert.equal(formatSourceNumber(0, "명"), "0명");
});
check("Blank, dash and undecided staffing remain distinct", () => {
  assert.equal(data.courses[0].supportStaff.sourceText, "미정");
  assert.equal(data.courses[1].supportStaff.sourceText, "-");
  assert.equal(data.courses[9].supportStaff.sourceText, null);
  assert.equal(formatSourceText(null), "미기재");
  assert.equal(formatSourceText("-"), "- (원문 표기)");
  assert.equal(formatSourceText("미정"), "미정");
  assert.equal(data.academySummaries[3].budget.printing, null);
  assert.equal(data.courses[11].budget.printing, "-");
});
check("Teacher affiliations are not inferred, including source placeholders A/B", () => {
  assert.ok(data.courses.every((c) => [...c.instructors.members, ...c.assistantInstructors.members].every((p) => p.affiliation === "UNCONFIRMED")));
  assert.equal(data.courses[7].instructors.members.at(-1).name, "A");
  assert.equal(data.courses[7].assistantInstructors.members.at(-1).name, "B");
  assert.deepEqual(data.courses[3].supportStaff.members.map((p) => p.name), ["김태호", "박규태", "강민석"]);
});
check("Date normalization preserves source dates and declared hours", () => {
  for (const c of data.courses) {
    const dates = c.schedule.sourcePeriod.split("~").map((v) => "20" + v.replace(/\.$/, "").replaceAll(".", "-"));
    assert.deepEqual(dates, [c.schedule.startDate, c.schedule.endDate]);
    assert.ok(dates[0] <= dates[1]);
    assert.equal(new Date(dates[0]).toISOString().slice(0, 10), dates[0]);
    assert.equal(new Date(dates[1]).toISOString().slice(0, 10), dates[1]);
  }
  assert.equal(data.courses[5].hours, 48);
  assert.equal(data.courses[5].schedule.weekdays, "월~금");
});
check("Academy filters and empty categories", () => {
  assert.equal(filterCourses(data.courses, all).length, 14);
  assert.equal(filterCourses(data.courses, { ...all, academy: "로컬창업" }).length, 4);
  assert.equal(filterCourses(data.courses, { ...all, academy: "스마트테크" }).length, 0);
});
check("Search supports names, assistant staff, qualifications and Korean normalization", () => {
  assert.equal(filterCourses(data.courses, { ...all, q: "우철호" }).length, 2);
  assert.equal(filterCourses(data.courses, { ...all, q: "김두영" }).length, 1);
  assert.equal(filterCourses(data.courses, { ...all, q: "도배시공사".normalize("NFD") }).length, 1);
  assert.equal(filterCourses(data.courses, { ...all, q: "없는 과정" }).length, 0);
});
check("Combined filters do not match unrelated staffing roles", () => {
  const sample = structuredClone(data.courses[0]);
  sample.instructors.members[0].affiliation = "INTERNAL";
  sample.assistantInstructors.members[0].affiliation = "EXTERNAL";
  assert.equal(filterCourses([sample], { ...all, affiliation: "INTERNAL" }).length, 1);
  assert.equal(filterCourses([sample], { ...all, affiliation: "EXTERNAL" }).length, 1);
  assert.equal(filterCourses([sample], { ...all, affiliation: "EXTERNAL", academy: "팝업" }).length, 0);
  sample.instructors.members.forEach((p) => p.affiliation = "UNCONFIRMED");
  sample.assistantInstructors.members.forEach((p) => p.affiliation = "UNCONFIRMED");
  sample.supportStaff.members = [{ name: "보조인력 예시", affiliation: "INTERNAL" }];
  assert.equal(filterCourses([sample], { ...all, affiliation: "INTERNAL" }).length, 0);
});
check("URL inputs are bounded and invalid/multi-value filters are ignored", () => {
  assert.deepEqual(normalizeFilters({ q: ["bad"], academy: "unknown", affiliation: "constructor" }), all);
  assert.equal(normalizeFilters({ q: "  필라테스  " }).q, "필라테스");
  assert.equal(normalizeFilters({ q: "a".repeat(200) }).q.length, 100);
});
check("Data access stays server-only and checks course-manager identity", () => {
  const source = readFileSync(new URL("src/lib/course-plan/server.ts", root), "utf8");
  assert.match(source, /import "server-only"/);
  assert.ok(source.indexOf("await requireIdentity") < source.indexOf("return data"));
  assert.match(source, /COURSE_MANAGER/);
  assert.match(source, /notFound\(\)/);
});
console.log(checks + " course-plan checks passed. Source: " + fileURLToPath(new URL("src/lib/course-plan/data-2026.json", root)));
