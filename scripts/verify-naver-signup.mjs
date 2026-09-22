import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

let passed = 0;
const check = (name, condition) => { assert.ok(condition, name); passed++; console.log('PASS ' + name); };
function load(path, modules = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(source, { exports, URL, require: name => {
    if (name in modules) return modules[name];
    throw Error('Unexpected import ' + name);
  } });
  return exports;
}
const gate = load('src/lib/auth/naver-signup.ts');
const registration = load('src/lib/auth/registration.ts');
const target = 'new-member@example.invalid';
const user = { id: 'naver-user', identities: [{ provider: 'custom:naver' }], new_email: target, email_change_sent_at: '2026-09-22T01:00:00Z' };
check('NAVER without Auth email must verify it', gate.naverSignupNeedsEmail(user));
check('client-editable metadata cannot bypass verification', gate.naverSignupNeedsEmail({ ...user, user_metadata: { email: target, email_verified: true } }));
check('confirmed Auth email passes', !gate.naverSignupNeedsEmail({ ...user, email: target, email_confirmed_at: '2026-09-22' }));
check('other provider flow is preserved', !gate.naverSignupNeedsEmail({ identities: [{ provider: 'google' }] }));

function fixture(overrides = {}) {
  const calls = [];
  const u = overrides.user ?? user;
  const client = { auth: {
    getUser: async () => ({ data: { user: overrides.signedOut ? null : u } }),
    updateUser: async (input, options) => { calls.push(['update', input, options]); return { data: { user: overrides.notSent ? {} : { ...u, new_email: input.email } }, error: overrides.sendError ? {} : null }; },
    refreshSession: async () => { calls.push(['refreshOAuth']); return { data: { session: {} } }; },
  }, rpc: async () => ({ data: { state: overrides.state ?? 'PENDING' } }) };
  const verifier = { auth: {
    verifyOtp: async input => { calls.push(['verifyOtp', input]); return { data: { user: { id: overrides.wrongUser ? 'another-user' : u.id, email: target, email_confirmed_at: '2026-09-22' } }, error: overrides.badCode ? {} : null }; },
    signOut: async options => { calls.push(['closeOtpSession', options]); },
  } };
  const actions = load('src/app/auth/naver-signup-actions.ts', {
    'next/navigation': { redirect: url => { throw Error('REDIRECT ' + url); } },
    'next/cache': { revalidatePath: () => calls.push(['revalidate']) },
    '@/lib/supabase/server': { createServerSupabaseClient: async () => client },
    '@/lib/auth/recovery': { createRecoveryClient: () => verifier, recoveryOrigin: () => 'https://uc-life.example.invalid' },
    '@/lib/auth/abuse': { guardAuthRequest: async () => overrides.limited ? { allowed: false, state: { message: 'limited' } } : { allowed: true } },
    '@/lib/auth/registration': registration, '@/lib/auth/naver-signup': gate,
    '@/lib/deployment/review-mode': { isReviewOnly: () => !!overrides.review, REVIEW_MESSAGE: 'review' },
  });
  return { actions, calls };
}
const qr = '/learning/10000000-0000-4000-8000-000000000001/attendance/checkin?session=10000000-0000-4000-8000-000000000002&t=' + 'a'.repeat(64);
function form(values = {}) { const f = new FormData(); for (const [key, value] of Object.entries({ email: target, token: '12345678', next: qr, ...values })) f.set(key, value); return f; }
for (const options of [{ signedOut: true }, { state: 'COMPLETE' }, { limited: true }, { review: true }, { user: { ...user, email: target, email_confirmed_at: '2026-09-22' } }]) {
  const f = fixture(options); await f.actions.requestNaverSignupEmail({}, form());
  check('email request requires authorized pending unconfirmed session', !f.calls.some(c => c[0] === 'update'));
}
for (const options of [{ sendError: true }, { notSent: true }]) {
  const f = fixture(options); const result = await f.actions.requestNaverSignupEmail({}, form());
  check('never claim email sent on failure or incomplete provider response', !result.ok && !result.message.includes('보냈습니다'));
}
{
  const f = fixture(); const result = await f.actions.requestNaverSignupEmail({}, form());
  check('successful email request renders pending input with retry delay', result.ok && result.retryAfter === 60 && f.calls.some(c => c[0] === 'revalidate'));
  check('QR next survives email request', new URL(f.calls.find(c => c[0] === 'update')[2].emailRedirectTo).searchParams.get('next') === qr);
}
for (const options of [{ badCode: true }, { wrongUser: true }]) {
  const f = fixture(options); const result = await f.actions.verifyNaverSignupEmail({}, form());
  check('incorrect or other-user code cannot complete signup', !result.ok && !f.calls.some(c => c[0] === 'refreshOAuth'));
  check('temporary OTP session is always closed', f.calls.some(c => c[0] === 'closeOtpSession'));
}
{
  const f = fixture(); await f.actions.verifyNaverSignupEmail({}, form({ email: 'other@example.invalid' }));
  check('submitted address must match Auth pending address', !f.calls.some(c => c[0] === 'verifyOtp'));
}
{
  const f = fixture(); await assert.rejects(f.actions.verifyNaverSignupEmail({}, form()), e => e.message === 'REDIRECT /auth/complete-signup?next=' + encodeURIComponent(qr));
  check('valid verification retains OAuth session and QR destination', f.calls.findIndex(c => c[0] === 'closeOtpSession') < f.calls.findIndex(c => c[0] === 'refreshOAuth'));
}
const components = {
  'react/jsx-runtime': jsxRuntime,
  'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
  '@/components/portal/action-form': { ActionForm: ({ children, label }) => React.createElement('form', {}, children, React.createElement('button', {}, label)) },
  '@/app/auth/naver-signup-actions': {},
};
const Email = load('src/components/auth/naver-signup-email.tsx', components).NaverSignupEmail;
const empty = renderToStaticMarkup(Email({ next: qr }));
const pending = renderToStaticMarkup(Email({ next: qr, pendingEmail: target }));
check('first signup asks for user-chosen email, never hardcoded personal ID', empty.includes('name="email"') && !empty.includes('name="token"') && !empty.includes('skygates'));
check('sent email exposes accessible OTP entry', pending.includes(target) && pending.includes('name="token"') && pending.includes('one-time-code'));
async function signupPage(member, state = 'PENDING') {
  const Page = load('src/app/auth/complete-signup/page.tsx', {
    ...components, '@/components/auth/naver-signup-email': { NaverSignupEmail: Email },
    'next/navigation': { redirect: url => { throw Error('REDIRECT ' + url); } },
    '@/lib/supabase/server': { createServerSupabaseClient: async () => ({ auth: { getUser: async () => ({ data: { user: member } }) }, rpc: async () => ({ data: { state } }) }) },
    '@/lib/auth/social': { getSignupPolicy: async () => ({ id: 'policy-fixture', title: '개인정보 안내', body: '합성 화면 검증용 문안' }), socialDestination: async next => next },
    '@/lib/auth/registration': registration, '@/lib/auth/naver-signup': gate,
    '@/app/auth/social-actions': {}, '@/components/auth/phone-field': { PhoneField: () => React.createElement('input', { name: 'phone' }) },
  }).default;
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ next: qr }) }));
}
const firstPage = await signupPage(user);
const verifiedPage = await signupPage({ ...user, email: target, email_confirmed_at: '2026-09-22' });
check('real signup page gates name and consent behind email verification', firstPage.includes('name="email"') && !firstPage.includes('name="privacy_accepted"'));
check('verified user reaches existing explicit signup form', verifiedPage.includes('name="name"') && verifiedPage.includes('name="privacy_accepted"') && !verifiedPage.includes('checked=""'));
await assert.rejects(signupPage({ ...user, email: target, email_confirmed_at: '2026-09-22' }, 'COMPLETE'), e => e.message === 'REDIRECT ' + qr);
check('returning member bypasses signup and retains original destination', true);
for (const audience of ['learner', 'external']) {
  check('callback retry preserves selected audience', new URL(registration.socialLoginRetry(qr, 'callback', audience), 'https://local.invalid').searchParams.get('audience') === audience);
}
check('untrusted role is not carried into retry', !registration.socialLoginRetry(qr, 'callback', 'SYSTEM_ADMIN').includes('audience'));
console.log(`${passed} NAVER signup checks passed; mocked Auth and mail, no real consent created.`);

if (process.argv.includes('--preview')) {
  const { createServer } = await import('node:http');
  const css = fs.readdirSync('.next/static/css').filter(n => n.endsWith('.css')).map(n => fs.readFileSync('.next/static/css/' + n, 'utf8')).join('\n');
  createServer(async (req, res) => {
    const member = req.url?.includes('verified') ? { ...user, email: target, email_confirmed_at: '2026-09-22' } : user;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>네이버 가입 화면 검증</title><style>' + css + '</style></head><body>' + await signupPage(member) + '</body></html>');
  }).listen(3113, '127.0.0.1', () => console.log('Fixture ready at http://127.0.0.1:3113'));
}
