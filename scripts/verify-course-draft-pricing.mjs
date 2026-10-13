import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}
const model = load("src/lib/course-opening/working-copy.ts");
const legacy = Object.fromEntries(Object.keys(model.OPENING_FIELDS).filter(k => !["fee_type", "tuition"].includes(k)).map(k => [k, ""]));
assert(model.validOpeningValues(legacy));
assert.equal(model.draftTuition(legacy), 0);
for (const amount of ["1", "150000", "100000000"]) {
  const payload = { ...legacy, fee_type: "PAID", tuition: amount };
  assert(model.validOpeningValues(payload));
  assert.equal(model.draftTuition(payload), Number(amount));
}
assert(model.validOpeningValues({ ...legacy, fee_type: "PAID", tuition: "" }));
assert.equal(model.draftTuition({ fee_type: "PAID", tuition: "" }), null);
for (const amount of ["0", "-1", "1.5", "1e3", "1,000", "100000001", "9999999999"]) assert(!model.validOpeningValues({ ...legacy, fee_type: "PAID", tuition: amount }));
for (const patch of [{ fee_type: "FREE", tuition: "100" }, { fee_type: "paid", tuition: "100" }, { tuition: "100" }, { fee_type: null }, { tuition: 100 }, { extra: "" }]) assert(!model.validOpeningValues({ ...legacy, ...patch }));
console.log("PASS price bounds, incomplete paid copies, free mismatch and legacy compatibility");

const org = "10000000-0000-4000-8000-000000000001", calls = [];
const { createOffering } = load("src/app/actions.ts", {
  "next/cache": { revalidatePath: () => {} }, "@/lib/auth/mfa-message": { MFA_REAUTH_MESSAGE: "MFA" },
  "@/lib/course-guide/locations": load("src/lib/course-guide/locations.ts"),
  "@/lib/portal/data": { UUID: /^[0-9a-f-]{36}$/i }, "@/lib/course-opening/working-copy": model,
  "@/lib/auth/session": { getSessionIdentity: async () => ({ roles: [{ role: "COURSE_MANAGER", org_id: org }] }) },
  "@/lib/supabase/server": { createServerSupabaseClient: async () => ({ rpc: async (name, args) => { calls.push({ name, args }); return { error: null }; } }) },
});
const complete = { ...legacy, org, year: org, title: "검증 과정", academy: "로컬창업 아카데미", summary: "소개", curriculum: "교육", mode: "OFFLINE", location: "강의실", capacity: "20", selection_method: "REVIEW", apply_from: "2026-10-01T09:00", apply_until: "2026-10-02T18:00", starts_on: "2026-10-03", ends_on: "2026-10-04" };
const form = patch => { const f = new FormData(); Object.entries({ ...complete, ...patch }).forEach(([k, v]) => f.set(k, v)); return f; };
assert((await createOffering({}, form({ fee_type: "PAID", tuition: "150000", source: "P01" }))).ok);
assert.equal(calls.at(-1).name, "life_create_offering_with_tuition");
assert.equal(calls.at(-1).args.tuition, 150000);
assert.equal(calls.at(-1).args.source_id, "P01");
assert((await createOffering({}, form({}))).ok);
assert.equal(calls.at(-1).args.tuition, 0);
assert.equal(calls.at(-1).args.source_id, null);
const before = calls.length;
for (const tuition of ["", "0", "-1", "1.5", "100000001"]) assert(!(await createOffering({}, form({ fee_type: "PAID", tuition }))).ok);
assert(!(await createOffering({}, form({ fee_type: "FREE", tuition: "100" }))).ok);
assert.equal(calls.length, before);
console.log("PASS one atomic RPC carries tuition/source; invalid fees never reach DB");

const { DraftTuitionFields } = load("src/components/course-plan/draft-tuition-fields.tsx", { "@/lib/course-opening/working-copy": model });
const paid = renderToStaticMarkup(React.createElement(DraftTuitionFields, { feeType: "PAID", tuition: "150000" }));
assert.match(paid, /value="PAID" selected=""/);
assert.match(paid, /min="1"[^>]*max="100000000"[^>]*required=""[^>]*value="150000"/);
assert(paid.includes("승인된 환불 규정"));
const free = renderToStaticMarkup(React.createElement(DraftTuitionFields, {}));
assert.match(free, /value="FREE" selected=""/);
assert.match(free, /readOnly=""[^>]*value="0"/);
console.log("PASS restored pricing, free readonly zero and paid validation/notice SSR");
