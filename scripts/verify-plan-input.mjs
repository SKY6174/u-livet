import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function("require", "module", "exports", code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}
const schema = load("src/lib/operation-documents/schema.ts");
const model = load("src/lib/operation-documents/model.ts", { "./schema": schema });
const helpers = load("src/lib/operation-documents/plan-input.ts");
for (const [expression, expected] of [
  ["15,000원*10시간", 150000], ["15,000원 × 10시간", 150000], ["15000x10", 150000],
  ["강사료 15,000원*10시간 + 20,000원*3명", 210000], ["1. 밀가루 1kg*5개=10만원\n2. 버터 1kg*10개=20만원", 300000],
  ["10만원\n\n20만원", 300000], ["15000원*10시간=150,000원", 150000], ["1.005천원*10명", 10050],
  ["15000원*1.5시간", 22500], ["0.1원*10", 1], ["0원", 0], ["999,999,999,999원", 999999999999],
  ["강사1) 150,000*2+80000*3", 540000], ["강사1) 152,000*2+80000*3", 544000], ["강사2: 150000원*2시간", 300000],
  ["1.5만원", 15000], ["2억원 + 5천원", 200005000],
]) assert.equal(helpers.budgetCalculation(expression), expected, expression);
for (const expression of ["", "강사료", "15000원*", "15000원*10시간=100원", "15,00원*10시간", "-1원", "1e3원*10", "10/2", "1kg*5개", "0.1원", "999999999999원+1원", "9999999999999원", "15000원*100000000", "1원\n계산 불명", "globalThis.process.exit()", "1;throw Error()", "1원".repeat(600)])
  assert.equal(helpers.budgetCalculation(expression), null, expression);
console.log("PASS exact monetary arithmetic, multiline totals, mismatch and unsafe/ambiguous bounds");
const columns = schema.tables("plan").find(table => table.key === "schedule").columns;
const source = Object.fromEntries(columns.map(field => [field.key, field.key]));
const defaults = helpers.scheduleDefaults(source, columns);
const row = helpers.scheduleRowFromDefaults({ ...defaults, date: "2026-10-01", holiday: "do not copy", unknown: "ignored" }, columns);
assert.equal(row.topic, "topic"); assert.equal(row.date, ""); assert.equal(row.holiday, "");
assert.equal(row.instructor, "instructor"); assert.equal(row.hours, "hours");
assert.deepEqual(Object.keys(row).sort(), columns.map(field => field.key).sort());
row.topic = "edited independently";
assert.equal(source.topic, "topic"); assert.equal(defaults.topic, "topic");
assert.deepEqual(helpers.selectedAudiences("성인학습자, 지역주민"), ["성인학습자", "지역주민"]);
assert.deepEqual(helpers.selectedAudiences("지역주민"), ["지역주민"]);
assert.deepEqual(helpers.selectedAudiences(""), []);
const content = model.emptyContent("plan");
assert(model.validContent(content, "plan"));
assert(model.missingContent(content, "plan").includes("담당교수 서명"));
content.signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9WvFIAAAAASUVORK5CYII=";
assert(!model.missingContent(content, "plan").includes("담당교수 서명"));
assert(!model.missingContent(model.emptyContent("result"), "result").includes("담당교수 서명"));
const budget = model.emptyBudget("plan");
budget.rows[7].calculation = "1. 밀가루 1kg*5개=10만원\n2. 버터 1kg*10개=20만원";
budget.rows[7].planned = "300000";
assert(model.validBudget(budget));
assert.equal(JSON.parse(JSON.stringify(budget)).rows[7].calculation.split("\n").length, 2);
console.log("PASS date-safe independent schedule rows, legacy audience values, draft signatures and multiline persistence");

assert.equal(helpers.recruitmentRatio("3", "20"), "15");
assert.equal(helpers.recruitmentRatio("1", "3"), "33.33");
assert(helpers.validRecruitment([{count:"3"},{count:"17"}],"20"));
assert(!helpers.validRecruitment([{count:"3.5"}],"20"));
assert(!helpers.validRecruitment([{count:"21"}],"20"));
assert(!helpers.validRecruitment([{count:"11"},{count:"10"}],"20"));
const admission = load("src/lib/learner-documents/admissions.ts");
const now=Date.parse("2026-10-17T01:00:00Z"), open={status:"PUBLISHED",apply_from:"2026-10-16T00:00:00Z",apply_until:"2026-10-18T00:00:00Z",starts_on:"2026-10-20"};
assert(admission.applicationIsOpen(open,now));
for(const change of [{status:"DRAFT"},{status:"CLOSED"},{academic_sealed:true},{starts_on:"2026-10-17"},{apply_until:"2026-10-17T01:00:00Z"},{apply_from:"2026-10-18T00:00:00Z"}])assert(!admission.applicationIsOpen({...open,...change},now));
console.log("PASS numbered-label recalculation 540000→544000; recruitment integer/capacity/ratio; admissions start/deadline/closed/sealed boundaries");
