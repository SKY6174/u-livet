import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}

let checks = 0;
async function test(name, run) { await run(); checks++; console.log(`PASS ${name}`); }

const active = {
  id: 'course-1', org_id: 'own-org', name: '직업교육 A', academy: '기술', year_label: '2026년',
  status: 'PUBLISHED', capacity: 20, starts_on: '2026-09-01', ends_on: '2026-10-01',
  application_pending: 4, enrolled: 8, scheduled_sessions: 5, ended_sessions: 2,
  attendance_expected: 16, attendance_recorded: 13, missing_attendance: 3,
  teaching_pending: 1, completion_pending: 2, completed: 1, source_enrolled: null,
};
const archived = {
  ...active, id: 'course-2', name: '이관 과정 B', status: 'ARCHIVED',
  application_pending: 0, enrolled: 0, capacity: 15, scheduled_sessions: 0,
  ended_sessions: 0, attendance_expected: 0, attendance_recorded: 0,
  missing_attendance: 0, teaching_pending: 0, completion_pending: 0, completed: 0,
  source_enrolled: 12,
};
const PlanDashboard = ({ summaryCards }) => React.createElement('section', null,
  '신호등', summaryCards, React.createElement('span', null, '연간 일정'));
const Dashboard = load('src/components/admin/course-monitoring-dashboard.tsx', {
  'next/link': 'a',
  './course-monitoring-plan-dashboard': { CourseMonitoringPlanDashboard: PlanDashboard },
}).CourseMonitoringDashboard;

await test('manager dashboard distinguishes applications, enrollment, attendance entry and source reports', () => {
  const html = renderToStaticMarkup(React.createElement(Dashboard, {
    courses: [active, archived], organizations: [{ id: 'own-org', name: '앵커사업단' }],
  }));
  assert(html.includes('직업교육 A') && html.includes('이관 과정 B'));
  assert(html.includes('신청 대기·대기자'));
  assert.match(html, /신청 대기·대기자[^<]*<strong[^>]*>4명/);
  assert.match(html, /수강 확정[^<]*<strong[^>]*>8 \/ 20명/);
  assert.match(html, /출결 입력[^<]*<strong[^>]*>13 \/ 16건/);
  assert(html.includes('입력률 81%'));
  assert(html.includes('미입력 3건 · 결석과 별도'));
  assert(html.includes('원본 기록 수강 12명 · 전산 인원과 별도'));
  assert(html.includes('강의일지 미확정 1건'));
  assert.equal((html.match(/신청 처리 →/g) ?? []).length, 1);
  assert(html.includes('/admin/offerings/course-1#attendance'));
  assert(html.includes('/completion/course-1'));
  assert(html.includes('종료 수업 출결 집계 대상 없음'));
});

await test('empty monitoring data is clearly distinguished from zero applications', () => {
  const html = renderToStaticMarkup(React.createElement(Dashboard, { courses: [], organizations: [] }));
  assert(html.includes('등록된 과정이 없습니다'));
  assert(!html.includes('직업교육 A'));
});

await test('summary cards appear once directly after traffic lights', () => {
  const html = renderToStaticMarkup(React.createElement(Dashboard, {
    courses: [active], organizations: [{ id: 'own-org', name: '앵커사업단' }],
    annual: { guides: [], plans: [], documents: [], today: '2026-09-25' },
  }));
  assert(html.indexOf('신호등') < html.indexOf('과정 운영 현황 요약'));
  assert(html.indexOf('과정 운영 현황 요약') < html.indexOf('연간 일정'));
  assert.equal((html.match(/과정 운영 현황 요약/g) ?? []).length, 1);
  assert(html.includes('표시 과정</p><p') && html.includes('>1<span'));
});

let identity = { roles: [{ role: 'COURSE_MANAGER', org_id: 'own-org' }] };
let workspaceReads = 0;
let unavailable = false;
const Page = load('src/app/admin/monitoring/page.tsx', {
  'next/navigation': { notFound: () => { throw new Error('NOT_FOUND'); } },
  '@/components/admin/admin-live-refresh': { AdminLiveRefresh: () => React.createElement('button', null, '지금 갱신') },
  '@/components/admin/course-monitoring-dashboard': { CourseMonitoringDashboard: Dashboard },
  '@/components/admin/course-monitoring-plan-dashboard': { CourseMonitoringPlanDashboard: PlanDashboard },
  '@/components/portal/ui': {
    PageIntro: ({ title, children }) => React.createElement('header', null, React.createElement('h1', null, title), children),
    Empty: ({ title, children }) => React.createElement('section', null, title, children),
  },
  '@/lib/auth/session': { requireIdentity: async () => identity },
  '@/lib/course-workspace/data': { getCourseWorkspaces: async () => {
    workspaceReads++;
    return { courses: [active, { ...active, id: 'foreign', org_id: 'other-org', name: '외부 과정' }], unavailable };
  } },
  '@/lib/course-monitoring/data': { getAnnualMonitoringData: async () => ({ guides: [], plans: [], documents: [], unavailable: false }) },
  '@/lib/course-monitoring/model': { ANCHOR_ORG_ID: '10000000-0000-4000-8000-000000000001' },
  '@/lib/supabase/server': { createServerSupabaseClient: async () => ({
    from: () => ({ select: () => ({ in: async () => ({ data: [{ id: 'own-org', name: '앵커사업단' }], error: null }) }) }),
  }) },
}).default;

await test('unauthorized roles are rejected before monitoring data is read', async () => {
  identity = { roles: [{ role: 'SYSTEM_ADMIN', org_id: 'own-org' }] };
  const before = workspaceReads;
  await assert.rejects(Page(), /NOT_FOUND/);
  assert.equal(workspaceReads, before);
});

await test('server sends only the manager organization to the dashboard', async () => {
  identity = { roles: [{ role: 'COURSE_MANAGER', org_id: 'own-org' }] };
  const html = renderToStaticMarkup(await Page());
  assert(html.includes('직업교육 A'));
  assert(!html.includes('외부 과정'));
  assert(html.includes('앵커사업단'));
});

await test('RPC failure shows an error rather than a misleading zero-course summary', async () => {
  unavailable = true;
  const html = renderToStaticMarkup(await Page());
  assert(html.includes('과정 현황을 불러오지 못했습니다'));
  assert(!html.includes('조건에 맞는 과정 0개'));
});

console.log(`PASS ${checks} course monitoring checks`);
