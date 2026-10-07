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
const menuHint = load('src/components/navigation/menu-hint.tsx');
const member = (...roles) => ({ id: 'self', name: '검증 회원', email: 'synthetic@example.invalid', roles: roles.map(role => ({ role, org_id: 'own-org' })) });
let me = member();
let path = '/admin';
const notFound = () => { throw new Error('NOT_FOUND'); };
const redirect = destination => { throw Object.assign(new Error('REDIRECT'), { destination }); };
let learnerRequestReads = 0;
const common = {
  'next/link': 'a', 'next/navigation': { notFound, redirect, usePathname: () => path },
  '@/lib/auth/session': { requireIdentity: async () => { if (!me) throw new Error('LOGIN_REQUIRED'); return me; } },
  '@/lib/auth/workspace-navigation': nav,
  '@/lib/learner-document-workflow/data': { getAdminLearnerDocuments: async () => { learnerRequestReads++; return { organizations: [], requests: [] }; } },
  '@/components/admin/learner-request-alerts': { LearnerRequestAlerts: () => React.createElement('section', null, '실시간 수강생 요청') },
  '@/components/navigation/menu-hint': menuHint,
};
// This .mjs uses React.createElement so it needs no JSX runtime in Node.
common['@/components/portal/ui'] = {
  PageIntro: ({ title, children }) => React.createElement('header', null, React.createElement('h1', null, title), children),
  Empty: ({ title, children }) => React.createElement('div', null, title, children),
};
const workflowTypes = load('src/lib/learner-document-workflow/types.ts');
const LearnerRequestAlerts = load('src/components/admin/learner-request-alerts.tsx', {
  'next/link': 'a',
  '@/components/admin/admin-live-refresh': { AdminLiveRefresh: () => React.createElement('button', null, '지금 갱신') },
  '@/lib/learner-document-workflow/types': workflowTypes,
}).LearnerRequestAlerts;
const roleCases = [
  [[], [], 'learner'], [['INSTRUCTOR'], [], 'instructor'],
  [['SYSTEM_ADMIN'], ['/admin/courses', '/operation-documents/plan', '/admin/learner-documents', '/admin/parking', '/operation-documents/result', '/admin/accounts'], 'office'],
  [['COURSE_MANAGER'], ['/admin/development', '/admin/courses', '/operation-documents/plan', '/admin/applications', '/admin/learners', '/admin/monitoring', '/admin/learner-documents', '/admin/parking', '/operation-documents/result', '/completion', '/credentials', '/performance', '/admin/instructors'], 'office'],
  [['CERTIFIER'], ['/completion', '/credentials'], 'office'],
  [['FINANCE'], ['/admin/learner-documents', '/finance'], 'office'], [['PERFORMANCE'], ['/performance'], 'office'],
];
for (const [roles, links, kind] of roleCases) await test('granted role menus: ' + (roles.join(',') || 'learner'), () => {
  const identity = member(...roles);
  assert.deepEqual(nav.officeSections(identity).flatMap(section => section.links.map(link => link.href)), links);
  assert.equal(nav.workspaceKind(identity), kind);
  const primary = nav.primaryLinks(identity).map(link => link.href);
  assert.deepEqual(primary.slice(0, 4), ['/about', '/operation-procedure', '/terms', '/courses']);
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
  const publicLinks = [
    { label: '앵커사업 소개', href: '/about' },
    { label: '운영절차', href: '/operation-procedure' },
    { label: '수강안내', href: '/terms' },
    { label: '교육과정 소개', href: '/courses' },
  ];
  assert.deepEqual(nav.primaryLinks(null), publicLinks);
  assert.deepEqual(nav.primaryLinks(member('COURSE_MANAGER'), true), publicLinks);
});
await test('combined roles preserve independent workspaces without duplicate links', () => {
  const mixed = member('SYSTEM_ADMIN', 'COURSE_MANAGER', 'INSTRUCTOR', 'CERTIFIER', 'FINANCE', 'PERFORMANCE');
  const primary = nav.primaryLinks(mixed).map(link => link.href);
  assert(primary.includes('/admin') && primary.includes('/instructor'));
  const hrefs = nav.officeSections(mixed).flatMap(section => section.links.map(link => link.href));
  assert.equal(new Set(hrefs).size, hrefs.length);
  assert.deepEqual(hrefs.slice(-2), ['/admin/instructors', '/admin/accounts']);
});
await test('office navigation follows the operational workflow', () => {
  const sections = nav.officeSections(member('COURSE_MANAGER', 'FINANCE'));
  assert.deepEqual(sections.map(section => section.title), ['기획·개설', '접수·운영', '마감·수료', '정산·성과', '계정·권한']);
  assert.deepEqual(sections.flatMap(section => section.links.map(link => link.href)), [
    '/admin/development', '/admin/courses', '/operation-documents/plan',
    '/admin/applications', '/admin/learners',
    '/admin/monitoring', '/admin/learner-documents', '/admin/parking',
    '/operation-documents/result', '/completion', '/credentials',
    '/finance', '/performance', '/admin/instructors',
  ]);
});
await test('learner request alerts count only unresolved requests by document type', () => {
  const request = (kind, status, index) => ({ id: String(index), kind, status, course_name: `과정 ${index}`, applicant_name: `신청자 ${index}`, submitted_at: '2026-09-23T12:00:00Z' });
  const output = renderToStaticMarkup(React.createElement(LearnerRequestAlerts, { data: { organizations: [], requests: [
    request('APPLICATION', 'RECEIVED', 1), request('APPLICATION', 'COMPLETED', 2),
    request('SCHOLARSHIP', 'REVIEWING', 3), request('REFUND', 'APPROVED', 4),
    request('REFUND', 'REJECTED', 5),
  ] } }));
  assert(output.includes('미처리 3건'));
  assert.match(output, /수강신청원서[\s\S]*?1<span[^>]*>건/);
  assert.match(output, /장학금 지급신청서[\s\S]*?1<span[^>]*>건/);
  assert.match(output, /수강료환불신청서[\s\S]*?1<span[^>]*>건/);
  assert(!output.includes('신청자 2'));
  assert(!output.includes('신청자 5'));
});
await test('expert management is an independent office menu with correct nested selection', () => {
  const expert = nav.officeSections(member('COURSE_MANAGER')).flatMap(section => section.links).find(link => link.href === '/admin/instructors');
  assert.equal(expert.label, '강사 관리');
  for (const pathname of ['/admin/instructors', '/admin/instructors/documents']) {
    assert.equal(nav.officeActiveHref(pathname), '/admin/instructors');
    assert(nav.primaryActive(pathname, '/admin'));
  }
  for (const roles of [[], ['INSTRUCTOR'], ['SYSTEM_ADMIN'], ['FINANCE']]) {
    assert(!nav.officeSections(member(...roles)).flatMap(section => section.links).some(link => link.href === '/admin/instructors'));
  }
});
await test('nested report, completion and certificate routes stay under the office menu', () => {
  for (const [pathname, active] of [['/admin', '/admin'], ['/admin/development', '/admin/development'], ['/admin/monitoring', '/admin/monitoring'], ['/admin/course-plan/opening', '/admin/courses'], ['/admin/offerings/id', '/admin/courses'], ['/operation-documents/id/plan', '/operation-documents/plan'], ['/operation-documents/id/result', '/operation-documents/result'], ['/admin/reports', '/operation-documents/result'], ['/admin/offerings/id/reports/print', '/operation-documents/result'], ['/completion/id', '/completion'], ['/credentials/badges', '/credentials'], ['/admin/accounts', '/admin/accounts']]) {
    assert.equal(nav.officeActiveHref(pathname), active);
    assert(nav.primaryActive(pathname, '/admin'));
  }
  assert(!nav.primaryActive('/administrator', '/admin'));
});
const Header = load('src/components/common/Header.tsx', { ...common, react: { ...React, useState: () => [true, () => {}] },
  'next/image': ({ priority, ...props }) => React.createElement('img', props),
  '@/lib/auth/roleContext': { useRole: () => me }, '@/app/auth/actions': { signOut: '/sign-out' },
}).default;
await test('desktop and mobile office menus group links by visible workflow category', () => {
  for (const roles of [['COURSE_MANAGER', 'FINANCE'], ['FINANCE'], ['CERTIFIER']]) {
    me = member(...roles);
    const sections = nav.officeSections(me);
    const output = renderToStaticMarkup(React.createElement(Header));
    for (const surface of ['desktop', 'mobile']) {
      const cards = output.match(new RegExp(`<section\\b[^>]*aria-labelledby="${surface}-office-category-\\d+"[^>]*>[\\s\\S]*?<\\/section>`, 'g')) ?? [];
      assert.equal(cards.length, sections.length, `${surface}: ${roles.join(',')}`);
      sections.forEach(({ title, links }, index) => {
        assert(cards[index].includes(`>${title}</h3>`), `${surface}: ${title}`);
        for (const link of links) assert(cards[index].includes(`href="${link.href}"`), `${surface}: ${title} / ${link.label}`);
      });
    }
  }
});
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
    const readsBefore = learnerRequestReads;
    const output = renderToStaticMarkup(await Admin({ searchParams: Promise.resolve({}) }));
    for (const { links } of nav.officeSections(me)) {
      for (const link of links) assert(output.includes(link.description), `accessible description: ${link.href}`);
    }
    for (const href of expected) assert(output.includes(`href="${href}"`), href + kind);
    assert.equal(output.includes('실시간 수강생 요청'), roles.some(role => ['SYSTEM_ADMIN', 'COURSE_MANAGER', 'FINANCE'].includes(role)));
    assert.equal(learnerRequestReads - readsBefore, roles.some(role => ['SYSTEM_ADMIN', 'COURSE_MANAGER', 'FINANCE'].includes(role)) ? 1 : 0);
    await AdminLayout({ children: null });
  }
});
await test('course subtrees retain their existing server role gates', async () => {
  const redirectOnly = ['finance', 'performance', 'kpi'];
  for (const dir of readdirSync('src/app/admin', { withFileTypes: true }).filter(dir => dir.isDirectory())) {
    if (['accounts', 'course-requests', 'learner-documents', 'parking'].includes(dir.name)) continue; // pages enforce their own role gates
    if (redirectOnly.includes(dir.name)) continue; // no data; destination layout gates it
    const gate = load(`src/app/admin/${dir.name}/layout.tsx`, { '@/components/navigation/office-section': section }).default;
    const run = async () => {
      const output = await gate({ children: null });
      if (React.isValidElement(output) && typeof output.type === 'function') return output.type(output.props);
      return output;
    };
    for (const roles of [[], ['INSTRUCTOR'], ['SYSTEM_ADMIN'], ['CERTIFIER'], ['FINANCE'], ['PERFORMANCE']]) {
      me = member(...roles);
      if (dir.name === 'courses' && roles.includes('SYSTEM_ADMIN')) await run();
      else await assert.rejects(run, /NOT_FOUND/);
    }
    me = member('COURSE_MANAGER'); await run();
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
  '@/lib/student-learning/data': { getStudentLearning: async () => { appReads++; return {}; } },
  '@/components/student-learning/dashboard': { StudentDashboard: () => React.createElement('p', null, '학생 대시보드') },
  '@/components/auth/account-security': { AccountSecurity: () => React.createElement('section', null, '연결된 인증 앱 관리') },
}).default;
await test('My Room unifies instructor and dual-role accounts without querying learner data', async () => {
  for(const roles of [['INSTRUCTOR'], ['COURSE_MANAGER','INSTRUCTOR']]) {
    me = member(...roles); const before = appReads;
    await assert.rejects(MyPage(), error => error.destination === '/instructor');
    assert.equal(appReads,before);
    const links = nav.primaryLinks(me);
    assert.equal(links.filter(link => link.label === 'My Room').length,1);
    assert(!links.some(link => link.href === '/mypage'));
  }
  for(const pathname of ['/instructor/records','/mypage/instructor','/mypage/notifications','/mypage/certificates','/auth/security','/development','/quality/any']) assert(nav.primaryActive(pathname,'/instructor'));
  assert(!nav.primaryActive('/instructor-other','/instructor'));
  for (const pathname of ['/courses', '/courses/guide', '/offerings/fixture', '/offerings/fixture/apply']) assert(nav.primaryActive(pathname, '/courses'));
  assert(!nav.primaryActive('/offerings-other', '/courses'));
  me=member('COURSE_MANAGER'); const account = renderToStaticMarkup(await MyPage());
  assert(account.includes('aria-label="내 계정 정보"')); assert(account.includes('href="/mypage/notifications"'));
  const before=appReads; me=member(); assert(renderToStaticMarkup(await MyPage()).includes('학생 대시보드')); assert.equal(appReads,before+1);
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
let documentFailure = false;
let legacyFailure = false;
const documentPrefilled = {
  PREFILLED_COURSES: [{ id: 'fixture-course', sourceId: 'P01', programId: 'FIXTURE-01', title: '검증 과정', academy: '검증', capacity: 10, teachingHours: 8, startsOn: '2026-01-01', endsOn: '2026-02-01', timeLabel: '검증 시간', location: '검증실', teachers: '책임강사', facultyCoordinator: '책임강사', assistants: '-', supportStaff: '-', hasResultReport: false }],
  findPrefilledCourse: name => name === '검증 과정' ? { id: 'fixture-course' } : undefined,
};
const DocumentList = load('src/components/operation-documents/document-list.tsx', { ...common,
  '@/lib/supabase/server': { createServerSupabaseClient: async () => ({
    from: () => ({ select: () => ({
      eq: async () => ({ data: [{ source_id: 'P01', offering_id: 'course-1' }], error: null }),
      in: async () => ({ data: [{ id: 'own-org', name: '담당 기관' }], error: null }),
    }) }),
    rpc: async () => ({
    data: [{ id: 'course-1', org_id: '10000000-0000-4000-8000-000000000001', org_name: '앵커사업단', year: 2026, year_label: '2026년', name: '검증 과정(수정)', starts_on: '2026-01-01', ends_on: '2026-02-01', responsible: '책임강사', plan_status: 'DRAFT', result_status: 'REVIEW' }],
    error: documentFailure ? new Error('unavailable') : null,
  }) }) },
  '@/lib/course-workspace/data': { getCourseWorkspaces: async () => { reportReads++; return { courses: [], unavailable: legacyFailure }; } },
  '@/lib/operation-documents/model': { STATUS_LABELS: { DRAFT: '작성 중', REVIEW: '검토 중' } },
  '@/lib/operation-documents/prefilled-data': documentPrefilled,
  '@/components/course-workspace/report-list': { ReportList: () => React.createElement('p', null, '기존 결과 보고 목록') },
  './document-list-view': { DocumentListView: ({ kind, courses }) => React.createElement('div', null, courses.filter(course => course.registered).map(course => React.createElement('a', { key: course.id, href: `/operation-documents/${course.id}/${kind}` }, course.name))) },
}).DocumentList;
await test('plan and result menus separate documents and keep legacy reports manager-only', async () => {
  me = member('COURSE_MANAGER');
  let output = renderToStaticMarkup(await DocumentList({ kind: 'plan' }));
  assert(output.includes('/operation-documents/course-1/plan'));
  assert(!output.includes('/operation-documents/course-1/result'));
  assert(!output.includes('기존 결과 보고 목록'));
  assert.equal(reportReads, 0);
  output = renderToStaticMarkup(await DocumentList({ kind: 'result' }));
  assert(output.includes('/operation-documents/course-1/result'));
  assert(output.includes('/operation-documents/result?view=evidence'));
  assert(!output.includes('기존 결과 보고 목록'));
  assert.equal(reportReads, 0);
  output = renderToStaticMarkup(await DocumentList({ kind: 'result', view: 'evidence' }));
  assert(output.includes('기존 결과 보고 목록'));
  assert(output.includes('결과 보고(5종 증빙 포함)'));
  assert(!output.includes('6종 증빙'));
  assert(!output.includes('/operation-documents/course-1/result'));
  assert.equal(reportReads, 1);
  for (const role of ['SYSTEM_ADMIN', 'INSTRUCTOR']) {
    me = member(role);
    output = renderToStaticMarkup(await DocumentList({ kind: 'result' }));
    assert(output.includes('/operation-documents/course-1/result'));
    assert(!output.includes('기존 결과 보고 목록'));
    assert.equal(reportReads, 1);
    await assert.rejects(DocumentList({ kind: 'result', view: 'evidence' }), /NOT_FOUND/);
  }
  me = member('COURSE_MANAGER'); documentFailure = true;
  output = renderToStaticMarkup(await DocumentList({ kind: 'result' }));
  assert(output.includes('문서 현황을 불러오지 못했습니다'));
  assert(!output.includes('기존 결과 보고 목록'));
  documentFailure = false; legacyFailure = true;
  output = renderToStaticMarkup(await DocumentList({ kind: 'result', view: 'evidence' }));
  assert(output.includes('증빙 현황을 불러오지 못했습니다'));
});
const Reports = load('src/app/admin/reports/page.tsx', common).default;
const Documents = load('src/app/operation-documents/page.tsx', common).default;
await test('saved list addresses redirect to the matching menu', async () => {
  assert.throws(() => Reports(), error => error.destination === '/operation-documents/result?view=evidence');
  assert.throws(() => Documents(), error => error.destination === '/operation-documents/plan');
});
console.log(`${checks} role navigation checks passed; synthetic identities only, no DB writes.`);
