// Disposable Preview identities only. Native links stay in memory; no mail is sent.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const ref = 'bfqwntulxabfrimcypvx';
assert.equal(process.argv.length, 2, 'No production/alternate target is accepted');
const token = execFileSync('security', ['find-generic-password', '-s', 'Supabase CLI', '-a', 'supabase', '-w'], {encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
async function management(path, body) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/${path}`, {
    method:body ? 'POST':'GET', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    ...(body ? {body:JSON.stringify(body)} : {}),
  });
  assert(response.ok, `Management request failed: ${response.status}`);
  return response.json();
}
const sql = query => management('database/query', {query,read_only:false});
const keys = await management('api-keys');
const options = {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin = createClient(`https://${ref}.supabase.co`, keys.find(key=>key.name==='service_role').api_key, options);
const client = () => createClient(`https://${ref}.supabase.co`, keys.find(key=>key.name==='anon').api_key, options);
const [{policy,org,actor}] = await sql(`select life_private.signup_policy() policy,o.id org,
  (select r.person_id from public.life_role_assignments r where r.org_id=o.id and r.role='SYSTEM_ADMIN' limit 1) actor
  from public.life_organizations o where slug='uc-anchor'`);
assert(policy && org && actor, 'Preview requires approved signup policy and test organization');
const people = [randomUUID(),randomUUID()];
const users = [];
let checks = 0;
const pass = label => {checks++; console.log('PASS '+label);};
try {
  for (const [index,group] of ['office','instructor'].entries()) {
    const person=people[index], email=`codex-member-${person}@uc.ac.kr`, request=randomUUID();
    await sql(`begin;
      insert into public.life_people(id,name) values('${person}','[TEST] manual activation');
      insert into life_private.manual_members(person_id,org_id,member_group,email,request_id,request_fingerprint,created_by)
        values('${person}','${org}','${group}','${email}','${request}','test','${actor}');
      insert into life_private.account_classifications(person_id,office_position,instructor_kind,updated_by)
        values('${person}',${group==='office' ? "'DIVISION_HEAD'" : 'null'},${group==='instructor' ? "'INTERNAL'" : 'null'},'${actor}');
      commit;`);
    const password='Aa!'+randomBytes(24).toString('hex');
    const result=await admin.auth.admin.generateLink({type:'signup',email,password,options:{data:{
      name:'Untrusted signup name',mobile_phone:'+821011112222',privacy_policy_id:policy,privacy_accepted:true,
      member_audience:group==='office'?'office':'internal',role:'SYSTEM_ADMIN',
    }}});
    assert(!result.error, 'Native signup link generation failed');
    users.push(result.data.user.id);
    const user=result.data.user.id;
    const [before]=await sql(`select exists(select 1 from public.life_auth_links where auth_user_id='${user}') linked,
      exists(select 1 from life_private.manual_member_claims where user_id='${user}' and verified_at is null) pending`);
    assert.equal(before.linked,false); assert.equal(before.pending,true); pass(group+' remains unlinked before email proof');
    const session=client();
    const verified=await session.auth.verifyOtp({token_hash:result.data.properties.hashed_token,type:'signup'});
    assert(!verified.error && verified.data.session,'Native email verification failed');
    const [after]=await sql(`select a.person_id,p.name from public.life_auth_links a join public.life_people p on p.id=a.person_id where a.auth_user_id='${user}'`);
    assert.equal(after.person_id,person); assert.equal(after.name,'[TEST] manual activation'); pass(group+' native email proof links existing member');
    const context=await session.rpc('life_login_context');
    assert(!context.error); assert.equal(context.data.audience,group==='office'?'office':'internal');
    assert.deepEqual(context.data.roles,group==='office'?[]:['INSTRUCTOR']); pass(group+' login routing and least privilege');
    const security=await session.rpc('life_security_status');
    assert(!security.error); assert.equal(security.data.active,true);
    if(group==='office') {assert.equal(security.data.mfa_required,true); assert.equal(security.data.mfa_verified,false);}
    pass(group+' separate authentication remains enforced');
    await session.auth.signOut();
  }
} finally {
  for(const user of users) {const {error}=await admin.auth.admin.deleteUser(user); assert(!error,'Synthetic Auth cleanup failed');}
  const ids=people.map(id=>`'${id}'`).join(',');
  await sql(`begin;
    delete from public.life_audit_events where entity_id in (${ids}) or actor_id in (${ids});
    delete from public.life_role_assignments where person_id in (${ids});
    delete from public.life_consent_events where person_id in (${ids});
    delete from life_private.account_classifications where person_id in (${ids});
    delete from life_private.manual_member_claims where person_id in (${ids});
    delete from life_private.manual_members where person_id in (${ids});
    delete from public.life_auth_links where person_id in (${ids});
    delete from public.life_people where id in (${ids});
    commit;`);
  const [remaining]=await sql(`select count(*)::int n from public.life_people where id in (${ids})`);
  assert.equal(remaining.n,0); pass('synthetic Preview records removed');
}
console.log(`${checks} native Preview activation checks passed; no mail sent.`);
