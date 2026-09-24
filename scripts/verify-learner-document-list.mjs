import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => name in mocks ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}
const types = load("src/lib/learner-document-workflow/types.ts");
const statuses = ["RECEIVED", "REVIEWING", "APPROVED", "COMPLETED", "REJECTED", "CANCELLED"];
const requests = statuses.map((status, index) => ({
  id: `10000000-0000-4000-8000-00000000000${index + 1}`, kind: ["APPLICATION", "SCHOLARSHIP", "REFUND"][index % 3],
  course_name: ["도수물리치료인력양성과정", "지역산업 연계 디지털 실무 역량 향상 과정", "스마트 제조 실무교육"][index % 3],
  applicant_name: `검증 수강생 ${index + 1}`, phone_masked: `010-****-000${index + 1}`,
  amount: index % 3 === 2 ? 250000 : null, status, revision: index + 1,
  submitted_at: "2026-09-23T11:44:00Z", current_note: index === 1 ? "증빙 확인 중입니다.\n확인 후 결과를 안내하겠습니다." : "접수된 서류를 확인했습니다.",
  events: [{ id: index + 1, to_status: status, created_at: "2026-09-23T11:44:00Z", actor_name: "검증 담당자", note: "합성 자료 처리 이력" }],
}));
let identity = { roles: ["COURSE_MANAGER"] };
let context = { requests };
let lastFilters;
let reads = 0;
let applyKindFilter = false;
const Page = load("src/app/admin/learner-documents/page.tsx", {
  "next/navigation": { notFound() { throw new Error("NOT_FOUND"); } },
  "@/components/portal/ui": { PageIntro: ({ title, children }) => React.createElement("div", null, React.createElement("h1", { className: "page-title" }, title), children) },
  "@/lib/auth/session": { requireIdentity: async () => { if (!identity) throw new Error("LOGIN_REQUIRED"); return identity; } },
  "@/lib/auth/workspace-navigation": { hasRole: (person, ...roles) => person.roles.some(role => roles.includes(role)) },
  "@/lib/learner-document-workflow/data": { getAdminLearnerDocuments: async filters => {
    reads++; lastFilters = filters;
    return applyKindFilter && context ? { requests: context.requests.filter(request => !filters.kind || request.kind === filters.kind) } : context;
  } },
  "@/lib/learner-document-workflow/types": types,
  "./actions": { updateLearnerDocumentStatus: "/synthetic-status-update" },
}).default;
const nodes = node => React.isValidElement(node) ? [node, ...React.Children.toArray(node.props.children).flatMap(nodes)] : [];
const render = params => Page({ searchParams: Promise.resolve(params) });
const tree = await render({ kind: "REFUND", status: "RECEIVED", q: "검증" });
const all = nodes(tree);
assert.deepEqual(lastFilters, { kind: "REFUND", status: "RECEIVED", query: "검증" });
assert.deepEqual(all.filter(node => node.type === "th" && node.props.scope === "col").map(node => node.props.children[0]),
  ["순번", "과정", "신청자", "신청시각", "처리 결과", "수강생 안내 내용", "첨부문서", "비고"]);
const tbody = all.find(node => node.type === "tbody");
const rows = React.Children.toArray(tbody.props.children);
assert.equal(rows.length, requests.length);
for (const [index, row] of rows.entries()) {
  const request = requests[index];
  const children = nodes(row);
  assert.equal(React.Children.toArray(row.props.children).length, 8);
  assert.equal(children.find(node => node.type === "td").props.children, index + 1);
  const pdf = children.find(node => node.type === "a");
  assert.equal(pdf.props.href, `/api/learner-documents/${request.id}/pdf`);
  assert.equal(pdf.props.target, "_blank");
  assert.equal(children.filter(node => node.type === "details").length, 1);
  const form = children.find(node => node.type === "form");
  const next = types.NEXT_DOCUMENT_STATUSES[request.status] ?? [];
  assert.equal(Boolean(form), next.length > 0);
  if (!form) {
    assert(!children.some(node => ["select", "textarea", "button"].includes(node.type)));
    continue;
  }
  const select = children.find(node => node.type === "select");
  const note = children.find(node => node.type === "textarea");
  assert.equal(select.props.form, form.props.id);
  assert.equal(note.props.form, form.props.id);
  assert.equal(select.props.required, true);
  assert.equal(note.props.required, true);
  assert.equal(note.props.maxLength, 1000);
  assert.equal(note.props.defaultValue, undefined);
  assert.deepEqual(React.Children.toArray(select.props.children).map(node => node.props.value).filter(Boolean), next);
  const fields = Object.fromEntries(nodes(form).filter(node => node.type === "input").map(node => [node.props.name, node.props.value]));
  assert.deepEqual(fields, { filter_kind: "REFUND", filter_status: "RECEIVED", filter_query: "검증", request_id: request.id, revision: request.revision });
}
for (const kind of ["", "APPLICATION", "SCHOLARSHIP", "REFUND"]) {
  const filtered = nodes(await render({ kind, status: "REVIEWING", q: "가 나" }));
  const links = filtered.filter(node => node.type === "a" && node.props.href?.startsWith("/admin/learner-documents"));
  assert.equal(links.length, 4);
  assert.deepEqual(links.filter(node => node.props["aria-current"] === "page").map(node => node.props.children),
    [{ "": "전체", APPLICATION: "수강신청", SCHOLARSHIP: "장학금신청", REFUND: "환불신청" }[kind]]);
  for (const [index, value] of ["", "APPLICATION", "SCHOLARSHIP", "REFUND"].entries()) {
    const target = new URL(links[index].props.href, "http://localhost");
    assert.equal(target.searchParams.get("kind"), value || null);
    assert.equal(target.searchParams.get("status"), "REVIEWING");
    assert.equal(target.searchParams.get("q"), "가 나");
  }
  assert.deepEqual(filtered.filter(node => node.type === "input" && node.props.name === "kind").map(node => node.props.value), [kind]);
}
applyKindFilter = true;
for (const kind of ["", "APPLICATION", "SCHOLARSHIP", "REFUND"]) {
  const filtered = nodes(await render({ kind }));
  const filteredRows = React.Children.toArray(filtered.find(node => node.type === "tbody").props.children);
  assert.equal(filteredRows.length, kind ? requests.filter(request => request.kind === kind).length : requests.length);
}
applyKindFilter = false;
await render({ kind: "INVALID", status: "INVALID", q: "  검증  " });
assert.deepEqual(lastFilters, { kind: null, status: null, query: "검증" });
const before = reads;
for (const person of [null, { roles: ["INSTRUCTOR"] }, { roles: [] }]) {
  identity = person;
  await assert.rejects(render({}), /NOT_FOUND|LOGIN_REQUIRED/);
}
assert.equal(reads, before);
identity = { roles: ["FINANCE"] };
context = null;
assert(renderToStaticMarkup(await render({})).includes("자료를 불러오지 못했습니다"));
context = { requests: [] };
assert(renderToStaticMarkup(await render({})).includes("조건에 맞는 접수 문서가 없습니다"));
context = { requests };
const html = renderToStaticMarkup(await render({}));
assert(html.includes("250,000원"));
assert(html.includes("증빙 확인 중입니다."));
if (process.argv.includes("--preview")) {
  const dir = "tmp/learner-document-list";
  mkdirSync(dir, { recursive: true });
  const cssDir = ".next/static/css";
  const css = readdirSync(cssDir).filter(file => file.endsWith(".css")).map(file => readFileSync(`${cssDir}/${file}`, "utf8")).join("\n");
  writeFileSync(`${dir}/style.css`, css);
  writeFileSync(`${dir}/index.html`, `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>접수 문서 합성 자료 검증</title><link rel="stylesheet" href="/style.css"></head><body>${html}</body></html>`);
  console.log(`Synthetic UI preview: ${dir}/index.html`);
}
console.log("PASS: 8 columns, per-request form ownership, transitions, terminal rows, PDF/history, immediate kind links, filtered rows and authorization; synthetic data only.");
