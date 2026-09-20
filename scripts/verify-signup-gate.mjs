import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, modules = {}, env = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, {
    exports, process: { env },
    require: name => {
      if (name in modules) return modules[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return exports;
}
let passed = 0;
const pass = name => { passed++; console.log('PASS ' + name); };
for (const value of [undefined, '', 'false', 'FALSE', 'TRUE', '1', ' true ', 'true']) {
  const config = load('src/lib/auth/signup-config.ts', { 'server-only': {} }, { AUTH_SIGNUP_ENABLED: value });
  assert.equal(config.publicSignupEnabled(), value === 'true');
  pass(`Explicit setting ${JSON.stringify(value)} is handled safely`);
}
const passwordPolicy = load('src/lib/auth/password-policy.ts');
const registration = load('src/lib/auth/registration.ts');
const POLICY = '00000000-0000-4000-8000-000000000123';
function actions({ enabled = false, mail = true, policy = true } = {}) {
  const calls = [];
  const modules = {
    'next/navigation': { redirect: () => { throw Error('Unexpected redirect'); } },
    'next/cache': { revalidatePath: () => {} },
    '@/lib/supabase/server': { createServerSupabaseClient: async () => {
      calls.push('client');
      return { auth: { signUp: async input => { calls.push(['signup', input]); return { error: null }; } } };
    } },
    '@/lib/auth/session': { safeReturnTo: () => '/mypage' },
    '@/lib/auth/social': { getSignupPolicy: async () => { calls.push('policies'); return policy ? { id: POLICY } : undefined; } },
    '@/lib/auth/registration': registration,
    '@/lib/auth/login-audience': load('src/lib/auth/login-audience.ts'),
    '@/lib/auth/abuse': { guardAuthRequest: async () => { calls.push('guard'); return { allowed: true }; }, authProviderError: () => null },
    '@/lib/auth/email-config': { authEmailEnabled: () => mail, AUTH_EMAIL_PENDING: 'MAIL_PENDING' },
    '@/lib/auth/signup-config': { publicSignupEnabled: () => enabled, PUBLIC_SIGNUP_PENDING: 'SIGNUP_CLOSED' },
    '@/lib/auth/password-policy': passwordPolicy,
  };
  return { actions: load('src/app/auth/actions.ts', modules), calls };
}
function form(accepted = 'on') {
  const f = new FormData();
  for (const [k, v] of Object.entries({ name: 'Synthetic learner', phone: '010-1234-5678', email: 'signup-test@example.invalid', password: 'SyntheticExample123!', privacy_policy_id: POLICY, privacy_accepted: accepted, AUTH_SIGNUP_ENABLED: 'true', role: 'SYSTEM_ADMIN' })) f.set(k, v);
  return f;
}
{
  const { actions: a, calls } = actions();
  assert.equal((await a.register({}, form())).message, 'SIGNUP_CLOSED');
  assert.equal(calls.length, 0); pass('Closed signup rejects forged enable flag before any external call');
}
{
  const { actions: a, calls } = actions({ enabled: true, mail: false });
  assert.equal((await a.register({}, form())).message, 'MAIL_PENDING');
  assert.equal(calls.length, 0); pass('Enabled signup still requires email readiness');
}
for (const options of [{ policy: false, accepted: 'on' }, { policy: true, accepted: '' }]) {
  const { actions: a, calls } = actions({ enabled: true, policy: options.policy });
  assert.ok((await a.register({}, form(options.accepted))).message.includes('동의'));
  assert.ok(!calls.includes('client')); pass('Policy and explicit consent still gate Auth account creation');
}
{
  const { actions: a, calls } = actions({ enabled: true });
  assert.equal((await a.register({}, form())).ok, true);
  const input = calls.find(x => Array.isArray(x) && x[0] === 'signup')[1];
  assert.equal(input.options.data.privacy_policy_id, POLICY);
  assert.equal(input.options.data.privacy_accepted, true);
  assert.equal(input.options.data.role, undefined);
  assert.equal(input.options.data.mobile_phone, '+821012345678');
  assert.equal(input.options.data.phone_confirmed_at, undefined);
  pass('Authorized signup preserves consent and excludes forged roles');
}
console.log(`${passed} public-signup gate checks passed; no network or mail.`);
