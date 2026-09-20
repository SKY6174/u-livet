import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const actions = { startDossier: () => {} };
const modules = {
  "react/jsx-runtime": jsx,
  "@/components/portal/action-form": {
    ActionForm: ({ children, label, action }) => {
      assert.equal(action, actions.startDossier);
      return React.createElement("form", null, children, React.createElement("button", { type: "submit" }, label));
    },
  },
  "@/components/portal/instructor-forms": {},
  "@/app/instructor-development-actions": actions,
  "@/lib/portal/data": {},
  "@/lib/instructors/types": {},
};
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync("src/components/portal/instructor-detail.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, { exports, require: name => {
  assert.ok(name in modules, `Unexpected import: ${name}`);
  return modules[name];
} });
const policy = (kind, org_id = "org-a", id = kind) => ({ id, org_id, kind, title: kind, version: "TEST", body: "검증용 안내 본문" });
const privacy = policy("INSTRUCTOR_PRIVACY");
const review = policy("INSTRUCTOR_REVIEW");
const render = (policies, label) => renderToStaticMarkup(React.createElement(exports.DossierStartForm, { orgId: "org-a", policies, label }));
let checks = 0;
for (const [label, policies, missing] of [
  ["no policies", [], ["개인정보 수집·이용 안내", "심사 기준"]],
  ["privacy only", [privacy], ["심사 기준"]],
  ["review only", [review], ["개인정보 수집·이용 안내"]],
  ["other organization", [policy("INSTRUCTOR_PRIVACY", "org-b"), policy("INSTRUCTOR_REVIEW", "org-b")], ["개인정보 수집·이용 안내", "심사 기준"]],
  ["account consent is not instructor consent", [policy("ACCOUNT_PRIVACY"), review], ["개인정보 수집·이용 안내"]],
]) {
  const html = render(policies);
  assert.ok(html.includes('role="status"'));
  assert.ok(!/<form|<select|type="checkbox"|type="submit"/.test(html));
  for (const item of missing) assert.ok(html.includes(item));
  assert.ok(html.includes("tel:0522300410"));
  console.log("PASS blocked state: " + label); checks++;
}
const ready = render([privacy, review]);
assert.match(ready, /name="o" value="org-a"/);
assert.match(ready, /<option value="INSTRUCTOR_PRIVACY" selected="">/);
assert.match(ready, /<details open=""/);
const consent = ready.match(/<input[^>]+name="confirmed"[^>]*>/)?.[0];
assert.ok(consent?.includes('required=""'));
assert.ok(!ready.includes('checked=""'));
assert.ok(ready.includes("이력 초안 만들기"));
console.log("PASS ready state: policy selected, body visible, personal consent required"); checks++;
const multiple = render([privacy, policy("INSTRUCTOR_PRIVACY", "org-a", "new-version"), review]);
assert.match(multiple, /<option value="" disabled="" selected="">/);
assert.ok(render([privacy, review], "새 버전 작성").includes("새 버전 작성"));
console.log("PASS multiple versions require selection; correction uses same gate"); checks++;
console.log(`${checks} dossier registration UI checks passed; no network or user data.`);
