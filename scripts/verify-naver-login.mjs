import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

let passed = 0;
const check = (label, value) => { assert.ok(value, label); passed++; console.log('PASS ' + label); };
function load(path, globals = {}, modules = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports, URL, Response, AbortSignal, ...globals, require: name => {
    if (name in modules) return modules[name];
    throw new Error('Unexpected dependency ' + name);
  } });
  return exports;
}
const calls = [];
let upstream;
const route = load('src/app/api/auth/naver/userinfo/route.ts', { fetch: async (...args) => {
  calls.push(args);
  if (upstream instanceof Error) throw upstream;
  return upstream;
} }).GET;
const request = authorization => new Request('https://uc-life.example.invalid/api/auth/naver/userinfo?url=https://evil.invalid', {
  headers: authorization === undefined ? {} : { authorization },
});
for (const token of [undefined, '', 'Basic abc', 'Bearer a b', 'Bearer ' + 'x'.repeat(4096)]) {
  const result = await route(request(token));
  check('invalid or missing bearer rejected without network access', result.status === 401 && calls.length === 0);
}
upstream = Response.json({ resultcode: '00', response: {
  id: 'opaque-member-id', email: 'member@example.invalid', email_verified: true,
  name: 'Do not retain', nickname: 'Do not retain', profile_image: 'https://photo.invalid',
  birthday: '01-01', mobile: '010-0000-0000', access_token: 'do-not-return',
} });
const success = await route(request('Bearer synthetic-token'));
check('authenticated nested NAVER profile becomes minimal claims', JSON.stringify(await success.json()) === JSON.stringify({
  sub: 'opaque-member-id', email: 'member@example.invalid', email_verified: false,
}));
check('successful claims are not cached or sent as a referrer', success.headers.get('cache-control') === 'private, no-store'
  && success.headers.get('referrer-policy') === 'no-referrer');
const [url, options] = calls[0];
check('upstream is fixed, never user controlled', url === 'https://openapi.naver.com/v1/nid/me');
check('only bearer and accept headers are forwarded', JSON.stringify(options.headers) === JSON.stringify({ Authorization: 'Bearer synthetic-token', Accept: 'application/json' }));
check('upstream disables cache and redirects and has a timeout', options.cache === 'no-store' && options.redirect === 'error' && options.signal instanceof AbortSignal);
for (const [body, status] of [
  [null, 502], [[], 502], [{ resultcode: '024', response: {} }, 502],
  [{ resultcode: '00', response: { id: 123, email: 'a@b.test' } }, 502],
  [{ resultcode: '00', response: { id: 'bad id', email: 'a@b.test' } }, 502],
  [{ resultcode: '00', response: { id: 'id' } }, 422],
  [{ resultcode: '00', response: { id: 'id', email: 'bad email' } }, 422],
]) {
  upstream = Response.json(body);
  const result = await route(request('Bearer synthetic-token'));
  check('malformed profile or missing email fails closed', result.status === status);
  check('failure is not cached', result.headers.get('cache-control') === 'private, no-store');
}
for (const status of [401, 403, 429, 500]) {
  upstream = new Response('secret upstream detail', { status });
  const result = await route(request('Bearer synthetic-token'));
  check('upstream errors are sanitized', result.status === ([401, 403].includes(status) ? 401 : 502)
    && !(await result.text()).includes('secret'));
}
for (const failure of [new Error('secret network detail'), new Response('not json')]) {
  upstream = failure;
  const result = await route(request('Bearer synthetic-token'));
  check('network or parsing failure remains generic', result.status === 502 && (await result.json()).error === 'provider_unavailable');
}

const registration = load('src/lib/auth/registration.ts');
let exchanges = 0;
const callback = load('src/app/auth/callback/route.ts', {}, {
  'next/server': { NextResponse: { redirect: url => ({ url, headers: new Map() }) } },
  '@/lib/supabase/server': { createServerSupabaseClient: async () => { exchanges++; throw new Error('not expected'); } },
  '@/lib/auth/recovery': { recoveryOrigin: () => 'https://uc-life.example.invalid' },
  '@/lib/auth/social': {}, '@/lib/auth/registration': registration,
  '@/lib/deployment/review-mode': { isReviewOnly: () => false },
}).GET;
const qr = '/learning/10000000-0000-4000-8000-000000000001/attendance/checkin?session=10000000-0000-4000-8000-000000000002&t=' + 'a'.repeat(64);
const response = await callback(new Request('https://uc-life.example.invalid/auth/callback?error=access_denied&error_code=provider_email_needs_verification&error_description=secret&next=' + encodeURIComponent(qr)));
check('verification is not misreported as cancellation and retains QR context', response.url.searchParams.get('social_error') === 'email-verification' && response.url.searchParams.get('next') === qr && exchanges === 0);
check('raw provider message is never reflected', !response.url.toString().includes('secret'));
check('verification guidance explains the next step', registration.socialLoginError('email-verification').includes('회원가입 화면') && !registration.socialLoginError('email-verification').includes('보낸 인증 메일'));
console.log(`${passed} NAVER checks passed. Mocked provider responses; no accounts or email created.`);
