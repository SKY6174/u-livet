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
const panelImports = { 'next/image': { default: 'img' }, 'next/link': { default: 'a' },
  'next/navigation': { useRouter: () => router }, '@/app/auth/mfa-actions': {} };
const { MfaPanel } = load(panelFile, panelImports);
const html = status => renderToStaticMarkup(React.createElement(MfaPanel, { status, factors, next: '/admin', returnToWork: false }));
await test('fresh MFA hides the duplicate code form and retains authenticator management', () => {
  const output = html(fresh);
  assert(!output.includes('id="mfa-code"'));
  assert(output.includes('추가 인증된 로그인입니다.'));
  assert(output.includes('다른 인증 앱 추가'));
  assert(output.includes('연결된 인증 앱 관리'));
});
for (const [label, status] of [
  ['unverified session', { ...fresh, mfa_verified: false, recent: false }],
  ['expired recent authentication', { ...fresh, recent: false }],
]) await test(label + ' still displays the code form', () => assert(html(status).includes('id="mfa-code"')));

// Execute handlers from the real component; retain hook state between renders.
function panelHarness(returnToWork, response = { ok: true, message: 'verified' }) {
  let cursor = 0;
  const states = [], tasks = [], calls = [];
  const hooks = { useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = value; }]; },
    useTransition: () => [false, run => tasks.push(run())] };
  const actions = { verifyMfa: async (id, code) => { calls.push(['verify', id, code]); return response; },
    enrollMfa: async () => ({ enrollment: { id: factorId, qr: 'data:image/svg+xml,test', secret: 'SYNTHETIC' }, message: 'enroll' }),
    removeMfa: async () => ({ ok: true, message: 'removed' }) };
  const { MfaPanel: Panel } = load(panelFile, { ...panelImports, react: hooks, '@/app/auth/mfa-actions': actions });
  return { render: (status = { ...fresh, mfa_verified: false, recent: false }) => { cursor = 0; return Panel({ status, factors, next: '/admin', returnToWork }); },
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
  elements(h.render()).find(e => e.props?.id === 'mfa-code').props.onChange({ target: { value: '123456' } });
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
await test('removing an authenticator never invokes the verification return path', async () => {
  routeCalls.length = 0;
  const h = panelHarness(true);
  elements(h.render(fresh)).find(e => e.type === 'button' && e.props.children === '이 인증 앱 연결 해제').props.onClick();
  await h.flush();
  assert.deepEqual(routeCalls, ['refresh']);
});

const redirect = path => { const error = Error('REDIRECT'); error.destination = path; throw error; };
const { safeReturnTo } = load('src/lib/auth/session.ts', { 'next/navigation': { redirect },
  '@/lib/supabase/server': {}, '@/lib/auth/mfa': {}, '@/lib/deployment/review-mode': {} });
function pageHarness(status = fresh) {
  let reads = 0;
  const page = load('src/app/auth/security/page.tsx', { 'next/link': { default: 'a' }, 'next/navigation': { redirect },
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
console.log(`${checks} MFA navigation regressions passed; no network, real accounts, or mail.`);
