import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compile = file => ts.transpileModule(readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const policy = {};
new Function('exports', compile('src/lib/auth/password-policy.ts'))(policy);
const password = 'SyntheticAccount2026!';
const token = 'a'.repeat(64);
const form = (fields = {}) => {
  const value = new FormData();
  for (const [k, v] of Object.entries({ token_hash: token, password, ...fields })) value.set(k, v);
  return value;
};
function setup(options = {}) {
  const calls = [];
  const client = {
    rpc: async name => {
      calls.push(['rpc', name]);
      if (options.rpcThrows) throw Error('UNAVAILABLE');
      return { data: { active: options.active ?? true } };
    },
    auth: {
      verifyOtp: async args => {
        calls.push(['verify', args.type]);
        return options.invalid ? { error: { code: 'otp_expired' } } : {
          data: { user: { id: 'test', invited_at: options.notInvited ? null : '2026-09-19' }, session: {} },
        };
      },
      mfa: {
        listFactors: async () => ({ data: { totp: options.mfa ? [{ id: 'test-factor', status: 'verified' }] : [] } }),
        challengeAndVerify: async args => { calls.push(['mfa', args.code]); return options.mfaFailure ? { error: { status: 400 } } : {}; },
      },
      updateUser: async args => {
        assert.equal(args.password, password);
        calls.push(['update']);
        return options.updateFailure ? { error: { code: 'weak_password' } } : {};
      },
      signOut: async args => { calls.push(['logout', args.scope]); return {}; },
    },
  };
  const imports = {
    'next/navigation': { redirect: path => { const error = Error('REDIRECT'); error.destination = path; throw error; } },
    'next/cache': { revalidatePath: () => calls.push(['revalidate']) },
    '@/lib/auth/recovery': { createRecoveryClient: () => client },
    '@/lib/supabase/server': { createServerSupabaseClient: async () => ({ auth: { signOut: async () => { calls.push(['clear-cookie']); return {}; } } }) },
    '@/lib/auth/password-policy': policy,
    '@/lib/auth/abuse': {
      guardAuthRequest: async action => { calls.push(['guard', action]); return options.limited ? { allowed: false, state: { message: 'LIMITED' } } : { allowed: true }; },
    },
    '@/lib/auth/email-config': { authEmailEnabled: () => true },
  };
  const actions = {};
  new Function('exports', 'require', compile('src/app/auth/recovery-actions.ts'))(actions, name => {
    assert.ok(imports[name], `Unexpected dependency ${name}`);
    return imports[name];
  });
  return { actions, calls };
}
let count = 0;
const test = async (name, run) => { await run(); count++; console.log(`PASS ${name}`); };
for (const [action, type, destination] of [
  ['acceptInvitation', 'invite', '/auth/invitation-accepted'],
  ['resetPassword', 'recovery', '/auth/password-updated'],
]) {
  await test(`${type}: malformed token rejected before verification`, async () => {
    const { actions, calls } = setup();
    assert.ok((await actions[action]({}, form({ token_hash: 'wrong' }))).message);
    assert.equal(calls.length, 0);
  });
  await test(`${type}: weak password does not consume token`, async () => {
    const { actions, calls } = setup();
    assert.ok((await actions[action]({}, form({ password: 'weak' }))).message);
    assert.equal(calls.length, 0);
  });
  await test(`${type}: request limit stops token verification`, async () => {
    const { actions, calls } = setup({ limited: true });
    assert.equal((await actions[action]({}, form())).message, 'LIMITED');
    assert.deepEqual(calls, [['guard', 'reset']]);
  });
  await test(`${type}: fixed native type, global logout and fixed redirect`, async () => {
    const { actions, calls } = setup();
    await assert.rejects(actions[action]({}, form({ type: type === 'invite' ? 'recovery' : 'invite', next: 'https://example.invalid' })), error => error.destination === destination);
    assert.ok(calls.some(c => c[0] === 'verify' && c[1] === type));
    assert.ok(calls.some(c => c[0] === 'update'));
    assert.ok(calls.some(c => c[0] === 'logout' && c[1] === 'global'));
    assert.ok(calls.some(c => c[0] === 'clear-cookie'));
    assert.deepEqual(calls.filter(c => c[0] === 'rpc'), [['rpc', 'life_auth_status']]);
  });
  for (const [reason, options] of [
    ['invalid/expired proof', { invalid: true }],
    ['inactive account', { active: false }],
    ['existing MFA without code', { mfa: true }],
    ['native password rejection', { updateFailure: true }],
    ['provider exception after proof', { rpcThrows: true }],
  ]) await test(`${type}: ${reason} cannot finish`, async () => {
    const { actions, calls } = setup(options);
    assert.ok((await actions[action]({}, form())).message);
    if (!options.updateFailure) assert.ok(!calls.some(c => c[0] === 'update'));
    assert.ok(!calls.some(c => c[0] === 'clear-cookie'));
    if (!options.invalid) assert.ok(calls.some(c => c[0] === 'logout' && c[1] === 'local'));
  });
}
await test('invite: non-invited proof cannot change password', async () => {
  const { actions, calls } = setup({ notInvited: true });
  assert.ok((await actions.acceptInvitation({}, form())).message.includes('초대 링크'));
  assert.ok(!calls.some(c => c[0] === 'update'));
  assert.ok(calls.some(c => c[0] === 'logout' && c[1] === 'local'));
});
await test('recovery: valid existing MFA is still required and accepted', async () => {
  const { actions, calls } = setup({ mfa: true, notInvited: true });
  await assert.rejects(actions.resetPassword({}, form({ mfa_code: '123456' })), error => error.destination === '/auth/password-updated');
  assert.ok(calls.some(c => c[0] === 'mfa'));
});
await test('recovery: incorrect MFA cannot change password', async () => {
  const { actions, calls } = setup({ mfa: true, mfaFailure: true });
  assert.ok((await actions.resetPassword({}, form({ mfa_code: '123456' }))).message);
  assert.ok(!calls.some(c => c[0] === 'update'));
});
console.log(`${count} initial-account and recovery action checks passed; no network or mail.`);
