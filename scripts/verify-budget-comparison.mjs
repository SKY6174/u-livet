import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';

function compile(file, imports = {}) {
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)(name => { assert(name in imports, `Unexpected import: ${name}`); return imports[name]; }, mod, mod.exports);
  return mod.exports;
}
const model = compile('src/lib/course-budget/model.ts');
const comparison = compile('src/lib/course-budget/comparison.ts', { './model': model });
const guides = JSON.parse(readFileSync('docs/operations/2026-public-course-guides.json')).courses;
const courses = guides.map((c, i) => ({ ...c, budget: { program_id: 'C1-S4T5-3', revision: 1, materials: 100, printing: null, instructors: 200, operations: 0, support: null, scholarships: null }, id: c.id ?? String(i) }));
const workbook = rows => ({ file_name: '집행.xlsx', sheet_name: '집행', sha256: 'a'.repeat(64), header_row: 0, rows });
const parse = rows => comparison.compareExecution(courses, workbook(rows));
let checks = 0;
const test = (name, fn) => { fn(); console.log(`PASS ${name}`); checks++; };
test('no workbook leaves all executions missing, never zero', () => {
  const result = comparison.compareExecution(courses, null);
  assert.deepEqual(result.entries, {}); assert.equal(comparison.executionSum(courses, result, 'total'), null);
});
test('shared program ID never assigns money to multiple courses', () => {
  const result = parse([['Program ID', '재료비'], ['C1-S4T5-3', '200']]);
  assert.equal(Object.keys(result.entries).length, 0); assert.equal(result.notices.length, 1);
});
test('exact course name selects one course; banners included in computed sum', () => {
  const result = parse([['세부 프로그램', '재료비', '인쇄비', '현수막'], [courses[0].name, '1,200', '0', '66000']]);
  assert.deepEqual(Object.keys(result.entries), [courses[0].id]);
  const entry = result.entries[courses[0].id]; assert.equal(entry.total, 67200); assert.equal(entry.values.printing, 0); assert.equal(entry.values.support, null);
});
test('source total is preserved instead of summing incomplete categories', () => {
  const result = parse([['과정명', '재료비', '총액'], [courses[0].name, '1,200원', '4,500']]);
  assert.equal(result.entries[courses[0].id].total, 4500);
});
test('selected header row and normalized punctuation are respected', () => {
  const result = comparison.compareExecution(courses, { ...workbook([['집행 자료'], ['과정명', '재료비'], [courses[0].name.replaceAll(' ', '') + ' ', '200']]), header_row: 1 });
  assert.equal(result.entries[courses[0].id].total, 200);
});
test('course ID can match; wrong program ID cannot match', () => {
  assert.equal(parse([['과정 ID', '재료비'], [courses[0].id, '200']]).entries[courses[0].id].total, 200);
  assert.equal(Object.keys(parse([['과정명', 'Program ID', '재료비'], [courses[0].name, 'WRONG', '200']]).entries).length, 0);
});
test('budget rows and subtotals are never counted as execution', () => {
  const result = parse([['과정명', '구분', '재료비'], [courses[0].name, '예산', '10000'], [courses[0].name, '집행', '200'], ['합계', '집행', '200']]);
  assert.equal(result.entries[courses[0].id].total, 200); assert.equal(result.notices.length, 0);
});
test('duplicates are flagged and excluded, including a third duplicate', () => {
  const result = parse([['과정명', '재료비'], ...Array(3).fill([courses[0].name, '200'])]);
  assert(result.entries[courses[0].id].issue); assert.equal(comparison.executionSum(courses, result, 'total'), null);
});
test('invalid or unsafe amounts are not silently counted', () => {
  for (const value of ['-1', '1e3', '1,2', '3.5', '=SUM(A1)', '1000000000000']) {
    const entry = parse([['과정명', '재료비'], [courses[0].name, value]]).entries[courses[0].id];
    assert(entry.issue, value); assert.equal(entry.total, null);
  }
});
test('unknown names remain unlinked and produce an explanation', () => {
  const result = parse([['과정명', '재료비'], ['알 수 없는 과정', '200']]); assert.equal(Object.keys(result.entries).length, 0); assert.equal(result.notices.length, 1);
});
test('unsupported columns or ambiguous course headers require review', () => {
  for (const rows of [[['과정명', '항목', '금액'], [courses[0].name, '강사료', '200']], [['과정명', '세부 프로그램', '재료비'], [courses[0].name, courses[1].name, '200']]]) {
    const result = parse(rows); assert.equal(Object.keys(result.entries).length, 0); assert.equal(result.notices.length, 1);
  }
});
test('duplicate amount or classification headers never produce partial totals', () => {
  for (const headers of [['과정명', '재료비', '재료비', '강사료'], ['과정명', '재료비', '총액', '합계'], ['과정명', '재료비', '구분', '구분']]) {
    const result = parse([headers, [courses[0].name, '100', '200', '300']]);
    assert.deepEqual(result.entries, {}); assert.equal(result.notices.length, 1);
  }
});
test('blank and dash entries remain missing; totals include only connected courses', () => {
  const result = parse([['과정명', '재료비', '강사료'], [courses[0].name, '0', '—'], [courses[1].name, '-', '100']]);
  assert.equal(result.entries[courses[0].id].total, 0); assert.equal(result.entries[courses[1].id].values.materials, null);
  assert.equal(comparison.executionSum(courses, result, 'total'), 100);
});
const { BudgetPanel } = compile('src/components/course-workspace/budget-panel.tsx', {
  react: React, 'react/jsx-runtime': jsxRuntime, 'next/dynamic': () => () => null,
  '@/lib/course-budget/model': model, '@/lib/course-budget/comparison': comparison,
  '@/components/portal/action-form': { ActionForm: () => null }, '@/app/admin/courses/budget-actions': { saveCourseBudget: () => {} },
});
test('16 programs render paired budget/execution rows with merged identity and edit cells', () => {
  const html = renderToStaticMarkup(React.createElement(BudgetPanel, { courses, org: 'test', workbooks: [], year: 2026 }));
  assert.equal((html.match(/rowSpan="2" class="whitespace-nowrap p-3 text-left font-mono/g) ?? []).length, 16);
  assert.equal((html.match(/<th scope="row" class="p-3 text-left text-xs font-semibold/g) ?? []).length, 32);
  assert(html.includes('2026 예산 및 집행현황')); assert(html.includes('단위: 원'));
  assert(!html.includes('초기값은 제공된 예산 현황표 기준입니다.')); assert(html.includes('집행 엑셀 자료 · 선택 및 저장'));
});
console.log(`${checks} budget comparison checks passed.`);
