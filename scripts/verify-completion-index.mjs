import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => name in mocks ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}

let checks = 0;
async function test(name, run) {
  await run();
  checks++;
  console.log("PASS " + name);
}

const prefilled = load("src/lib/operation-documents/prefilled-data.ts");
const completionOfferings = load("src/lib/completion/offerings.ts", {
  "@/lib/operation-documents/prefilled-data": prefilled,
});
let me = { roles: [{ role: "COURSE_MANAGER", org_id: "10000000-0000-4000-8000-000000000001" }] };
let unavailable = false;
let offerings = prefilled.PREFILLED_COURSES.slice(0, 3).map((course, index) => ({
  id: `00000000-0000-4000-8000-00000000000${index + 1}`,
  org_id: me.roles[0].org_id,
  name: course.title,
  status: index === 0 ? "PUBLISHED" : "ARCHIVED",
  capacity: course.capacity,
  year_label: "2차년도 · 2026",
  starts_on: course.startsOn,
  ends_on: course.endsOn,
}));
const notFound = () => { throw new Error("NOT_FOUND"); };
const icon = props => React.createElement("span", props);
const nav = {
  hasRole: (identity, ...roles) => identity.roles.some(entry => roles.includes(entry.role)),
};
const page = load("src/app/completion/page.tsx", {
  "next/link": "a",
  "next/navigation": { notFound },
  "lucide-react": { BookOpenCheck: icon, DatabaseZap: icon },
  "@/components/portal/ui": { PageIntro: ({ title, children }) => React.createElement("header", null, React.createElement("h1", null, title), children) },
  "@/lib/auth/session": { requireIdentity: async () => me },
  "@/lib/auth/workspace-navigation": nav,
  "@/lib/completion/offerings": completionOfferings,
  "@/lib/operation-documents/prefilled-data": prefilled,
  "@/lib/portal/data": {
    statusLabel: { PUBLISHED: "모집 공개", ARCHIVED: "운영 완료 · 보고서 보관" },
    getWorkspaceOfferings: async () => ({ offerings, unavailable }),
  },
});

await test("the 16 planned courses merge with registered offerings without duplicates", () => {
  const merged = completionOfferings.mergeCompletionOfferings(offerings);
  assert.equal(merged.length, 16);
  assert.equal(merged.filter(course => course.registered).length, 3);
  assert.deepEqual(merged.slice(0, 3).map(course => course.id), offerings.map(offering => offering.id));
});

await test("database-only offerings remain visible after the planned courses", () => {
  const extra = { ...offerings[0], id: "00000000-0000-4000-8000-000000000099", name: "DB 추가 운영 과정", starts_on: "2026-12-01" };
  const merged = completionOfferings.mergeCompletionOfferings([...offerings, extra]);
  assert.equal(merged.length, 17);
  assert.equal(merged.at(-1).id, extra.id);
  assert.equal(new Set(merged.map(course => course.id)).size, 17);
});

await test("course managers see every course and registration actions for missing rows", async () => {
  me = { roles: [{ role: "COURSE_MANAGER", org_id: offerings[0].org_id }] };
  unavailable = false;
  const output = renderToStaticMarkup(await page.default());
  assert(output.includes("전체 운영 대상"));
  assert.equal((output.match(/href="\/completion\//g) ?? []).length, 3);
  assert.equal((output.match(/href="\/admin\/courses\?plan=P/g) ?? []).length, 13);
  for (const course of prefilled.PREFILLED_COURSES) assert(output.includes(course.title), course.title);
});

await test("certifiers see missing courses without manager registration links", async () => {
  me = { roles: [{ role: "CERTIFIER", org_id: offerings[0].org_id }] };
  const output = renderToStaticMarkup(await page.default());
  assert.equal((output.match(/href="\/completion\//g) ?? []).length, 3);
  assert(!output.includes("/admin/courses?plan="));
  assert(output.includes("과정담당이 DB에 등록하면"));
});

await test("database failure keeps the planned list visible but disables review links", async () => {
  me = { roles: [{ role: "COURSE_MANAGER", org_id: offerings[0].org_id }] };
  unavailable = true;
  const output = renderToStaticMarkup(await page.default());
  assert(output.includes("DB 등록 상태를 불러오지 못해"));
  assert.equal((output.match(/href="\/completion\//g) ?? []).length, 0);
  assert.equal((output.match(/과정 등록 필요/g) ?? []).length >= 16, true);
});

await test("users without completion roles remain denied", async () => {
  me = { roles: [{ role: "INSTRUCTOR", org_id: offerings[0].org_id }] };
  await assert.rejects(page.default(), /NOT_FOUND/);
});

console.log(`${checks} completion index checks passed; synthetic identities only, no DB writes.`);
