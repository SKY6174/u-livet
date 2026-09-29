// Disposable Preview identities. Auth link generation sends no email.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const ref = 'bfqwntulxabfrimcypvx';
assert.equal(process.argv.length, 2, 'No production/alternate target is accepted');
const token = execFileSync('security', ['find-generic-password', '-s', 'Supabase CLI', '-a', 'supabase', '-w'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}).trim();
async function management(path, body) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert(response.ok, `Management request failed: ${response.status}`);
  return response.json();
}
const sql = query => management('database/query', { query, read_only: false });
const keys = await management('api-keys');
const key = name => keys.find(item => item.name === name)?.api_key;
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(`https://${ref}.supabase.co`, key('service_role'), options);
const session = () => createClient(`https://${ref}.supabase.co`, key('anon'), options);
const [{ policy, org, actor }] = await sql(`select p.id policy,p.org_id org,
  (select r.person_id from public.life_role_assignments r where r.org_id=p.org_id and r.role='SYSTEM_ADMIN' limit 1) actor
  from public.life_policy_versions p where p.kind='ACCOUNT_PRIVACY' and p.status='APPROVED'
    and p.effective_from<=now() and (p.effective_until is null or p.effective_until>now())
  order by p.effective_from desc limit 1`);
assert(policy && org && actor, 'Preview privacy policy and actor are required');
const people = [];
const users = [];
let checks = 0;
const pass = label => { checks++; console.log(`PASS ${label}`); };

try {
  for (const [group, kind] of [['office', null], ['instructor', 'EXTERNAL'], ['learner', null]]) {
    const person = randomUUID();
    const email = `codex-auto-${person}@${group === 'office' ? 'uc.ac.kr' : 'example.invalid'}`;
    people.push(person);
    await sql(`begin;
      insert into public.life_people(id,name) values('${person}','[TEST] auto invite');
      insert into life_private.manual_members(person_id,org_id,member_group,email,request_id,request_fingerprint,created_by)
        values('${person}','${org}','${group}','${email}','${randomUUID()}','test','${actor}');
      ${kind ? `insert into life_private.account_classifications(person_id,instructor_kind,updated_by)
        values('${person}','${kind}','${actor}');` : ''}
      commit;`);
    if (group === 'office') {
      const forged = await admin.auth.admin.generateLink({ type: 'invite', email,
        options: { data: { member_org_id: org, manual_member_invitation: true,
          manual_member_invitation_nonce: randomBytes(32).toString('hex') } } });
      assert(forged.error, 'Invitation without a server permit must be rejected');
      pass('forged invite marker cannot reserve a manual member');
    }
    const nonce = randomBytes(32).toString('hex');
    const prepared = await admin.rpc('life_prepare_manual_member_invite', { p_person: person, p_nonce: nonce });
    assert.equal(prepared.error, null, `Invite permit failed for ${group}`);
    const created = await admin.auth.admin.generateLink({ type: 'invite', email,
      options: { data: { member_org_id: org, manual_member_invitation: true,
        manual_member_invitation_nonce: nonce } } });
    assert.equal(created.error, null, `Auth invite generation failed for ${group}`);
    const userId = created.data.user.id;
    users.push(userId);
    const [pending] = await sql(`select c.policy_id is null no_consent,
      not exists(select 1 from public.life_auth_links where auth_user_id='${userId}') no_link
      from life_private.manual_member_claims c where c.user_id='${userId}'`);
    assert.equal(pending.no_consent, true);
    assert.equal(pending.no_link, true);
    pass(`${group}: Auth user created without consent or person link`);

    const recipient = session();
    const [{ token_hash: tokenHash }] = await sql(`select token_hash from auth.one_time_tokens
      where user_id='${userId}' and token_type='confirmation_token' order by created_at desc limit 1`);
    assert(tokenHash, 'Native invitation proof must exist');
    const verified = await recipient.auth.verifyOtp({ token_hash: tokenHash, type: 'invite' });
    assert.equal(verified.error, null, `Invite verification failed for ${group}`);
    assert(verified.data.user?.invited_at && verified.data.session);
    const [confirmed] = await sql(`select u.email_confirmed_at is not null verified,
      not exists(select 1 from public.life_auth_links where auth_user_id='${userId}') no_link
      from auth.users u where u.id='${userId}'`);
    assert.equal(confirmed.verified, true);
    assert.equal(confirmed.no_link, true);
    pass(`${group}: email proof alone grants no membership`);

    const rejected = await recipient.rpc('life_accept_manual_member_invitation', {
      p_policy: randomUUID(), p_accepted: true,
    });
    assert(rejected.error, 'Wrong policy must be rejected');
    const accepted = await recipient.rpc('life_accept_manual_member_invitation', {
      p_policy: policy, p_accepted: true,
    });
    assert.equal(accepted.error, null, `Consent and link failed for ${group}`);
    const [linked] = await sql(`select a.person_id, count(r.*)::int roles,
      count(c.*)::int consents from public.life_auth_links a
      left join public.life_role_assignments r on r.person_id=a.person_id and r.role='INSTRUCTOR'
      left join public.life_consent_events c on c.person_id=a.person_id and c.accepted
      where a.auth_user_id='${userId}' group by a.person_id`);
    assert.equal(linked.person_id, person);
    assert.equal(linked.roles, group === 'instructor' ? 1 : 0);
    assert.equal(linked.consents, 1);
    const status = await recipient.rpc('life_auth_status');
    assert.equal(status.error, null);
    assert.equal(status.data.active, true);
    pass(`${group}: approved consent links existing member with least privilege`);

    const password = `Aa1!${randomBytes(24).toString('hex')}`;
    const updated = await recipient.auth.updateUser({ password });
    assert.equal(updated.error, null, `Password setup failed for ${group}`);
    pass(`${group}: initial password can be set`);
  }

  const [{ policy: firstPolicy, org: firstOrg }] = await sql(`select p.id policy,p.org_id org
    from public.life_policy_versions p where p.id=life_private.member_activation_policy()`);
  assert(firstPolicy && firstOrg, 'First-password policy is required');
  const person = randomUUID();
  const email = `codex-provision-${person}@uc.ac.kr`;
  const nonce = randomBytes(32).toString('hex');
  people.push(person);
  await sql(`begin;
    insert into public.life_people(id,name) values('${person}','[TEST] provisional member');
    insert into life_private.manual_members(person_id,org_id,member_group,email,request_id,request_fingerprint,created_by)
      values('${person}','${firstOrg}','office','${email}','${randomUUID()}','test','${actor}');
    insert into life_private.member_profiles(person_id,mobile_phone,updated_by)
      values('${person}','+821012345678','${actor}');
    insert into life_private.member_auth_permits(person_id,nonce,expires_at)
      values('${person}','${nonce}',now()+interval '5 minutes');
    commit;`);
  const provisioned = await admin.auth.admin.createUser({ email, email_confirm: true,
    password: `Aa1!${randomBytes(24).toString('hex')}`,
    user_metadata: { member_provisioning_nonce: nonce, name: '[TEST] provisional member',
      email, mobile_phone: '+821012345678', member_group: 'office', member_org_id: firstOrg },
  });
  assert.equal(provisioned.error, null, 'Office provisioning failed');
  users.push(provisioned.data.user.id);
  let profile = await admin.rpc('life_manual_member_auth_profile', { p_person: person });
  assert.equal(profile.error, null);
  assert.equal(profile.data.auth_user_id, provisioned.data.user.id);
  assert.equal(profile.data.activation_complete, false);
  assert.equal(provisioned.data.user.user_metadata.mobile_phone, '+821012345678');
  pass('office provisioning copies roster metadata and remains setup-pending');
  const recovery = await admin.auth.admin.generateLink({ type: 'recovery', email });
  assert.equal(recovery.error, null);
  const firstSession = session();
  const proof = await firstSession.auth.verifyOtp({ token_hash: recovery.data.properties.hashed_token, type: 'recovery' });
  assert.equal(proof.error, null);
  const consent = await firstSession.rpc('life_accept_member_privacy', { p_policy: firstPolicy });
  assert.equal(consent.error, null, 'First-password consent failed');
  const finalPassword = await admin.auth.admin.updateUserById(provisioned.data.user.id,
    { password: `Aa1!${randomBytes(24).toString('hex')}` });
  assert.equal(finalPassword.error, null);
  profile = await admin.rpc('life_manual_member_auth_profile', { p_person: person });
  assert.equal(profile.data.activation_complete, true);
  pass('office account becomes active only after consent and final password');
} finally {
  for (const userId of users) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    assert.equal(error, null, 'Synthetic Auth cleanup failed');
  }
  if (people.length) {
    const ids = people.map(id => `'${id}'`).join(',');
    await sql(`begin;
      delete from public.life_audit_events where entity_id in (${ids}) or actor_id in (${ids});
      delete from public.life_role_assignments where person_id in (${ids});
      delete from public.life_consent_events where person_id in (${ids});
      delete from life_private.account_classifications where person_id in (${ids});
      delete from life_private.member_profiles where person_id in (${ids});
      delete from life_private.manual_member_claims where person_id in (${ids});
      delete from life_private.manual_members where person_id in (${ids});
      delete from public.life_auth_links where person_id in (${ids});
      delete from public.life_people where id in (${ids});
      commit;`);
  }
}
console.log(`${checks} Preview invite checks passed; synthetic records removed; no email sent.`);
