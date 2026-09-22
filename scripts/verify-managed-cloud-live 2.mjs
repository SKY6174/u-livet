// Explicitly scoped to the existing disposable Preview, never production.
// No email is sent. API keys/passwords/TOTP secrets stay in memory.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { totp } from './local-mfa.mjs';
import { CLOUD_REQUIRED_CHARACTERS } from './lib/managed-cloud.mjs';

const REF = 'bfqwntulxabfrimcypvx';
assert.equal(process.argv.length, 2, 'No alternate target is accepted');
const token = execFileSync('security', ['find-generic-password','-s','Supabase CLI','-a','supabase','-w'], {encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
async function management(path, body) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/${path}`, {
    method:body ? 'POST':'GET', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:body && JSON.stringify(body), signal:AbortSignal.timeout(30000),
  });
  const d = await r.json(); if (!r.ok) throw new Error(`MANAGEMENT_${r.status}`); return d;
}
const sql = query => management('database/query', {query,read_only:false});
const config = await management('config/auth');
assert.equal(config.password_min_length, 12);
assert.equal(config.password_required_characters, CLOUD_REQUIRED_CHARACTERS);
assert.equal(config.disable_signup, true);
const keys = await management('api-keys');
const publicKey = keys.find(k=>k.name==='anon').api_key;
const serviceKey = keys.find(k=>k.name==='service_role').api_key;
const client = key => createClient(`https://${REF}.supabase.co`,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const admin = client(serviceKey);
const org=randomUUID(),year=randomUUID(),policy=randomUUID(),approver=randomUUID();
const quote=v=>`'${String(v).replaceAll("'","''")}'`;
const users=[];const people=[];const sessions=[];
let seeded=false, passed=0, stage='fixture';
const check=(label,condition)=>{assert.ok(condition,label);passed++;console.log(`PASS ${label}`);};
const ok=result=>{if(result.error)throw new Error(`API_${result.error.code ?? result.error.status ?? 'FAILED'}_${/^[A-Z_]+$/.test(result.error.message) ? result.error.message : 'REDACTED'}`);return result.data;};
try {
  await sql(`begin;
    insert into public.life_organizations(id,slug,name) values(${quote(org)},${quote('cloud-test-'+org)},'[TEST] Managed Cloud verification');
    insert into public.life_project_years(id,org_id,label,starts_on,ends_on) values(${quote(year)},${quote(org)},'[TEST]','2026-01-01','2026-12-31');
    insert into public.life_people(id,name) values(${quote(approver)},'[TEST] Fixture approver');
    insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at)
    values(${quote(policy)},${quote(org)},'ACCOUNT_PRIVACY','test-only','[TEST] Not an institution policy','Synthetic acceptance fixture. No real consent.','APPROVED',${quote(approver)},now());commit;`);
  seeded=true;
  for(const role of ['learner','staff']) {
    stage=`create-${role}`;
    const email=`cloud-${randomUUID()}@example.invalid`,password=`Aa1!${randomBytes(18).toString('hex')}`;
    const created=ok(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name:`[TEST] ${role}`,privacy_policy_id:policy,privacy_accepted:true,role:'SYSTEM_ADMIN'}})).user;
    users.push(created.id);
    const c=client(publicKey);ok(await c.auth.signInWithPassword({email,password}));sessions.push(c);
    const identity=ok(await c.rpc('life_identity'));check(`${role} native login + identity`,!!identity?.id);people.push(identity.id);
    check(`${role} signup metadata cannot grant staff`,identity.roles.length===0);
    if(role==='staff') {
      await sql(`insert into public.life_role_assignments(person_id,org_id,role) values(${quote(identity.id)},${quote(org)},'SYSTEM_ADMIN'),(${quote(identity.id)},${quote(org)},'COURSE_MANAGER')`);
      check('staff AAL1 cannot access business identity',ok(await c.rpc('life_identity'))===null);
      const label=ok(await c.rpc('life_prepare_mfa_change',{k:'ENROLL'}));
      const factor=ok(await c.auth.mfa.enroll({factorType:'totp',friendlyName:label,issuer:'U-LIFE TEST'}));
      ok(await c.auth.mfa.challengeAndVerify({factorId:factor.id,code:totp(factor.totp.secret)}));
      check('native TOTP satisfies recent DB authentication',ok(await c.rpc('life_security_status')).recent===true);
      check('staff AAL2 business identity restored',ok(await c.rpc('life_identity')).id===identity.id);
      check('application refuses removing last staff factor',!!(await c.rpc('life_prepare_mfa_change',{k:'REMOVE',f:factor.id})).error);
    } else {
      for(const bad of ['abcdefghij1!','ABCDEFGHIJ1!','Abcdefghijk!','Abcdefghij12','Abcdefghi1!'])
        check('native password API rejects missing requirement',!!(await c.auth.updateUser({password:bad})).error);
    }
  }
  stage='business-write';
  const args={o:org,y:year,title:'[TEST] Managed Cloud course',academy:'[TEST]',summary:'Synthetic validation',curriculum:'Synthetic validation',mode:'ONLINE',location:'[TEST]',capacity:10,selection_method:'REVIEW',apply_from:'2026-10-01T00:00:00Z',apply_until:'2026-10-10T00:00:00Z',starts_on:'2026-10-15',ends_on:'2026-10-30'};
  check('learner cannot create course',!!(await sessions[0].rpc('life_create_offering',args)).error);
  check('verified administrator can save course',!!ok(await sessions[1].rpc('life_create_offering',args)));
  const visible=ok(await sessions[0].from('life_people').select('id'));
  check('learner cannot read staff profile',!visible.some(p=>p.id===people[1]));
  const learner=sessions[0];
  ok(await learner.auth.updateUser({password:`Bb2!${randomBytes(18).toString('hex')}`}));
  check('password change rejects preceding business session',ok(await learner.rpc('life_identity'))===null);
  check('password change invalidates preceding auth status',ok(await learner.rpc('life_auth_status')).active===false);
  check('old password session cannot prepare MFA enrollment',!!(await learner.rpc('life_prepare_mfa_change',{k:'ENROLL'})).error);
  check('anonymous request-limit RPC denied',!!(await client(publicKey).rpc('life_check_auth_request',{p_action:'login',p_subject:'a'.repeat(64),p_network:'b'.repeat(64),p_pair:'c'.repeat(64)})).error);
  stage='complete';console.log(`${passed} live Managed Cloud checks passed; no mail sent.`);
} catch(e) {
  console.error(`FAILED ${stage}: ${e.message}`);process.exitCode=1;
} finally {
  for(const c of sessions)await c.auth.signOut().catch(()=>{});
  for(const id of users)ok(await admin.auth.admin.deleteUser(id));
  if(seeded) await sql(`begin;
    delete from public.life_audit_events where org_id=${quote(org)};
    delete from public.life_offerings where org_id=${quote(org)};
    delete from public.life_course_versions where org_id=${quote(org)};
    delete from public.life_courses where org_id=${quote(org)};
    delete from public.life_role_assignments where org_id=${quote(org)};
    delete from public.life_consent_events where policy_id=${quote(policy)};
    alter table public.life_policy_versions disable trigger life_policy_freeze;
    delete from public.life_policy_versions where id=${quote(policy)} and org_id=${quote(org)};
    alter table public.life_policy_versions enable trigger life_policy_freeze;
    delete from public.life_auth_links where person_id in (${[...people,approver].map(quote).join(',')});
    delete from public.life_people where id in (${[...people,approver].map(quote).join(',')});
    delete from public.life_project_years where id=${quote(year)};
    delete from public.life_organizations where id=${quote(org)};commit;`);
  console.log('Synthetic Preview users and fixture data cleaned.');
}
