import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AuthClient } from '@supabase/auth-js';
import { PostgrestClient } from '@supabase/postgrest-js';
import { createLocalAuthLab } from './lib/local-auth-lab.mjs';
import { totp } from './local-mfa.mjs';

// No target flags, real credentials, env files, existing fixtures or external mail.
assert.equal(process.argv.length, 2, 'This isolated test accepts no target arguments');
let lab;
let current = 'isolated stack startup';
let passed = 0;
const successful = [];
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const ok = response => { assert.equal(response.error, null); return response.data; };
async function test(label, fn) {
  current = label;
  await fn();
  passed++;
  successful.push(label);
  console.log(`PASS ${label}`);
}
try {
  console.log('Starting disposable local Auth/DB/REST/mail containers; existing services are preserved.');
  lab = await createLocalAuthLab();
  const auth = headers => new AuthClient({ url: lab.authUrl, headers, persistSession: false, autoRefreshToken: false,
    detectSessionInUrl: false, fetch: lab.fetchLocal });
  const admin = auth({ Authorization: `Bearer ${lab.adminKey}` });
  const token = async c => (ok(await c.getSession())).session.access_token;
  const rpc = (jwt, fn, args = {}) => new PostgrestClient(lab.restUrl, {
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {}, fetch: lab.fetchLocal,
  }).rpc(fn, args);
  const privacy = randomUUID(); const approver = randomUUID();
  const meta = { name: '후보 Auth 가상 학습자', privacy_policy_id: privacy, privacy_accepted: true, role: 'SYSTEM_ADMIN' };
  lab.sql(`insert into public.life_people(id,name) values(${quote(approver)},'[테스트] 임시 정책 승인자');
    insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at)
    values(${quote(privacy)},'10000000-0000-4000-8000-000000000001','ACCOUNT_PRIVACY','candidate-test-v1',
    '[테스트] 로컬 가입','격리된 임시 DB의 가상 계정 검증. 실제 기관 동의서가 아닙니다.','APPROVED',${quote(approver)},now());`);
  async function received(email) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const found = await (await lab.fetchLocal(`${lab.mailUrl}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
      if (found.messages?.length) return (await lab.fetchLocal(`${lab.mailUrl}/api/v1/message/${found.messages[0].ID}`)).json();
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error('LOCAL_MAIL_NOT_RECEIVED');
  }
  async function signup(password) {
    const c = auth(); const email = `candidate-${randomUUID()}@example.invalid`;
    const signed = ok(await c.signUp({ email, password, options: { data: meta } }));
    assert.equal(signed.session, null);
    const message = await received(email);
    const hash = message.HTML?.replaceAll('&amp;', '&').match(/[?&]token=([a-zA-Z0-9_-]+)/)?.[1];
    assert.ok(hash);
    const verified = ok(await c.verifyOtp({ token_hash: hash, type: 'signup' }));
    assert.ok(verified.session);
    return { c, email, user: verified.user, session: verified.session };
  }
  await test('all 22 migrations run against native Auth 2.196.0', () => {
    assert.equal(lab.report.migrations.length, 22);
    assert.equal(lab.sql("select count(*) from pg_trigger where tgname in ('life_record_credential_change','life_approve_credential_change','life_mfa_factor_change','life_mfa_record_verified') and not tgisinternal"), '4');
    assert.equal(lab.sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and ((n.nspname='public' and c.relname like 'life\_%') or n.nspname='life_private') and not c.relrowsecurity"), '0');
  });
  for (const [label, password] of [['11 characters', 'abcdefghi1!'], ['missing punctuation', 'abcdefghijk1'],
    ['missing letters', '12345678901!'], ['missing digits', 'abcdefghijk!']]) {
    await test(`direct signup rejects ${label}`, async () => {
      const result = await auth().signUp({ email: `weak-${randomUUID()}@example.invalid`, password, options: { data: meta } });
      assert.equal(result.error?.code, 'weak_password');
    });
  }
  for (const [label, password] of [['lowercase with colon', 'abcdefghij1:'], ['uppercase with backslash', 'ABCDEFGHIJ1\\'],
    ['lowercase with dollar', 'abcdefghij1$'], ['lowercase with single quote', "abcdefghij1'"], ['uppercase with double quote', 'ABCDEFGHIJ1"']]) {
    await test(`12 characters allow ${label}`, async () => {
      const a = await signup(password);
      assert.ok(ok(await rpc(await token(a.c), 'life_identity'))?.id);
      assert.equal(lab.sql(`select policy_version from life_private.credential_state where user_id=${quote(a.user.id)}`), '1');
    });
  }
  await test('email confirmation is required before password sign-in', async () => {
    const email = `unconfirmed-${randomUUID()}@example.invalid`; const c = auth();
    ok(await c.signUp({ email, password: 'abcdefghij1!', options: { data: meta } }));
    assert.equal((await c.signInWithPassword({ email, password: 'abcdefghij1!' })).error?.code, 'email_not_confirmed');
    assert.ok((await received(email)).HTML);
  });
  const oldPassword = 'recoveryfirst2026!'; const newPassword = 'recoverysecond2026!';
  const a = await signup(oldPassword);
  const original = ok(await rpc(await token(a.c), 'life_identity'));
  await test('signup metadata cannot grant administrator privileges', () => assert.deepEqual(original.roles, []));
  lab.sql(`delete from life_private.credential_state where user_id=${quote(a.user.id)}`);
  await test('missing credential policy removes business access', async () => {
    assert.equal(ok(await rpc(await token(a.c), 'life_identity')), null);
    assert.equal(ok(await rpc(await token(a.c), 'life_auth_status')).needs_reset, true);
  });
  await test('user metadata cannot forge policy approval', async () => {
    ok(await a.c.updateUser({ data: { password_policy_version: 1, role: 'SYSTEM_ADMIN' } }));
    assert.equal(ok(await rpc(await token(a.c), 'life_identity')), null);
  });
  await test('storage rehash and unrelated admin event do not approve credentials', async () => {
    lab.sql(`update auth.users set encrypted_password=extensions.crypt(${quote(oldPassword)},extensions.gen_salt('bf',10)) where id=${quote(a.user.id)}`);
    ok(await admin.admin.updateUserById(a.user.id, { user_metadata: { name: '가상 이름 수정' } }));
    assert.equal(ok(await rpc(await token(a.c), 'life_auth_status')).needs_reset, true);
  });
  const hash = ok(await admin.admin.generateLink({ type: 'recovery', email: a.email })).properties.hashed_token;
  const recovering = auth();
  await test('native recovery proof works without granting business access', async () => {
    ok(await recovering.verifyOtp({ token_hash: hash, type: 'recovery' }));
    assert.equal(ok(await rpc(await token(recovering), 'life_auth_status')).active, true);
    assert.equal(ok(await rpc(await token(recovering), 'life_identity')), null);
  });
  await test('native password change rejects weak composition', async () => {
    assert.equal((await recovering.updateUser({ password: 'abcdefghijk1' })).error?.code, 'weak_password');
  });
  const recoveryJwt = await token(recovering);
  await test('password audit approves only the changed credential and blocks old JWT access', async () => {
    ok(await recovering.updateUser({ password: newPassword }));
    assert.equal(lab.sql(`select policy_version||':'||(pending_txid is null)::text from life_private.credential_state where user_id=${quote(a.user.id)}`), '1:true');
    assert.equal(ok(await rpc(a.session.access_token, 'life_identity')), null);
    assert.equal(ok(await rpc(recoveryJwt, 'life_identity')), null);
  });
  const fresh = auth();
  await test('global sign-out revokes old refresh token and new password preserves person', async () => {
    ok(await recovering.signOut({ scope: 'global' }));
    assert.ok((await auth().refreshSession({ refresh_token: a.session.refresh_token })).error);
    assert.ok((await auth().signInWithPassword({ email: a.email, password: oldPassword })).error);
    ok(await fresh.signInWithPassword({ email: a.email, password: newPassword }));
    assert.equal(ok(await rpc(await token(fresh), 'life_identity')).id, original.id);
  });
  await test('recovery proof cannot be reused or fabricated', async () => {
    assert.ok((await auth().verifyOtp({ token_hash: hash, type: 'recovery' })).error);
    assert.ok((await auth().verifyOtp({ token_hash: '0'.repeat(64), type: 'recovery' })).error);
  });
  await test('expired recovery proof is refused', async () => {
    const expired = ok(await admin.admin.generateLink({ type: 'recovery', email: a.email })).properties.hashed_token;
    lab.sql(`update auth.users set recovery_sent_at=now()-interval '20 minutes' where id=${quote(a.user.id)}`);
    assert.ok((await auth().verifyOtp({ token_hash: expired, type: 'recovery' })).error);
  });
  await test('signed-out access JWT cannot keep business access', async () => {
    const stale = await token(fresh); ok(await fresh.signOut());
    assert.equal(ok(await rpc(stale, 'life_identity')), null);
  });
  const staff = await signup('staffcandidate2026!');
  const staffIdentity = ok(await rpc(await token(staff.c), 'life_identity'));
  lab.sql(`insert into public.life_role_assignments(person_id,org_id,role) values(${quote(staffIdentity.id)},'10000000-0000-4000-8000-000000000001','COURSE_MANAGER')`);
  await test('staff AAL1 cannot access business identity', async () => {
    assert.equal(ok(await rpc(await token(staff.c), 'life_identity')), null);
    assert.equal(ok(await rpc(await token(staff.c), 'life_security_status')).staff_required, true);
  });
  await test('direct native MFA enrollment without permit is blocked', async () => {
    assert.ok((await staff.c.mfa.enroll({ factorType: 'totp', friendlyName: 'No permit' })).error);
    assert.equal(lab.sql(`select count(*) from auth.mfa_factors where user_id=${quote(staff.user.id)}`), '0');
  });
  let factor;
  await test('permitted enrollment and real TOTP verification restore staff access', async () => {
    const permit = ok(await rpc(await token(staff.c), 'life_prepare_mfa_change', { k: 'ENROLL' }));
    factor = ok(await staff.c.mfa.enroll({ factorType: 'totp', friendlyName: permit, issuer: 'LOCAL CANDIDATE' }));
    ok(await staff.c.mfa.challengeAndVerify({ factorId: factor.id, code: totp(factor.totp.secret) }));
    assert.equal(ok(await rpc(await token(staff.c), 'life_security_status')).recent, true);
    assert.equal(ok(await rpc(await token(staff.c), 'life_identity')).id, staffIdentity.id);
  });
  await test('administrator last verified factor cannot be removed', async () => {
    assert.ok((await rpc(await token(staff.c), 'life_prepare_mfa_change', { k: 'REMOVE', f: factor.id })).error);
    assert.ok((await staff.c.mfa.unenroll({ factorId: factor.id })).error);
    assert.equal(lab.sql(`select count(*) from auth.mfa_factors where user_id=${quote(staff.user.id)} and status='verified'`), '1');
  });
  await test('old MFA proof cannot authorize new factor enrollment', async () => {
    lab.sql(`update auth.mfa_amr_claims set updated_at=now()-interval '20 minutes' where session_id in (select id from auth.sessions where user_id=${quote(staff.user.id)})`);
    assert.equal(ok(await rpc(await token(staff.c), 'life_security_status')).recent, false);
    assert.ok((await rpc(await token(staff.c), 'life_prepare_mfa_change', { k: 'ENROLL' })).error);
    assert.ok((await staff.c.mfa.enroll({ factorType: 'totp', friendlyName: 'Expired approval' })).error);
  });
  await test('anonymous direct business mutation stays blocked', async () => assert.ok((await rpc(null, 'life_apply', { f: null, policy: null })).error));
} catch (error) {
  const code = /^[A-Z][A-Z0-9_]{2,100}$/.test(error.message) ? error.message : 'CHECK_FAILED';
  console.error(`FAIL ${current}: ${code}`);
  process.exitCode = 1;
} finally {
  if (lab) {
    try { await lab.close(); }
    catch { console.error('FAIL owned resource cleanup or existing service preservation'); process.exitCode = 1; }
    console.log(JSON.stringify({ ...lab.report, checksPassed: passed, checks: successful,
      scope: 'Local native Auth and DB integration only; CAPTCHA disabled, local HTTP/Mailpit, no production acceptance.' }));
  }
}
