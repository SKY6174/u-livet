import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import * as icons from 'lucide-react';

const redirect = destination => { throw Object.assign(new Error('REDIRECT'), { destination }); };
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
const registration = load('src/lib/auth/registration.ts', {});
const audiences = load('src/lib/auth/login-audience.ts', {});
const navigation = load('src/lib/auth/workspace-navigation.ts', { './login-audience': audiences });
const Link = ({ children, ...props }) => React.createElement('a', props, children);
let currentIdentity = null;
let security = null;
let courseReads = 0;
const session = load('src/lib/auth/session.ts', {
  react: { cache: fn => fn }, 'next/navigation': { redirect },
  '@/lib/deployment/review-mode': { isReviewOnly: () => false },
  '@/lib/auth/mfa': { getSecurityContext: async () => security },
  '@/lib/supabase/server': { createServerSupabaseClient: async () => ({
    auth: { getUser: async () => ({ data: { user: currentIdentity ? { email: 'synthetic@example.invalid' } : null } }) },
    rpc: async () => ({ data: currentIdentity }),
  }) },
});
const Home = load('src/app/page.tsx', {
  'react/jsx-runtime': jsx, 'next/link': { default: Link }, 'lucide-react': icons,
  '@/lib/auth/session': session, '@/lib/auth/workspace-navigation': navigation,
  '@/lib/portal/data': { getCourseCards: async () => { courseReads++; return { offerings: [], unavailable: false }; } },
  '@/components/portal/ui': { CourseCard: () => null, Empty: ({ title }) => React.createElement('p', null, title) },
}).default;
const Login = load('src/app/auth/login/page.tsx', {
  'react/jsx-runtime': jsx, 'next/link': { default: Link }, 'next/navigation': { redirect },
  '@/lib/auth/session': session, '@/lib/auth/registration': registration,
  '@/lib/auth/login-audience': audiences, '@/components/auth/auth-form': { AuthForm: () => React.createElement('form') },
}).default;
let checks = 0;
const pass = name => { checks++; console.log('PASS ' + name); };
await assert.rejects(Home(), e => e.destination === '/auth/login?next=%2F');
assert.equal(courseReads, 0);
const entry = renderToStaticMarkup(await Login({ searchParams: Promise.resolve({}) }));
for (const label of ['사업단', '강사(교내)', '강사(교외)', '수강생']) assert.ok(entry.includes(label));
assert.equal((entry.match(/next=%2F"/g) ?? []).length, 4);
pass('guest reaches four login choices before personal content is loaded');
security = { status: { mfa_required: true, mfa_verified: false, needs_reset: false } };
await assert.rejects(Home(), e => e.destination === '/auth/security?next=%2F');
assert.equal(courseReads, 0);
pass('MFA-incomplete identity cannot reach personal home');
security = null;
for (const [roles, expected, hidden] of [
  [[], ['나의 강의실', '신청 현황', '수강이력·수료 현황'], ['/instructor', '/admin']],
  [['INSTRUCTOR'], ['강사 공간', '강사 이력·등록 심사'], ['/admin', '/finance']],
  [['SYSTEM_ADMIN'], ['계정 관리', '사업단 관리 시작하기'], ['/instructor', '/finance']],
  [['COURSE_MANAGER'], ['과정 운영'], ['/admin/accounts', '/finance']],
  [['FINANCE'], ['수납·환불'], ['/admin/accounts', '/instructor']],
  [['CERTIFIER'], ['증명 관리'], ['/admin/accounts', '/finance']],
  [['PERFORMANCE'], ['연차 평가·성과'], ['/admin/accounts', '/finance']],
  [['SYSTEM_ADMIN', 'COURSE_MANAGER', 'INSTRUCTOR'], ['사업단 관리 시작하기', '과정 운영', '강사 공간'], ['/finance']],
]) {
  currentIdentity = { id: 'synthetic', name: '검증 회원', roles: roles.map(role => ({ role, org_id: 'synthetic-org' })) };
  const html = renderToStaticMarkup(await Home());
  assert.ok(html.includes('검증 회원 님, 반갑습니다.'));
  const kind = navigation.workspaceKind(currentIdentity);
  assert.ok(html.includes(kind === 'office' ? '사업단 업무를,' : kind === 'instructor' ? '나의 강의와,' : '지금의 배움이,'));
  for (const item of expected) assert.ok(html.includes(item), item);
  for (const item of hidden) assert.ok(!html.includes(item), `unexpected ${item}`);
  pass('personal home shows only granted work links: ' + (roles.join(',') || 'learner'));
}
for (const [next, expected] of [[undefined, '/'], ['/courses/123/apply', '/courses/123/apply'], ['/auth/login', '/'], ['//example.invalid', '/']]) {
  await assert.rejects(Login({ searchParams: Promise.resolve({ next }) }), e => e.destination === expected);
}
pass('already authenticated login visits return safely to home or requested work');
currentIdentity = null;
await assert.rejects(Home(), e => e.destination === '/auth/login?next=%2F');
pass('cleared login state returns home to login choices');
console.log(`${checks} personal start checks passed; synthetic data only.`);
