import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

let passed = 0;
const check = (label, value) => { assert.ok(value, label); passed++; console.log('PASS ' + label); };
const redirect = url => { throw new Error('REDIRECT ' + url); };
function load(path, modules = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, URL, process: { env: {} }, require: name => {
    if (name in modules) return modules[name];
    throw new Error('Unexpected dependency ' + name);
  } });
  return exports;
}
const registration = load('src/lib/auth/registration.ts');
const policy = { id: 'policy-fixture', title: '검증용 개인정보 안내', body: '화면 검증용 합성 문안입니다. 실제 가입이나 개인정보 저장은 하지 않습니다.' };
function fixture({ state = 'PENDING', signedIn = true, statusError = false, hasPolicy = true,
  mfa = false, enabled = true, exchangeError = false, provider = 'kakao' } = {}) {
  const calls = [];
  const client = {
    auth: {
      exchangeCodeForSession: async () => ({ data: { user: { id: 'synthetic-user', identities: [{ provider }], user_metadata: {} } }, error: exchangeError ? {} : null }),
      getUser: async () => ({ data: { user: signedIn ? { id: 'synthetic-user' } : null } }),
      signOut: async options => {
        calls.push(['signOut', options]);
        return { error: null };
      },
    },
    rpc: async name => {
      calls.push([name]);
      if (name === 'life_registration_status') return { data: { state }, error: statusError ? {} : null };
      if (name === 'life_signup_policy') return { data: policy.id };
      if (name === 'life_security_status') return { data: { active: true, needs_reset: false, mfa_required: mfa, mfa_verified: false } };
      if (name === 'life_login_context') return { data: { audience: 'learner' } };
      if (name === 'life_identity') return { data: { id: 'synthetic-person' } };
      throw new Error('Unexpected RPC ' + name);
    },
  };
  const server = { createServerSupabaseClient: async () => client };
  const social = load('src/lib/auth/social.ts', {
    'server-only': {}, '@/lib/supabase/server': server,
    '@/lib/portal/data': { getPolicies: async () => hasPolicy ? [policy] : [] },
    './signup-config': { publicSignupEnabled: () => enabled }, './registration': registration,
  });
  const actions = load('src/app/auth/social-actions.ts', {
    'next/navigation': { redirect }, 'next/cache': { revalidatePath: (...args) => calls.push(['revalidate', ...args]) },
    '@/lib/supabase/server': server, '@/lib/auth/naver-signup':load('src/lib/auth/naver-signup.ts'), '@/lib/auth/registration': registration, '@/lib/auth/social': social,
    '@/lib/auth/abuse': {}, '@/lib/auth/recovery': {}, '@/lib/supabase/config': {},
    '@/lib/deployment/review-mode': {}, '@/lib/auth/signup-config': {},
    '@/lib/auth/login-audience': {}, '@/lib/auth/social-providers': {},
  });
  const phone = load('src/components/auth/phone-field.tsx', {
    react: React, 'react/jsx-runtime': jsxRuntime, '@/lib/auth/naver-signup':load('src/lib/auth/naver-signup.ts'), '@/lib/auth/registration': registration,
  });
  const page = load('src/app/auth/complete-signup/page.tsx', {
    'react/jsx-runtime': jsxRuntime, 'next/navigation': { redirect },
    'next/link': { default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) },
    '@/lib/supabase/server': server, '@/lib/auth/social': social, '@/lib/auth/naver-signup':load('src/lib/auth/naver-signup.ts'), '@/lib/auth/registration': registration,
    '@/app/auth/social-actions': actions, '@/components/auth/phone-field': phone, '@/components/auth/naver-signup-email': { NaverSignupEmail: () => null },
    '@/components/portal/action-form': { ActionForm: ({ action, children, label }) => React.createElement('form', {
      method: 'post', action: '/fixture-signup',
    }, children, React.createElement('button', { type: 'submit', className: 'btn-primary' }, label)) },
  }).default;
  const callback = load('src/app/auth/callback/route.ts', {
    'next/server': { NextResponse: { redirect: url => ({ url: url.toString(), headers: new Map() }) } },
    '@/lib/supabase/server': server, '@/lib/auth/social': social,
    '@/lib/auth/naver-signup':load('src/lib/auth/naver-signup.ts'), '@/lib/auth/registration': registration,
    '@/lib/auth/recovery': { recoveryOrigin: () => 'https://uc-life.example.invalid' },
    '@/lib/deployment/review-mode': { isReviewOnly: () => false },
  }).GET;
  return { calls, social, callback, render: async params => renderToStaticMarkup(await page({ searchParams: Promise.resolve(params) })) };
}
const safeNext = '/courses/123/apply?view=1';
for (const step of [undefined, '', 'signup', 'unknown']) {
  const f = fixture();
  const html = await f.render({ next: safeNext, step });
  check('pending member directly sees the signup form regardless of legacy step', html.includes('새 회원가입') && /name="name"/.test(html) && /name="phone"/.test(html));
  check('signup requires explicit consent, never a choice or login redirect button', /name="privacy_accepted"/.test(html) && html.includes('required=""') && !html.includes('checked=""') && !html.includes('기존 계정으로 로그인') && !html.includes('선택 화면') && !html.includes('회원가입 또는 로그인'));
  check('rendering a signup form does not create an account or end its session', !f.calls.some(([name]) => ['signOut', 'life_complete_registration'].includes(name)));
}
const signup = await fixture().render({ next: safeNext });
check('copy distinguishes provider authentication from portal signup', signup.includes('간편 인증이 완료되었습니다') && !signup.includes('간편 로그인이 완료되었습니다'));
check('original destination survives in the signup form', signup.includes('value="/courses/123/apply?view=1"'));
for (const next of ['https://evil.invalid', '//evil.invalid', '/auth/complete-signup', '/%2f%2fevil.invalid']) {
  const html = await fixture().render({ next });
  check('unsafe destination falls back to home', html.includes('name="next" value="/"'));
}
check('missing policy prevents signup', !(await fixture({ hasPolicy: false }).render({})).includes('name="privacy_accepted"'));
for (const step of [undefined, 'signup']) {
  await assert.rejects(fixture({ signedIn: false }).render({ step, next: safeNext }), error => error.message === 'REDIRECT /auth/login?next=' + encodeURIComponent(safeNext));
  check('unsigned visitors go to login', true);
  await assert.rejects(fixture({ state: 'COMPLETE' }).render({ step, next: safeNext }), error => error.message === 'REDIRECT ' + safeNext);
  check('existing member never sees signup, including an old bookmark', true);
}
await assert.rejects(fixture({ state: 'COMPLETE', mfa: true }).render({}), /REDIRECT \/auth\/security\?next=%2F$/);
check('existing member retains MFA', true);
await assert.rejects(fixture({ statusError: true }).render({}), /REDIRECT \/auth\/login\?social_error=unavailable$/);
check('registration lookup failure never renders signup', true);
for (const provider of ['kakao', 'google', 'custom:naver']) {
for (const [options, expected] of [
  [{}, '/auth/complete-signup?next=' + encodeURIComponent(safeNext)],
  [{ state: 'COMPLETE' }, safeNext],
  [{ state: 'COMPLETE', mfa: true }, '/auth/security?next=' + encodeURIComponent(safeNext)],
  [{ state: 'EMAIL_LOGIN_REQUIRED' }, '/auth/login?social_error=staff'],
  [{ state: 'CLOSED' }, '/auth/login?social_error=closed'],
  [{ enabled: false }, '/auth/login?social_error=closed'],
  [{ state: 'UNAVAILABLE' }, '/auth/login?social_error=unavailable'],
  [{ statusError: true }, '/auth/login?social_error=unavailable'],
  [{ exchangeError: true }, '/auth/login?social_error=callback'],
]) {
  const f = fixture({ ...options, provider });
  const response = await f.callback(new Request('https://uc-life.example.invalid/auth/callback?code=synthetic&next=' + encodeURIComponent(safeNext)));
  check(provider + ' callback automatically selects the correct destination: ' + JSON.stringify(options), response.url === 'https://uc-life.example.invalid' + expected);
  check('callback is never cached and does not leak a referrer', response.headers.get('Cache-Control') === 'private, no-store' && response.headers.get('Referrer-Policy') === 'no-referrer');
}
}
console.log(`${passed} social auto-routing checks passed. Mocked sessions; no network or accounts.`);

const qrNext = '/learning/10000000-0000-4000-8000-000000000001/attendance/checkin?session=10000000-0000-4000-8000-000000000002&t=' + 'b'.repeat(64);
for (const [options, query, expected] of [
  [{ state: 'COMPLETE' }, 'code=synthetic', qrNext],
  [{ state: 'COMPLETE', mfa: true }, 'code=synthetic', '/auth/security?next=' + encodeURIComponent(qrNext)],
  [{}, 'code=synthetic', '/auth/complete-signup?next=' + encodeURIComponent(qrNext)],
  [{}, 'error=access_denied', registration.socialLoginRetry(qrNext, 'cancelled')],
  [{ exchangeError: true }, 'code=synthetic', registration.socialLoginRetry(qrNext, 'callback')],
  [{ state: 'UNAVAILABLE' }, 'code=synthetic', registration.socialLoginRetry(qrNext, 'unavailable')],
  [{}, '', registration.socialLoginRetry(qrNext, 'callback')],
]) {
  const result = await fixture(options).callback(new Request('https://uc-life.example.invalid/auth/callback?' + query + '&next=' + encodeURIComponent(qrNext)));
  check('QR return survives authentication, signup, MFA and retries: ' + query, result.url === 'https://uc-life.example.invalid' + expected);
}
for (const next of ['https://evil.invalid', '//evil.invalid', qrNext + '&t=' + 'c'.repeat(64)]) {
  const result = await fixture().callback(new Request('https://uc-life.example.invalid/auth/callback?error=access_denied&next=' + encodeURIComponent(next)));
  check('retry rejects unsafe or ambiguous QR context', result.url === 'https://uc-life.example.invalid/auth/login?social_error=cancelled');
}

// Optional localhost-only visual fixture using the actual server component and built CSS.
if (process.argv.includes('--preview')) {
  const { createServer } = await import('node:http');
  const cssFiles = fs.readdirSync('.next/static/css').filter(name => name.endsWith('.css'));
  const css = cssFiles.map(name => fs.readFileSync('.next/static/css/' + name, 'utf8')).join('\n');
  const preview = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      res.setHeader('Cache-Control', 'no-store');
      if (url.pathname === '/fixture.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); return; }
      if (url.pathname === '/fixture-signup') { res.writeHead(409); res.end('Visual fixture: registration is disabled.'); return; }
      const html = url.pathname === '/auth/login'
        ? '<div class="mx-auto max-w-lg px-5 py-16"><h1 class="page-title">로그인</h1><p>검증용 로그인 도착 화면입니다. 실제 계정으로 로그인하지 않습니다.</p></div>'
        : await fixture().render(Object.fromEntries(url.searchParams));
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>U-LIFE 간편 인증 화면 검증</title><link rel="stylesheet" href="/fixture.css"></head><body><main>' + html + '</main></body></html>');
    } catch { res.writeHead(500); res.end('Fixture failed'); }
  });
  preview.listen(0, '127.0.0.1', () => console.log('Visual fixture: http://127.0.0.1:' + preview.address().port + '/auth/complete-signup?next=%2Fcourses'));
}
