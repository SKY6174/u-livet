import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}
let checks = 0;
async function test(name, run) { await run(); checks++; console.log('PASS ' + name); }
const audience = load('src/lib/auth/login-audience.ts');
const nav = load('src/lib/auth/workspace-navigation.ts', { './login-audience': audience });
const member = (...roles) => ({ id: 'self', name: '검증 회원', email: 'synthetic@example.invalid', roles: roles.map(role => ({ role, org_id: 'own-org' })) });
let me = member();
let path = '/admin';
const notFound = () => { throw new Error('NOT_FOUND'); };
const redirect = destination => { throw Object.assign(new Error('REDIRECT'), { destination }); };
const common = {
  'next/link': 'a', 'next/navigation': { notFound, redirect, usePathname: () => path },
  '@/lib/auth/session': { requireIdentity: async () => { if (!me) throw new Error('LOGIN_REQUIRED'); return me; } },
  '@/lib/auth/workspace-navigation': nav,
};
// This .mjs uses React.createElement so it needs no JSX runtime in Node.
common['@/components/portal/ui'] = {
  PageIntro: ({ title, children }) => React.createElement('header', null, React.createElement('h1', null, title), children),
  Empty: ({ title, children }) => React.createElement('div', null, title, children),
};
const roleCases = [
  [[], [], 'learner'], [['INSTRUCTOR'], [], 'instructor'],
  [['SYSTEM_ADMIN'], ['/admin/accounts'], 'office'],
  [['COURSE_MANAGER'], ['/admin/courses', '/admin/reports', '/completion', '/credentials', '/performance'], 'office'],
  [['CERTIFIER'], ['/completion', '/credentials'], 'office'],
  [['FINANCE'], ['/finance'], 'office'], [['PERFORMANCE'], ['/performance'], 'office'],
];
for (const [roles, links, kind] of roleCases) await test('granted role menus: ' + (roles.join(',') || 'learner'), () => {
  const identity = member(...roles);
  assert.deepEqual(nav.officeSections(identity).flatMap(section => section.links.map(link => link.href)), links);
  assert.equal(nav.workspaceKind(identity), kind);
  const primary = nav.primaryLinks(identity).map(link => link.href);
  assert.equal(primary.includes('/admin'), kind === 'office');
  assert.equal(primary.includes('/instructor'), roles.includes('INSTRUCTOR'));
  for (const href of ['/completion', '/credentials', '/finance', '/performance']) assert(!primary.includes(href));
});
await test('all office positions display correctly but never grant permission', () => {
  for (const [position, label] of Object.entries(audience.OFFICE_POSITIONS)) {
    assert.equal(nav.memberLabel({ ...member('COURSE_MANAGER'), office_position: position }), '관리자 · ' + label);
    assert.equal(nav.workspaceKind({ ...member(), office_position: position }), 'learner');
    assert.equal(nav.officeSections({ ...member(), office_position: position }).length, 0);
  }
  for (const kind of ['INTERNAL', 'EXTERNAL']) assert.match(nav.memberLabel({ ...member('INSTRUCTOR'), instructor_kind: kind }), /강사\((교내|교외)\)/);
  assert.equal(nav.primaryLinks(null).length, 3);
  assert.equal(nav.primaryLinks(member('COURSE_MANAGER'), true).length, 3);
});
await test('combined roles preserve independent workspaces without duplicate links', () => {
  const mixed = member('SYSTEM_ADMIN', 'COURSE_MANAGER', 'INSTRUCTOR', 'CERTIFIER', 'FINANCE', 'PERFORMANCE');
  const primary = nav.primaryLinks(mixed).map(link => link.href);
  assert(primary.includes('/admin') && primary.includes('/instructor'));
  const hrefs = nav.officeSections(mixed).flatMap(section => section.links.map(link => link.href));
  assert.equal(new Set(hrefs).size, hrefs.length);
});
await test('nested report, completion and certificate routes stay under the office menu', () => {
  for (const [pathname, active] of [['/admin', '/admin'], ['/admin/course-plan/opening', '/admin/courses'], ['/admin/offerings/id', '/admin/courses'], ['/admin/offerings/id/reports/print', '/admin/reports'], ['/completion/id', '/completion'], ['/credentials/badges', '/credentials'], ['/admin/accounts', '/admin/accounts']]) {
    assert.equal(nav.officeActiveHref(pathname), active);
    assert(nav.primaryActive(pathname, '/admin'));
  }
  assert(!nav.primaryActive('/administrator', '/admin'));
});
const Header = load('src/components/common/Header.tsx', { ...common, react: { ...React, useState: () => [true, () => {}] },
  'next/image': ({ priority, ...props }) => React.createElement('img', props),
  '@/lib/auth/roleContext': { useRole: () => me }, '@/app/auth/actions': { signOut: '/sign-out' },
}).default;
await test('desktop and expanded mobile header share exactly the same authorized links', () => {
  for (const [roles] of roleCases) {
    me = member(...roles);
    const output = renderToStaticMarkup(React.createElement(Header));
    for (const { label, href } of nav.primaryLinks(me)) {
      assert.equal((output.match(new RegExp('href="' + href + '"', 'g')) ?? []).length, href === '/admin' ? 4 : 2, label);
    }
    const submenuHrefs = nav.officeSections(me).flatMap(section => section.links.map(link => link.href));
    for (const href of submenuHrefs) {
      assert.equal((output.match(new RegExp('href="' + href + '"', 'g')) ?? []).length, 2, href);
    }
    for (const href of ['/completion', '/credentials', '/finance', '/performance']) {
      if (!submenuHrefs.includes(href)) assert(!output.includes(`href="${href}"`), href);
    }
  }
});
const Admin = load('src/app/admin/page.tsx', common).default;
const AdminLayout = load('src/app/admin/layout.tsx', common).default;
const section = load('src/components/navigation/office-section.tsx', common);
await test('office hub rejects guests/learners/teachers and permits each actual office role', async () => {
  for (const identity of [null, member(), member('INSTRUCTOR'), { ...member(), office_position: 'DIRECTOR' }]) {
    me = identity;
    await assert.rejects(Admin({ searchParams: Promise.resolve({}) }), /LOGIN_REQUIRED|NOT_FOUND/);
    await assert.rejects(AdminLayout({ children: 'restricted' }), /LOGIN_REQUIRED|NOT_FOUND/);
  }
  for (const [roles, expected, kind] of roleCases.filter(row => row[2] === 'office')) {
    me = member(...roles);
    const output = renderToStaticMarkup(await Admin({ searchParams: Promise.resolve({}) }));
    for (const href of expected) assert(output.includes(`href="${href}"`), href + kind);
    await AdminLayout({ children: null });
  }
});
await test('every pre-existing course subtree retains a manager gate when the hub is widened', async () => {
  const redirectOnly = ['finance', 'performance', 'kpi'];
  for (const dir of readdirSync('src/app/admin', { withFileTypes: true }).filter(dir => dir.isDirectory())) {
    if (dir.name === 'accounts') continue; // page has its own SYSTEM_ADMIN gate
    if (redirectOnly.includes(dir.name)) continue; // no data; destination layout gates it
    const gate = load(`src/app/admin/${dir.name}/layout.tsx`, { '@/components/navigation/office-section': section }).default;
    for (const roles of [[], ['INSTRUCTOR'], ['SYSTEM_ADMIN'], ['CERTIFIER'], ['FINANCE'], ['PERFORMANCE']]) {
      me = member(...roles); await assert.rejects(gate({ children: null }), /NOT_FOUND/);
    }
    me = member('COURSE_MANAGER'); await gate({ children: null });
  }
});
await test('completion, certificate, finance and performance layouts enforce their own roles', async () => {
  for (const [name, accepted] of Object.entries({ completion: ['COURSE_MANAGER', 'CERTIFIER'], credentials: ['COURSE_MANAGER', 'CERTIFIER'], finance: ['FINANCE'], performance: ['COURSE_MANAGER', 'PERFORMANCE'] })) {
    const Layout = load(`src/app/${name}/layout.tsx`, { '@/components/navigation/office-section': section }).default;
    for (const role of ['INSTRUCTOR', 'SYSTEM_ADMIN', 'COURSE_MANAGER', 'CERTIFIER', 'FINANCE', 'PERFORMANCE']) {
      me = member(role); const child = Layout({ children: null });
      const run = () => child.type(child.props);
      if (accepted.includes(role)) await run(); else await assert.rejects(run(), /NOT_FOUND/);
    }
  }
});
await test('legacy registration links keep plan/create intent and discard unrelated parameters', async () => {
  me = member('COURSE_MANAGER');
  for (const [params, target] of [[{ plan: 'P01', title: 'injected' }, '/admin/courses?plan=P01#new-course'], [{ create: '1' }, '/admin/courses?create=1#new-course']]) {
    await assert.rejects(Admin({ searchParams: Promise.resolve(params) }), error => error.destination === target);
  }
  await assert.rejects(Admin({ searchParams: Promise.resolve({ plan: ['P01'] }) }), /NOT_FOUND/);
  me = member('SYSTEM_ADMIN');
  await assert.rejects(Admin({ searchParams: Promise.resolve({ plan: 'P01' }) }), /NOT_FOUND/);
});
let appReads = 0;
const MyPage = load('src/app/mypage/page.tsx', { ...common,
  '@/lib/supabase/server': { createServerSupabaseClient: async () => ({ from: table => {
    assert.equal(table, 'life_applications'); appReads++;
    return { select() { return this; }, eq(column, value) { assert.equal(column, 'person_id'); assert.equal(value, 'self'); return this; }, order: async () => ({ data: [{ id: 'a', offering_id: 'course', status: 'ACCEPTED' }] }) };
  } }) },
  '@/lib/portal/data': { getWorkspaceOfferings: async () => ({ offerings: [{ id: 'course', name: '나의 수업' }] }), statusLabel: { ACCEPTED: '수강 확정' }, dateTime: () => '2026-09-21' },
  '@/components/auth/account-security': { AccountSecurity: () => React.createElement('section', null, '연결된 인증 앱 관리') },
  '@/components/portal/action-form': { ActionForm: ({ children, label }) => React.createElement('form', null, children, label) }, '@/app/actions': {},
}).default;
await test('personal page separates office, instructor and learner queries and actions', async () => {
  for (const [roles, kind] of [[['COURSE_MANAGER'], 'office'], [['SYSTEM_ADMIN'], 'office'], [['INSTRUCTOR'], 'instructor'], [[], 'learner']]) {
    me = member(...roles); const before = appReads;
    const output = renderToStaticMarkup(await MyPage());
    assert.equal(appReads - before, kind === 'learner' ? 1 : 0);
    assert.equal(output.includes('연결된 인증 앱 관리'), kind === 'office');
    assert.equal(output.includes('href="/mypage/instructor"'), kind === 'instructor');
    assert.equal(output.includes('href="/learning/course"'), kind === 'learner');
    assert.equal(output.includes('신청 취소'), kind === 'learner');
    assert.equal(output.includes('href="/mypage/badges"'), kind === 'learner');
  }
});
let cursor = 0;
const states = [];
const ReportList = load('src/components/course-workspace/report-list.tsx', { 'next/link': 'a', react: { useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = value; }]; } } }).ReportList;
const courses = ['empty', 'attention', 'saved'].map((value, i) => ({ id: value, name: value, academy: '스마트테크', operator: '운영자', document_kinds: [], report_revision: i || null, report_missing: i === 1 ? ['운영 총평'] : [] }));
const renderReports = () => { cursor = 0; return ReportList({ courses }); };
const nodes = tree => tree && typeof tree === 'object' ? [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)] : [];
await test('report states/search isolate results and link to the correct report/print routes', () => {
  for (const [filter, expected] of [['all', 3], ['empty', 1], ['attention', 1], ['saved', 1]]) {
    const tree = renderReports();
    const button = nodes(tree).filter(node => node.type === 'button')[['all', 'empty', 'attention', 'saved'].indexOf(filter)];
    button.props.onClick();
    const output = renderToStaticMarkup(renderReports());
    assert.equal((output.match(/<article/g) ?? []).length, expected);
    assert(output.includes(`/admin/offerings/${filter === 'all' ? 'empty' : filter}/reports/print?document=all`));
    assert(!output.includes('최종 승인'));
  }
  nodes(renderReports()).find(node => node.type === 'input').props.onChange({ target: { value: 'no-match' } });
  assert(renderToStaticMarkup(renderReports()).includes('조건에 맞는 보고서가 없습니다.'));
});
let reportReads = 0;
let failed = false;
const Reports = load('src/app/admin/reports/page.tsx', { ...common,
  '@/lib/course-workspace/data': { getCourseWorkspaces: async () => { reportReads++; return { courses: [], unavailable: failed }; } },
  '@/components/course-workspace/report-list': { ReportList: () => React.createElement('p', null, '아직 등록된 과정이 없습니다.') },
}).default;
await test('reports reject unrelated roles before reading data and distinguish empty from failure', async () => {
  me = member('SYSTEM_ADMIN'); await assert.rejects(Reports(), /NOT_FOUND/); assert.equal(reportReads, 0);
  me = member('COURSE_MANAGER');
  assert(renderToStaticMarkup(await Reports()).includes('아직 등록된 과정이 없습니다.'));
  failed = true; const output = renderToStaticMarkup(await Reports());
  assert(output.includes('보고서 현황을 불러오지 못했습니다')); assert(!output.includes('아직 등록된 과정이 없습니다.'));
});
console.log(`${checks} role navigation checks passed; synthetic identities only, no DB writes.`);
