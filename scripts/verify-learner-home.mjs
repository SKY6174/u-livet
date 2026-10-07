import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import * as icons from 'lucide-react';

function load(file, modules) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => {
    assert.ok(name in modules, `Unexpected import: ${name}`);
    return modules[name];
  } });
  return exports;
}

const Link = ({ children, ...props }) => React.createElement('a', props, children);
const portal = { dateTime: value => value, modeLabel: { ONLINE: '온라인', OFFLINE: '대면', BLENDED: '혼합' } };
const attendance = load('src/lib/attendance/model.ts', {});
const catalogModel = load('src/lib/course-guide/model.ts', {});
const model = load('src/lib/student-learning/model.ts', { '@/lib/attendance/model': attendance, '@/lib/course-guide/model': catalogModel });
const rail = load('src/components/student-learning/course-recommendation-rail.tsx', {
  'react': React, 'react/jsx-runtime': jsx, 'next/link': { default: Link }, 'lucide-react': icons,
  '@/lib/portal/data': portal,
});
const home = load('src/components/student-learning/home.tsx', {
  'react/jsx-runtime': jsx, 'next/link': { default: Link }, 'lucide-react': icons,
  './course-recommendation-rail': rail,
  '@/lib/student-learning/model': model, '@/lib/portal/data': portal,
});
const now = Date.parse('2026-09-23T10:00:00+09:00');
const active = {
  application_id: 'application-1', id: 'offering-1', name: '현재 수강 수업', academy: '디지털',
  status: 'ACCEPTED', active: true, mode: 'ONLINE', instructors: ['담당 강사'],
  starts_on: '2026-09-01', ends_on: '2026-12-31', lessons: [],
  sessions: [{ id: 'session-1', title: '다음 차시', starts_at: '2026-09-25T01:00:00Z', ends_at: '2026-09-25T03:00:00Z', status: 'SCHEDULED', credited_minutes: null }],
};
const pending = { ...active, application_id: 'application-2', id: 'offering-2', name: '신청 중 수업', status: 'SUBMITTED', active: false };
const catalogCourse = (id, name, academy, offeringId = null) => ({
  id, name, academy, offeringId, href: `/courses/${id}`, summary: `${name} 소개`, mode: 'ONLINE',
  period_label: '일정 안내 예정', capacity: 20, certificate: null, teaching_hours: null, tuition: 0,
});
const catalog = [
  catalogCourse('guide-own', active.name, '디지털', active.id),
  catalogCourse('guide-pending', pending.name, '디지털', pending.id),
  catalogCourse('guide-other', '다른 분야 과정', '인문'),
  catalogCourse('guide-related', '같은 분야 과정', '디지털'),
  { ...catalogCourse('expired', '종료된 과정', '디지털'), ends_on: '2026-09-22' },
  { ...catalogCourse('archived', '보관된 과정', '디지털'), status: 'ARCHIVED', ends_on: '2026-12-31' },
  ...Array.from({ length: 8 }, (_, index) => catalogCourse(`guide-extra-${index}`, `추가 과정 ${index}`, '기타')),
];
const recommended = model.recommendCourses(catalog, [active, pending], 8, now);
assert.equal(recommended.length, 8);
assert.equal(recommended[0].id, 'guide-related');
assert.ok(recommended.every(course => ![active.name, pending.name].includes(course.name)));
assert.ok(recommended.every(course => !['expired', 'archived'].includes(course.id)));
assert.equal(model.recommendCourses(catalog, [active, pending]).length, 3);
console.log('PASS recommendation excludes own applications and prioritizes the same field');

const data = { hub: { courses: [active, pending] }, catalog: { courses: catalog, unavailable: false }, now };
const current = data.hub.courses.filter(course => model.courseStage(course, '2026-09-23') === 'current');
const html = renderToStaticMarkup(React.createElement(home.LearnerHome, { data, current }));
assert.ok(html.indexOf('내 수업') < html.indexOf('다른 과정 추천'));
assert.ok(html.includes('현재 수강 수업') && html.includes('다음 차시'));
assert.ok(!html.includes('신청 중 수업'));
for (const href of ['/learning/offering-1', '/learning/offering-1/attendance', '/learning/offering-1#class-questions'])
  assert.ok(html.includes(`href="${href}"`), href);
assert.ok(html.includes('이전 추천 과정 보기') && html.includes('다음 추천 과정 보기'));
assert.ok(html.includes('overflow-x-auto') && html.includes('snap-x'));
const recommendationMarkup = html.slice(html.indexOf('aria-label="다른 과정 추천 목록"'));
assert.ok(!recommendationMarkup.includes('현재 수강 수업') && !recommendationMarkup.includes('신청 중 수업'));
assert.ok(recommendationMarkup.includes('같은 분야 과정'));
assert.ok(!recommendationMarkup.includes('종료된 과정') && !recommendationMarkup.includes('보관된 과정'));
console.log('PASS learner home puts own classes first and shows a movable recommendation rail');

const hero = renderToStaticMarkup(React.createElement(home.LearnerHeroSummary, { data, current }));
assert.ok(hero.includes('내 수업 1개') && hero.includes('현재 수강 수업'));
assert.ok(hero.includes('href="/learning/offering-1"'));
console.log('PASS hero opens the next enrolled class');

const pendingOnly = renderToStaticMarkup(React.createElement(home.LearnerHome, {
  data: { ...data, hub: { courses: [pending] } }, current: [],
}));
assert.ok(pendingOnly.includes('현재 수강 중인 수업이 없습니다'));
assert.ok(pendingOnly.includes('href="/mypage#applications"'));
assert.ok(!pendingOnly.includes('href="/learning/offering-2"'));
const failed = renderToStaticMarkup(React.createElement(home.LearnerHome, {
  data: { ...data, hub: null }, current: [],
}));
assert.ok(failed.includes('내 수업 정보를 불러오지 못했습니다'));
assert.ok(!failed.includes('현재 수강 중인 수업이 없습니다'));
const failedCatalog = renderToStaticMarkup(React.createElement(home.LearnerHome, {
  data: { ...data, catalog: { courses: [], unavailable: true } }, current,
}));
assert.ok(failedCatalog.includes('다른 과정 정보를 불러오지 못했습니다'));
console.log('PASS application-only, learning failure and catalog failure remain distinct');
