import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
function load(file, replacements) {
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { exports: module.exports, module, Date,
    require: name => Object.hasOwn(replacements, name) ? replacements[name] : require(name) });
  return module.exports;
}
let checks = 0;
async function test(name, run) { await run(); checks++; console.log('PASS ' + name); }
const fresh = { active: true, needs_reset: false, staff_required: true, mfa_required: true, mfa_verified: true, recent: true, fresh_minutes: 15 };
const factorId = '10000000-0000-4000-8000-000000000009';
const factors = [{ id: factorId, name: 'Test authenticator', verified: true }];
const panelFile = 'src/components/auth/mfa-panel.tsx';
const routeCalls = [];
const router = { refresh: () => routeCalls.push('refresh'), replace: path => routeCalls.push(path) };
const codeInputFile = 'src/components/auth/mfa-code-input.tsx';
const { MfaCodeInput } = load(codeInputFile, {});
const factorImports = load('src/lib/auth/mfa-factor.ts', {});
const managementFile = 'src/components/auth/mfa-management.tsx';
const managementImports = { 'next/link': { default: 'a' }, 'next/navigation': { useRouter: () => router }, '@/app/auth/mfa-actions': {} };
const { MfaManagement } = load(managementFile, managementImports);
const panelImports = { 'next/image': { default: 'img' }, 'next/link': { default: 'a' },
  '@/components/auth/mfa-management': { MfaManagement },
  '@/components/auth/mfa-code-input': { MfaCodeInput },
  'next/navigation': { useRouter: () => router }, '@/app/auth/mfa-actions': {} };
const { MfaPanel } = load(panelFile, panelImports);
const html = status => renderToStaticMarkup(React.createElement(MfaPanel, { status, factors, next: '/admin', returnToWork: false }));
await test('fresh staff MFA hides the duplicate code form and moves management out of verification', () => {
  const output = html(fresh);
  assert(!output.includes('id="mfa-code"'));
  assert(output.includes('추가 인증된 로그인입니다.'));
  assert(output.includes('다른 인증 앱 추가'));
  assert(!output.includes('연결된 인증 앱 관리'));
});
await test('non-staff can still manage their optional authenticators on the security page', () => {
  assert(html({ ...fresh, staff_required: false }).includes('연결된 인증 앱 관리'));
  assert(!html({ ...fresh, mfa_verified: false, recent: false }).includes('계속하려면 추가 인증이 필요합니다.'));
});
for (const [label, status] of [
  ['unverified session', { ...fresh, mfa_verified: false, recent: false }],
  ['expired recent authentication', { ...fresh, recent: false }],
]) await test(label + ' still displays the code form', () => assert(html(status).includes('id="mfa-code"')));

// Execute handlers from the real component; retain hook state between renders.
function panelHarness(returnToWork, response = { ok: true, message: 'verified' }, factorList = factors) {
  let cursor = 0;
  const states = [], tasks = [], calls = [];
  const hooks = { useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = value; }]; },
    useTransition: () => [false, run => tasks.push(run())] };
  const actions = { verifyMfa: async (id, code) => { calls.push(['verify', id, code]); return response; },
    enrollMfa: async () => ({ enrollment: { id: factorId, qr: 'data:image/svg+xml,test', secret: 'SYNTHETIC' }, message: 'enroll' }),
    removeMfa: async () => ({ ok: true, message: 'removed' }) };
  const { MfaPanel: Panel } = load(panelFile, { ...panelImports, react: hooks, '@/app/auth/mfa-actions': actions });
  return { render: (status = { ...fresh, mfa_verified: false, recent: false }) => { cursor = 0; return Panel({ status, factors: factorList, next: '/admin', returnToWork }); },
    flush: () => Promise.all(tasks.splice(0)), calls };
}
function elements(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...React.Children.toArray(node.props?.children).flatMap(elements)];
}
for (const [label, returnToWork, response, expected] of [
  ['verification returns to the requested work page', true, { ok: true, message: 'verified' }, ['/admin']],
  ['manual security management refreshes in place', false, { ok: true, message: 'verified' }, ['refresh']],
  ['failed verification never navigates', true, { message: 'invalid' }, []],
]) await test(label, async () => {
  routeCalls.length = 0;
  const h = panelHarness(returnToWork, response);
  elements(h.render()).find(e => e.props?.id === 'mfa-code').props.onChange('123456');
  elements(h.render()).find(e => e.type === 'form').props.onSubmit({ preventDefault() {} });
  await h.flush();
  assert.deepEqual(h.calls, [['verify', factorId, '123456']]);
  assert.deepEqual(routeCalls, expected);
});
await test('enrolling another authenticator shows its confirmation even with fresh MFA', async () => {
  const h = panelHarness(false);
  elements(h.render(fresh)).find(e => e.type === 'button' && e.props.children === '다른 인증 앱 추가').props.onClick();
  await h.flush();
  assert(elements(h.render(fresh)).some(e => e.props?.id === 'mfa-code'));
});
function managementHarness(status, factorList, response = { ok: true, message: 'removed' }, pending = false) {
  const tasks = [], calls = [], states = [];
  let cursor = 0;
  const hooks = { useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], next => { states[i] = next; }]; },
    useTransition: () => [pending, run => tasks.push(run())] };
  const { MfaManagement: Manage } = load(managementFile, { ...managementImports, react: hooks,
    '@/app/auth/mfa-actions': { removeMfa: async id => { calls.push(id); return response; } } });
  return { render: () => { cursor = 0; return Manage({ status, factors: factorList }); }, flush: () => Promise.all(tasks.splice(0)), calls };
}
const twoFactors = [...factors, { id: 'second', name: 'Second app', verified: true }];
for (const [label, status, factorList, pending, allowed] of [
  ['last staff factor', fresh, factors, false, false],
  ['expired recent authentication', { ...fresh, recent: false }, twoFactors, false, false],
  ['pending removal', fresh, twoFactors, true, false],
  ['fresh staff with two factors', fresh, twoFactors, false, true],
  ['non-staff last factor', { ...fresh, staff_required: false }, factors, false, true],
]) await test('management preserves removal guard: ' + label, async () => {
  routeCalls.length = 0;
  const h = managementHarness(status, factorList, undefined, pending);
  const button = elements(h.render()).find(e => e.type === 'button');
  assert.equal(button.props.disabled, !allowed);
  button.props.onClick();
  await h.flush();
  assert.equal(h.calls.length, allowed ? 1 : 0);
  assert.deepEqual(routeCalls, allowed ? ['refresh'] : []);
});
await test('server rejection remains visible and cannot remove an authenticator optimistically', async () => {
  routeCalls.length = 0;
  const h = managementHarness(fresh, twoFactors, { message: 'server rejected' });
  elements(h.render()).find(e => e.type === 'button').props.onClick();
  await h.flush();
  assert.equal(elements(h.render()).find(e => e.props?.role === 'alert').props.children, 'server rejected');
  assert.equal(elements(h.render()).filter(e => e.type === 'li').length, 2);
  assert.deepEqual(routeCalls, []);
});

await test('switching authenticators clears the code entered for the previous app', () => {
  const h = panelHarness(false, undefined, [...factors, { id: 'second', name: 'Second app', verified: true }]);
  elements(h.render()).find(e => e.props?.id === 'mfa-code').props.onChange('012345');
  elements(h.render()).find(e => e.props?.id === 'mfa-factor').props.onChange({ target: { value: 'second' } });
  assert.equal(elements(h.render()).find(e => e.props?.id === 'mfa-code').props.value, '');
  assert.equal(elements(h.render()).find(e => e.props?.id === 'mfa-factor').props.value, 'second');
});
await test('relocated add-app action still requires recent authentication', () => {
  const h = panelHarness(false);
  const addButton = status => elements(h.render(status)).find(e => e.type === 'button' && e.props.children === '다른 인증 앱 추가');
  assert.equal(addButton({ ...fresh, recent: false }).props.disabled, true);
  assert.equal(addButton(fresh).props.disabled, false);
  const firstSetup = elements(panelHarness(false, undefined, []).render()).find(e => e.type === 'button' && e.props.children === '인증 앱 연결하기');
  assert.equal(firstSetup.props.disabled, false);
});

function codeHarness(initial = '') {
  let value = initial, cursor = 0;
  const states = [];
  const hooks = { useState(initialState) { const i = cursor++; if (!(i in states)) states[i] = initialState; return [states[i], next => { states[i] = next; }]; } };
  const { MfaCodeInput: Input } = load(codeInputFile, { react: hooks });
  const input = { value, selectionStart: value.length, selectionEnd: value.length,
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; } };
  return { input, value: () => value, render: () => { cursor = 0; return Input({ id: 'mfa-code', value, onChange: next => { value = next; }, disabled: false, describedBy: 'mfa-code-help' }); } };
}
await test('six visual slots retain one accessible native input and leading zeroes', () => {
  const output = renderToStaticMarkup(React.createElement(MfaCodeInput, { id: 'mfa-code', value: '012345', onChange() {}, disabled: false, describedBy: 'mfa-code-help' }));
  assert.equal((output.match(/<input/g) ?? []).length, 1);
  assert.equal((output.match(/<span/g) ?? []).length, 6);
  assert(output.includes('autoComplete="one-time-code"'));
  assert(output.includes('aria-describedby="mfa-code-help"'));
  assert(output.includes('value="012345"'));
});
await test('typing and autofill retain only six digits, including leading zeroes', () => {
  const h = codeHarness();
  h.input.value = '0a1234567';
  h.input.selectionStart = h.input.value.length;
  elements(h.render()).find(e => e.type === 'input').props.onChange({ currentTarget: h.input });
  assert.equal(h.value(), '012345');
  assert.equal(h.input.selectionStart, 6);
});
await test('formatted paste replaces all slots without losing digits at spaces', () => {
  const h = codeHarness('999999');
  let prevented = false;
  elements(h.render()).find(e => e.type === 'input').props.onPaste({ currentTarget: h.input,
    clipboardData: { getData: () => '012 345' }, preventDefault: () => { prevented = true; } });
  assert(prevented);
  assert.equal(h.value(), '012345');
});
await test('short paste replaces the selected digit without altering the other slots', () => {
  const h = codeHarness('012345');
  h.input.setSelectionRange(2, 3);
  elements(h.render()).find(e => e.type === 'input').props.onPaste({ currentTarget: h.input,
    clipboardData: { getData: () => '9' }, preventDefault() {} });
  assert.equal(h.value(), '019345');
  assert.equal(h.input.selectionStart, 3);
});

const redirect = path => { const error = Error('REDIRECT'); error.destination = path; throw error; };
const { safeReturnTo } = load('src/lib/auth/session.ts', { 'next/navigation': { redirect },
  '@/lib/supabase/server': {}, '@/lib/auth/mfa': {}, '@/lib/deployment/review-mode': {} });
function pageHarness(status = fresh) {
  let reads = 0;
  const page = load('src/app/auth/security/page.tsx', { 'next/link': { default: 'a' }, 'next/navigation': { redirect },
    '@/lib/auth/mfa-factor': factorImports,
    '@/components/common/support-contact': { SupportContact: 'aside' },
    '@/lib/auth/mfa': { getSecurityContext: async () => status ? { email: 'synthetic@example.invalid', status } : null },
    '@/lib/auth/session': { safeReturnTo }, '@/components/auth/mfa-panel': { MfaPanel: 'section' },
    '@/app/auth/actions': { signOut() {} }, '@/lib/supabase/server': { createServerSupabaseClient: async () => ({ auth: { mfa: {
      listFactors: async () => { reads++; return { data: { all: [] } }; },
    } } }) } }).default;
  return { run: next => page({ searchParams: Promise.resolve({ next }) }), reads: () => reads };
}
for (const [next, destination] of [['/', '/'], ['/admin?view=system', '/admin?view=system'], ['https://example.invalid', '/'], ['//example.invalid', '/'], ['/auth/security?next=/admin', '/']]) {
  await test('verified return URL is normalized safely: ' + next, async () => {
    const p = pageHarness();
    await assert.rejects(p.run(next), error => error.destination === destination);
    assert.equal(p.reads(), 0);
  });
}
for (const [label, status, next] of [
  ['direct settings visit remains available', fresh, undefined],
  ['unverified session cannot skip MFA', { ...fresh, mfa_verified: false, recent: false }, '/admin'],
  ['expired sensitive-operation check cannot skip MFA', { ...fresh, recent: false }, '/admin'],
  ['password reset requirement takes precedence', { ...fresh, needs_reset: true }, '/admin'],
]) await test(label, async () => assert(await pageHarness(status).run(next)));
await test('signed-out user is sent to login instead of a protected destination', async () => {
  await assert.rejects(pageHarness(null).run('/admin'), error => error.destination.startsWith('/auth/login?next='));
});

for (const [label, finalStatus, nativeError, success] of [
  ['confirmed native MFA', fresh, false, true],
  ['rejected native code', fresh, true, false],
  ['unverified server state', { ...fresh, mfa_verified: false }, false, false],
  ['expired server state', { ...fresh, recent: false }, false, false],
  ['inactive account', { ...fresh, active: false }, false, false],
  ['reset-required account', { ...fresh, needs_reset: true }, false, false],
]) await test('action accepts only ' + label, async () => {
  let verified = false, revalidated = false;
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'synthetic' } } }), mfa: {
    listFactors: async () => ({ data: { all: [{ id: factorId, factor_type: 'totp' }] } }),
    challengeAndVerify: async () => { verified = true; return nativeError ? { error: {} } : {}; },
  } }, rpc: async () => ({ data: verified ? finalStatus : fresh }) };
  const { verifyMfa } = load('src/app/auth/mfa-actions.ts', { 'next/cache': { revalidatePath: () => { revalidated = true; } },
    '@/lib/supabase/server': { createServerSupabaseClient: async () => client },
    '@/lib/portal/data': { UUID: /^[0-9a-f-]{36}$/ }, '@/lib/auth/mfa-message': { MFA_REAUTH_MESSAGE: 'reauth' } });
  assert.equal((await verifyMfa(factorId, '123456')).ok === true, success);
  assert.equal(revalidated, success);
});
for (const [label, context, failure] of [
  ['staff own account', { status: fresh }, false],
  ['factor lookup failure', { status: fresh }, true],
  ['non-staff hidden', { status: { ...fresh, staff_required: false } }, false],
  ['missing session fails closed', null, false],
]) await test('my-page security lookup: ' + label, async () => {
  let reads = 0;
  const { AccountSecurity } = load('src/components/auth/account-security.tsx', {
    'next/link': { default: 'a' }, '@/lib/auth/mfa': { getSecurityContext: async () => context },
    '@/lib/auth/mfa-factor': factorImports, '@/components/auth/mfa-management': { MfaManagement },
    '@/lib/supabase/server': { createServerSupabaseClient: async () => ({ auth: { mfa: {
      listFactors: async (...args) => {
        assert.equal(args.length, 0); reads++;
        return { error: failure ? Error('lookup') : null, data: { all: [
          { id: factorId, friendly_name: 'Own authenticator', factor_type: 'totp', status: 'verified', created_at: '2026-09-19T03:41:12Z' },
        ] } };
      },
    } } }) },
  });
  const tree = await AccountSecurity();
  if (context && !context.status.staff_required) { assert.equal(tree, null); assert.equal(reads, 0); return; }
  const output = renderToStaticMarkup(tree);
  assert.equal(reads, context ? 1 : 0);
  if (!context || failure) {
    assert(output.includes('role="alert"')); assert(!output.includes('이 인증 앱 연결 해제'));
  } else {
    assert(output.includes('Own authenticator')); assert(output.includes('연결된 인증 앱 관리'));
    assert(output.includes('disabled=""'));
  }
});
for (const [label, roles, expected] of [
  ['learner', [], false], ['instructor', ['INSTRUCTOR'], false],
  ['administrator', ['SYSTEM_ADMIN'], true], ['operator', ['COURSE_MANAGER'], true],
]) await test('my-page renders security management only for staff: ' + label, async () => {
  const query = { select() { return this; }, eq(column, id) { assert.equal(column, 'person_id'); assert.equal(id, 'self'); return this; },
    order: async () => ({ data: [], error: null }) };
  const MyPage = load('src/app/mypage/page.tsx', {
    'next/link': { default: 'a' }, '@/lib/auth/session': { requireIdentity: async () => ({ id: 'self', name: 'Synthetic', roles: roles.map(role => ({ role })) }) },
    '@/lib/supabase/server': { createServerSupabaseClient: async () => ({ from: () => query }) },
    '@/lib/portal/data': { getWorkspaceOfferings: async () => ({ offerings: [], unavailable: false }) },
    '@/components/portal/action-form': { ActionForm: 'form' }, '@/app/actions': {},
    '@/components/portal/ui': { Empty: 'section', PageIntro: 'section' },
    '@/components/auth/account-security': { AccountSecurity: 'account-security' },
  }).default;
  assert.equal(elements(await MyPage()).some(element => element.type === 'account-security'), expected);
});
console.log(`${checks} MFA navigation regressions passed; no network, real accounts, or mail.`);
