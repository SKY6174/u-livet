import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
const registration = load('src/lib/auth/registration.ts');
const members = load('src/lib/members/model.ts', { '@/lib/auth/login-audience': audience, '@/lib/auth/registration': registration });
const model = load('src/lib/account-profile/model.ts', { '@/lib/auth/registration': registration, '@/lib/members/model': members });
const nav = load('src/lib/auth/workspace-navigation.ts', { './login-audience': audience });
const form = values => { const result = new FormData(); Object.entries(values).forEach(([key, value]) => result.set(key, value)); return result; };
const input = { mobile_phone: '010-1234-5678', office_phone: '052-230-0000', school_email: ' NAME@UC.AC.KR ', personal_email: 'personal@example.invalid', affiliation: ' 기계공학과 ', job_title: ' 교수 ' };
const profile = { mobile_phone: '+821012345678', office_phone: '0522300000', school_email: 'name@uc.ac.kr', personal_email: 'personal@example.invalid', affiliation: '기계공학과', job_title: '교수' };
await test('phone, email and text values normalize; empty fields can be cleared', () => {
  assert.deepEqual(model.accountProfileInput(form(input)).data, { p_mobile_phone: profile.mobile_phone, p_office_phone: profile.office_phone, p_school_email: profile.school_email, p_personal_email: profile.personal_email, p_affiliation: profile.affiliation, p_job_title: profile.job_title });
  assert(Object.values(model.accountProfileInput(new FormData()).data).every(value => value === null));
  for (const [key, value] of [['mobile_phone', '010-123'], ['mobile_phone', '01012345678'.repeat(3)], ['office_phone', '123'], ['school_email', 'wrong'], ['personal_email', 'a@b'], ['personal_email', 'a'.repeat(255) + '@a.co'], ['affiliation', 'a'.repeat(101)], ['job_title', 'a'.repeat(101)]]) {
    assert(model.accountProfileInput(form({ ...input, [key]: value })).error, key);
  }
});
let identity = { id: 'own-person', name: '검증 회원', email: 'name@uc.ac.kr', roles: [{ role: 'SYSTEM_ADMIN' }] };
let rpcError = null, unavailable = false, calls = [], revalidated = [];
const client = { rpc: async (name, args) => { calls.push({ name, args }); return { data: { ...profile, has_profile: true }, error: rpcError }; } };
const actions = load('src/app/mypage/account-actions.ts', {
  'next/cache': { revalidatePath: (...args) => revalidated.push(args) },
  '@/lib/auth/session': { getSessionIdentity: async () => identity },
  '@/lib/auth/workspace-navigation': nav, '@/lib/account-profile/model': model,
  '@/lib/supabase/server': { createServerSupabaseClient: async () => { if (unavailable) throw new Error('UNAVAILABLE'); return client; } },
  '@/lib/deployment/review-mode': { isReviewOnly: () => false },
});
await test('server action saves only normalized own fields and refreshes both account screens', async () => {
  const result = await actions.saveAccountProfile({}, form({ ...input, person_id: 'someone-else', role: 'SYSTEM_ADMIN' }));
  assert.equal(result.ok, true); assert.equal(calls.at(-1).name, 'life_save_account_profile');
  assert(!('person_id' in calls.at(-1).args)); assert(!('role' in calls.at(-1).args));
  assert(revalidated.some(([path]) => path === '/mypage')); assert(revalidated.some(([path]) => path === '/instructor'));
});
await test('signed-out, learner and malformed requests never call storage', async () => {
  calls = []; const office = identity;
  for (const invalid of [null, { ...office, roles: [] }]) { identity = invalid; assert(!(await actions.saveAccountProfile({}, form(input))).ok); }
  identity = office; assert(!(await actions.saveAccountProfile({}, form({ ...input, personal_email: 'invalid' }))).ok);
  assert.equal(calls.length, 0);
});
await test('storage failures are reported without a false success', async () => {
  rpcError = { code: 'ERROR' }; assert(!(await actions.saveAccountProfile({}, form(input))).ok); rpcError = null;
  unavailable = true; assert(!(await actions.saveAccountProfile({}, form(input))).ok); unavailable = false;
});
const AccountInfo = load('src/components/account-profile/account-info.tsx', {
  '@/components/portal/action-form': { ActionForm: ({ children, label }) => React.createElement('form', null, children, React.createElement('button', null, label)) },
  '@/app/mypage/account-actions': actions, '@/lib/members/model': members,
}).AccountInfo;
await test('six profile fields render with populated editable values and an accessible native disclosure', () => {
  const html = renderToStaticMarkup(React.createElement(AccountInfo, { profile }));
  for (const label of ['핸드폰 번호', '사무실 번호', '이메일(학교)', '이메일(개인)', '소속(학과/부서)', '직책', '내 정보 수정', '변경사항 저장']) assert(html.includes(label));
  assert(html.includes('010-1234-5678')); assert(html.includes('052-230-0000'));
  assert.equal((html.match(/<input/g) ?? []).length, 6); assert(html.includes('<summary'));
  const missing = renderToStaticMarkup(React.createElement(AccountInfo, { profile: null }));
  assert(missing.includes('role="alert"')); assert(!missing.includes('<input'));
});
const redirect = destination => { throw Object.assign(new Error('REDIRECT'), { destination }); };
const common = {
  'next/link': 'a', 'next/navigation': { redirect, notFound: () => { throw new Error('NOT_FOUND'); } },
  '@/lib/auth/session': { requireIdentity: async () => identity }, '@/lib/auth/workspace-navigation': nav,
  '@/components/portal/ui': { PageIntro: ({ title, children }) => React.createElement('header', null, title, children), Empty: ({ title }) => React.createElement('p', null, title) },
  '@/lib/account-profile/data': { getAccountProfile: async () => profile }, '@/components/account-profile/account-info': { AccountInfo },
};
const mypage = load('src/app/mypage/page.tsx', { ...common,
  '@/lib/student-learning/data': { getStudentLearning: () => { throw new Error('UNEXPECTED_LEARNER_READ'); } },
  '@/components/student-learning/dashboard': { StudentDashboard: () => null },
}).default;
const room = load('src/app/instructor/page.tsx', { ...common,
  '@/lib/classroom-questions/data': { getInstructorHomeSummary: async () => [] },
  '@/lib/portal/data': { getWorkspaceOfferings: async () => ({ offerings: [], unavailable: false }) },
}).default;
await test('office, internal and external instructor screens display profile without reception settings', async () => {
  const office = identity;
  const html = renderToStaticMarkup(await mypage()); assert(html.includes('내 정보 수정')); assert(!html.includes('/mypage/notifications'));
  for (const kind of ['INTERNAL', 'EXTERNAL']) {
    identity = { ...office, roles: [{ role: 'INSTRUCTOR' }], instructor_kind: kind };
    const result = renderToStaticMarkup(await room()); assert(result.includes('내 정보 수정')); assert(!result.includes('/mypage/notifications'));
    assert(result.includes('강사 서류 제출')); assert.equal(result.includes('무료 주차권 신청'), kind === 'EXTERNAL');
  }
  identity = office;
});
let preferenceReads = 0;
const notifications = load('src/app/mypage/notifications/page.tsx', { ...common,
  '@/lib/supabase/server': { createServerSupabaseClient: async () => ({ rpc: async () => { preferenceReads++; return { data: [{ id: 'org', name: '기관', policies: [], events: [{ id: 'event', accepted: true }], accepted: false, effective: false, contact: null }] }; } }) },
  '@/components/portal/action-form': { ActionForm: () => null }, '@/app/message-actions': {}, '@/lib/portal/data': { dateTime: value => value },
}).default;
await test('staff direct settings URLs redirect before querying; learner reception remains without consent history', async () => {
  const office = identity;
  for (const roles of [['SYSTEM_ADMIN'], ['INSTRUCTOR']]) {
    identity = { ...office, roles: roles.map(role => ({ role })) };
    await assert.rejects(notifications, error => error.destination === (roles[0] === 'INSTRUCTOR' ? '/instructor' : '/mypage'));
  }
  assert.equal(preferenceReads, 0); identity = { ...office, roles: [] };
  const html = renderToStaticMarkup(await notifications()); assert(html.includes('SMS 홍보 수신')); assert(!html.includes('나의 동의')); assert.equal(preferenceReads, 1);
});
console.log(`${checks} account profile checks passed`);
