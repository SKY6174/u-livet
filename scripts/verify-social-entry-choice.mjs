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
  mfa = false, signOutError = false, signOutThrows = false } = {}) {
  const calls = [];
  const client = {
    auth: {
      getUser: async () => ({ data: { user: signedIn ? { id: 'synthetic-user' } : null } }),
      signOut: async options => {
        calls.push(['signOut', options]);
        if (signOutThrows) throw new Error('Synthetic connection failure');
        return { error: signOutError ? { message: 'Synthetic provider detail' } : null };
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
    './signup-config': { publicSignupEnabled: () => true }, './registration': registration,
  });
  const actions = load('src/app/auth/social-actions.ts', {
    'next/navigation': { redirect }, 'next/cache': { revalidatePath: (...args) => calls.push(['revalidate', ...args]) },
    '@/lib/supabase/server': server, '@/lib/auth/registration': registration, '@/lib/auth/social': social,
    '@/lib/auth/abuse': {}, '@/lib/auth/recovery': {}, '@/lib/supabase/config': {},
    '@/lib/deployment/review-mode': {}, '@/lib/auth/signup-config': {},
    '@/lib/auth/login-audience': {}, '@/lib/auth/social-providers': {},
  });
  const phone = load('src/components/auth/phone-field.tsx', {
    react: React, 'react/jsx-runtime': jsxRuntime, '@/lib/auth/registration': registration,
  });
  const page = load('src/app/auth/complete-signup/page.tsx', {
    'react/jsx-runtime': jsxRuntime, 'next/navigation': { redirect },
    'next/link': { default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) },
    '@/lib/supabase/server': server, '@/lib/auth/social': social, '@/lib/auth/registration': registration,
    '@/app/auth/social-actions': actions, '@/components/auth/phone-field': phone,
    '@/components/portal/action-form': { ActionForm: ({ action, children, label }) => React.createElement('form', {
      method: 'post', action: action === actions.returnToExistingLogin ? '/existing-login' : '/fixture-signup',
    }, children, React.createElement('button', { type: 'submit', className: 'btn-primary' }, label)) },
  }).default;
  return { calls, actions, social, page, render: async params => renderToStaticMarkup(await page({ searchParams: Promise.resolve(params) })) };
}
const safeNext = '/courses/123/apply?view=1';
const choice = await fixture().render({ next: safeNext });
check('pending authentication offers signup and existing login', choice.includes('새 회원가입') && choice.includes('기존 계정으로 로그인'));
check('choice screen does not ask for personal information or consent', !/name="(?:name|phone|privacy_accepted)"/.test(choice));
check('copy distinguishes authentication from completed portal login', choice.includes('간편 인증이 완료되었습니다') && !choice.includes('간편 로그인이 완료되었습니다'));
check('signup requires an explicit step and retains original destination', choice.includes('next=%2Fcourses%2F123%2Fapply%3Fview%3D1&amp;step=signup'));
for (const step of [undefined, '', 'unknown']) {
  const html = await fixture().render({ step });
  check('absent or unknown step stays on choice screen', html.includes('회원가입 또는 로그인') && !html.includes('name="name"'));
}
const signup = await fixture().render({ step: 'signup', next: safeNext });
check('signup step has name phone and unchecked required consent', /name="name"/.test(signup) && /name="phone"/.test(signup) && /name="privacy_accepted"/.test(signup) && signup.includes('required=""') && !signup.includes('checked=""'));
check('signup offers both returning to choice and existing login', signup.includes('선택 화면으로 돌아가기') && signup.includes('기존 계정으로 로그인'));
for (const step of [undefined, 'signup']) {
  const html = await fixture({ hasPolicy: false }).render({ step });
  check('missing policy prevents signup but keeps existing login available', html.includes('회원가입 안내를 준비') && html.includes('기존 계정으로 로그인') && !html.includes('step=signup') && !html.includes('name="privacy_accepted"'));
  await assert.rejects(fixture({ signedIn: false }).render({ step, next: safeNext }), error => error.message === 'REDIRECT /auth/login?next=' + encodeURIComponent(safeNext));
  check('both steps reject unsigned visitors', true);
  await assert.rejects(fixture({ state: 'COMPLETE' }).render({ step, next: safeNext }), error => error.message === 'REDIRECT ' + safeNext);
  check('completed member skips both onboarding steps', true);
}
await assert.rejects(fixture({ state: 'COMPLETE', mfa: true }).render({}), /REDIRECT \/auth\/security\?next=%2F$/);
check('completed member retains the MFA gate', true);
await assert.rejects(fixture({ statusError: true }).render({}), /REDIRECT \/auth\/login\?social_error=unavailable$/);
check('status lookup failure never offers signup', true);
for (const next of [safeNext, 'https://evil.invalid', '//evil.invalid', '/auth/complete-signup', '/%2f%2fevil.invalid']) {
  const f = fixture();
  const form = new FormData(); form.set('next', next);
  const expected = '/auth/login?next=' + encodeURIComponent(registration.socialReturnTo(next));
  await assert.rejects(f.actions.returnToExistingLogin({}, form), error => error.message === 'REDIRECT ' + expected);
  check('existing login safely preserves or rejects destination: ' + next, f.calls[0][0] === 'signOut' && f.calls[0][1].scope === 'local' && f.calls[1][0] === 'revalidate');
  check('existing login performs no registration or account mutation', f.calls.length === 2);
}
for (const options of [{ signOutError: true }, { signOutThrows: true }]) {
  const f = fixture(options);
  const result = await f.actions.returnToExistingLogin({}, new FormData());
  check('signout failure is recoverable and does not redirect or revalidate', result.message && !result.ok && f.calls.length === 1 && !result.message.includes('Synthetic'));
}
console.log(`${passed} social entry checks passed. Mocked sessions; no network or accounts.`);

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
      if (req.method === 'POST' && url.pathname === '/existing-login') {
        let body = ''; for await (const chunk of req) body += chunk;
        const form = new FormData(); for (const [key, value] of new URLSearchParams(body)) form.set(key, value);
        try { await fixture().actions.returnToExistingLogin({}, form); } catch (error) {
          if (!error.message.startsWith('REDIRECT ')) throw error;
          res.writeHead(303, { Location: error.message.slice(9) }); res.end(); return;
        }
      }
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
