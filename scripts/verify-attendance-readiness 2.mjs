import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}
const progress = load('src/lib/course-workspace/progress.ts', { '@/lib/reports/types': { DOCUMENTS: [] } });
const base = {
  id: '10000000-0000-4000-8000-000000000001', name: '합성 과정', status: 'PUBLISHED',
  starts_on: '2026-09-01', ends_on: '2026-09-30', instructors: 1, enrolled: 2,
  scheduled_sessions: 2, ended_sessions: 2, attendance_recorded: 4, missing_attendance: 0,
  application_pending: 0, completion_pending: 0, teaching_pending: 0, report_revision: null,
  report_missing: [], document_kinds: [], source: null, completed: 0, teaching_logs: 0,
};
const next = c => progress.nextCourseAction({ ...base, ...c }, '2026-10-01');
const Readiness = load('src/components/course-workspace/attendance-readiness.tsx', {
  'next/link': 'a', '@/lib/course-workspace/progress': progress,
}).AttendanceReadiness;
const render = c => renderToStaticMarkup(React.createElement(Readiness, { course: { ...base, ...c } }));
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS ' + name); }

await test('all eight preparation combinations reflect actual assignments, active members and sessions', () => {
  for (let mask = 0; mask < 8; mask++) {
    const c = { ...base, instructors: mask & 1 ? 1 : 0, enrolled: mask & 2 ? 2 : 0, scheduled_sessions: mask & 4 ? 2 : 0 };
    const checks = progress.attendancePreparation(c);
    assert.deepEqual(checks.map(item => item.ready), [!!(mask & 1), !!(mask & 2), !!(mask & 4)]);
    const missing = checks.filter(item => !item.ready).length;
    assert(render(c).includes(missing ? `${missing}개 항목 등록 필요` : '운영 자료 연결됨'));
  }
});
await test('original report totals never stand in for actual learners or classes', () => {
  const c = { instructors: 0, enrolled: 0, scheduled_sessions: 0, source: { enrolled: 15, completed: 15, classes: 7, hours: 30 } };
  const html = render(c);
  assert(html.includes('3개 항목 등록 필요')); assert(html.includes('0명 확정')); assert(html.includes('0회 등록'));
  assert(!html.includes('출석부 출력 확인')); assert(!html.includes('운영 자료 연결됨'));
});
await test('archived courses keep source review rather than requesting new operational registration', () => {
  const c = { ...base, status: 'ARCHIVED', enrolled: 0, scheduled_sessions: 0, instructors: 0 };
  assert.deepEqual(progress.attendancePreparation(c), []);
  assert.equal(next(c).label, '원본·보고서 검토');
  const html = render(c); assert(html.includes('원본 출석부 첨부 확인')); assert(!html.includes('등록 필요'));
  assert(!html.includes('출석부 출력 확인'));
});
await test('archived courses with actual records retain electronic attendance totals', () => {
  const html = render({ status: 'ARCHIVED' });
  assert(html.includes('입력된 출결')); assert(html.includes('4건')); assert(html.includes('출석부 출력 확인'));
});
await test('draft and pending applications retain their next-task priority', () => {
  assert.equal(next({ status: 'DRAFT', instructors: 0, enrolled: 0 }).label, '개설 준비 확인');
  assert.equal(next({ application_pending: 3, instructors: 0 }).label, '신청 3건 심사');
  assert(render({ status: 'DRAFT' }).includes('개설 초안입니다'));
});
await test('missing prerequisites lead to assignment, enrollment and schedule work before reports', () => {
  assert.equal(next({ instructors: 0, enrolled: 0, scheduled_sessions: 0 }).label, '담당 강사 배정');
  assert.equal(next({ enrolled: 0, scheduled_sessions: 0 }).href, `/admin/offerings/${base.id}/manage#applications`);
  assert.equal(next({ scheduled_sessions: 0 }).label, '수업 일정 등록 확인');
  assert.equal(next({ scheduled_sessions: 0 }).href, `/admin/offerings/${base.id}#attendance`);
});
await test('missing ended-class attendance precedes completion and report work', () => {
  assert.equal(next({ missing_attendance: 1, completion_pending: 2, teaching_pending: 1 }).label, '출결 미입력 확인');
  const html = render({ missing_attendance: 1 }); assert(html.includes('미입력은 결석과 다릅니다')); assert(html.includes('1건'));
});
await test('future sessions never lead to completion review even when the offering date is past', () => {
  assert.equal(next({ ended_sessions: 1, completion_pending: 2 }).label, '수업 진행·출결 확인');
  assert.equal(next({ ended_sessions: 0 }).label, '수업 진행·출결 확인');
  assert.equal(next({ ended_sessions: 1, teaching_pending: 1 }).label, '강의실적 승인');
});
await test('completed sessions allow completion review only after the course end date', () => {
  assert.equal(next({ completion_pending: 2 }).label, '수료 검토하기');
  assert.notEqual(next({ completion_pending: 2, ends_on: '2026-10-01' }).label, '수료 검토하기');
  assert.equal(next({ report_revision: 2 }).label, '보고서 검토·출력');
  assert.equal(next({}).label, '결과보고서 작성');
});
await test('manager actions stay in the managed course and never target a teacher-only route', () => {
  const html = render({ instructors: 0, enrolled: 0, scheduled_sessions: 0 });
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  assert.equal(hrefs.length, 3); assert(hrefs.every(h => h.startsWith(`/admin/offerings/${base.id}/manage#`)));
  assert(!html.includes('href="/instructor')); assert(!html.includes('<form'));
});
let calls = 0, result = { offering: base, workspace: base };
const Overview = load('src/app/admin/offerings/[id]/page.tsx', {
  'next/link': 'a', '@/lib/course-workspace/progress': progress,
  '@/lib/course-workspace/data': { getManagedCourse: async id => { assert.equal(id, base.id); calls++; return result; } },
  '@/components/course-workspace/course-header': { CourseHeader: () => null },
  '@/components/course-workspace/document-status': { DocumentStatus: () => null },
  '@/components/course-workspace/attendance-readiness': { AttendanceReadiness: Readiness },
  '@/components/portal/ui': { Empty: ({ title }) => React.createElement('p', null, title) },
  '@/lib/portal/data': { dateTime: x => x }, '@/lib/reports/types': { money: x => String(x ?? 0) },
}).default;
await test('managed overview reuses the existing snapshot once without additional DB requests', async () => {
  const html = renderToStaticMarkup(await Overview({ params: Promise.resolve({ id: base.id }) }));
  assert.equal(calls, 1); assert.equal((html.match(/id="attendance"/g) ?? []).length, 1);
  assert(html.includes('수업·출석부 운영'));
});
await test('failed snapshot retains the error screen rather than showing zero-count readiness', async () => {
  result = { offering: base, workspace: null };
  const html = renderToStaticMarkup(await Overview({ params: Promise.resolve({ id: base.id }) }));
  assert(html.includes('운영 현황을 불러오지 못했습니다')); assert(!html.includes('등록 필요'));
});
console.log(`${passed} attendance readiness checks passed; synthetic data only.`);
