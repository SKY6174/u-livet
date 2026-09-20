import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let passed = 0;
const check = (label, value) => { assert.ok(value, label); passed++; console.log('PASS ' + label); };
async function run({ google = true, photo = true, fail, exchangeError = false, params = '?code=synthetic' } = {}) {
  const calls = [];
  const user = { id: 'synthetic', identities: [{ provider: google ? 'google' : 'kakao' }], user_metadata: { name: 'Synthetic', ...(photo ? { picture: 'https://example.invalid/photo', avatar_url: 'https://example.invalid/photo' } : {}) } };
  const auth = {
    exchangeCodeForSession: async () => { calls.push('exchange'); return { error: exchangeError ? {} : null, data: { user } }; },
    updateUser: async input => {
      calls.push(['update', input]);
      if (fail === 'throw') throw Error('private provider error');
      if (fail === 'update') return { error: {}, data: {} };
      if (fail !== 'residual') { delete user.user_metadata.picture; delete user.user_metadata.avatar_url; }
      return { data: { user } };
    },
    refreshSession: async () => { calls.push('refresh'); return fail === 'refresh' ? { error: {}, data: {} } : { data: { session: { user } } }; },
    signOut: async options => { calls.push(['signOut', options]); return {}; },
  };
  const modules = {
    'next/server': { NextResponse: { redirect: url => ({ url: url.toString(), headers: new Headers() }) } },
    '@/lib/supabase/server': { createServerSupabaseClient: async () => ({ auth }) },
    '@/lib/auth/recovery': { recoveryOrigin: () => 'https://life.example.invalid' },
    '@/lib/auth/social': { socialDestination: async () => { calls.push('destination'); return '/mypage'; } },
    '@/lib/deployment/review-mode': { isReviewOnly: () => false },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/auth/callback/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, URL, require: name => { if (name in modules) return modules[name]; throw Error(name); } });
  const response = await exports.GET(new Request('https://untrusted.example.invalid/auth/callback' + params));
  return { calls, response, user };
}
const clean = await run();
check('legacy photo keys removed without changing name', clean.user.user_metadata.name === 'Synthetic' && Object.keys(clean.user.user_metadata).length === 1);
check('update cannot change other account fields', JSON.stringify(clean.calls.find(c => c[0] === 'update')?.[1]) === JSON.stringify({ data: { picture: null, avatar_url: null } }));
check('token refreshed before role destination', clean.calls.indexOf('refresh') < clean.calls.indexOf('destination'));
check('successful callback keeps trusted origin', clean.response.url === 'https://life.example.invalid/mypage');
check('callback prevents caching and referrer leakage', clean.response.headers.get('Cache-Control') === 'private, no-store' && clean.response.headers.get('Referrer-Policy') === 'no-referrer');
for (const options of [{ photo: false }, { google: false }]) {
  const result = await run(options);
  check('unneeded account updates are skipped', !result.calls.some(c => c[0] === 'update') && result.calls.includes('destination'));
}
for (const fail of ['update', 'throw', 'residual', 'refresh']) {
  const result = await run({ fail });
  check(fail + ' failure signs out only current session', result.calls.some(c => c[0] === 'signOut' && c[1].scope === 'local') && !result.calls.includes('destination') && result.response.url.endsWith('social_error=callback'));
}
for (const options of [{ exchangeError: true }, { params: '?error=access_denied' }]) {
  const result = await run(options);
  check('failed or cancelled OAuth never changes user metadata', !result.calls.some(c => c[0] === 'update') && !result.calls.includes('destination'));
}
console.log(`${passed} Google metadata cleanup checks passed; no network or accounts.`);
