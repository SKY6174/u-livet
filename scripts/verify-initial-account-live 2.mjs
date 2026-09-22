// Disposable Preview only. No messages are sent; all link/token/password data stays in memory.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
import { totp } from './local-mfa.mjs';

assert.ok(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === '--web'));
const WEB = process.argv[2] === '--web';
const REF = 'bfqwntulxabfrimcypvx';
const DEPLOY = 'uc-life-git-preview-ucsky6174.vercel.app';
const ORIGIN = `https://${DEPLOY}`;
const token = execFileSync('security', ['find-generic-password','-s','Supabase CLI','-a','supabase','-w'], {encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
async function management(path, body) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/${path}`, {
    method:body ? 'POST':'GET', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:body && JSON.stringify(body), signal:AbortSignal.timeout(30000),
  });
  if (!r.ok) throw Error(`MANAGEMENT_${r.status}`);
  return r.json();
}
const sql = query => management('database/query', {query,read_only:false});
const config = await management('config/auth');
assert.equal(config.disable_signup, true);
assert.equal(config.mailer_otp_exp, 900);
const keys = await management('api-keys');
const client = key => createClient(`https://${REF}.supabase.co`,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const admin = client(keys.find(k=>k.name==='service_role').api_key);
const fresh = () => client(keys.find(k=>k.name==='anon').api_key);
const ok = r => { if(r.error)throw Error(`AUTH_${r.error.code ?? r.error.status ?? 'FAILED'}`);return r.data; };
const q = v => `'${String(v).replaceAll("'","''")}'`;
const org=randomUUID(),year=randomUUID(),policy=randomUUID(),approver=randomUUID();
const users=[],people=[],sessions=[];
let seeded=false,checks=0,stage='pages';
const pass = name => { checks++;console.log('PASS '+name); };
function curl(path, extra=[], input) {
  const r=spawnSync('npx',['--yes','vercel@59.23.2','curl',path,'--deployment',DEPLOY,'--scope','ucsky6174','--','--silent','--fail','--max-time','40',...extra],{input,encoding:'utf8',maxBuffer:8*1024*1024,timeout:60000});
  if(r.status!==0)throw Error(`PREVIEW_HTTP_${r.status}`);
  return r.stdout;
}
async function action(id, fields) {
  const require=createRequire(import.meta.url);
  const {encodeReply}=require('next/dist/compiled/react-server-dom-webpack/client.node');
  const data=new FormData();for(const [k,v]of Object.entries(fields))data.set(k,v);
  const request=new Request(ORIGIN+'/auth/accept-invitation',{method:'POST',body:await encodeReply([{},data])});
  return curl('/auth/accept-invitation',['--include','--request','POST','--header',`Origin: ${ORIGIN}`,'--header',`Next-Action: ${id}`,'--header','Accept: text/x-component','--header',`Content-Type: ${request.headers.get('content-type')}`,'--data-binary','@-'],Buffer.from(await request.arrayBuffer()));
}
async function invite() {
  const email=`initial-${randomUUID()}@example.invalid`;
  const result=ok(await admin.auth.admin.generateLink({type:'invite',email,options:{data:{name:'[TEST] Initial account',privacy_policy_id:policy,privacy_accepted:true,role:'SYSTEM_ADMIN'}}}));
  users.push(result.user.id);
  const person=(await sql(`select person_id from public.life_auth_links where auth_user_id=${q(result.user.id)}`))[0].person_id;people.push(person);
  return {email,id:result.user.id,hash:result.properties.hashed_token,person};
}
try {
  let actionId;
  if(WEB) {
    const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
    assert.equal(JSON.parse(curl('/api/version')).revision,revision);
    const html=curl('/auth/accept-invitation');
    assert.ok(html.includes('처음 비밀번호를 설정해 주세요'));
    const paths=[...new Set([...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]))].reverse();
    for(const path of paths){const chunk=curl(path);const match=chunk.match(/createServerReference\)\("([a-f0-9]{40,})"[^;]{0,220}"acceptInvitation"\)/);if(match){actionId=match[1];break;}}
    assert.ok(actionId,'Published invite action required');
    pass('Preview source revision and invitation page match');
  }
  stage='fixture';
  await sql(`begin;
    insert into public.life_organizations(id,slug,name) values(${q(org)},${q('invite-test-'+org)},'[TEST] Initial account');
    insert into public.life_project_years(id,org_id,label,starts_on,ends_on) values(${q(year)},${q(org)},'[TEST]','2026-01-01','2026-12-31');
    insert into public.life_people(id,name) values(${q(approver)},'[TEST] Fixture approver');
    insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at)
    values(${q(policy)},${q(org)},'ACCOUNT_PRIVACY','test-only','[TEST] Not an institution policy','Synthetic verification only. No actual consent.','APPROVED',${q(approver)},now());commit;`);
  seeded=true;stage='invite';const a=await invite();
  const before=ok(await admin.auth.admin.getUserById(a.id)).user;
  assert.ok(before.invited_at);assert.ok(!before.email_confirmed_at);pass('Native invite creates unconfirmed account with no mail');
  const password=`Aa1!${randomBytes(18).toString('hex')}`;
  if(WEB) {
    stage='web-password';
    const weak=await action(actionId,{token_hash:a.hash,password:'weak'});
    assert.ok(weak.includes('12자'));assert.ok(!ok(await admin.auth.admin.getUserById(a.id)).user.email_confirmed_at);
    pass('Weak web password preserves unused email proof');
    const result=await action(actionId,{token_hash:a.hash,password,type:'recovery'});
    assert.ok(result.includes('/auth/invitation-accepted'));pass('Website accepts invite proof with fixed native type');
    const replay=await action(actionId,{token_hash:a.hash,password});
    assert.ok(replay.includes('초대 링크를 사용할 수 없습니다.'));pass('Website rejects invitation replay');
  } else {
    stage='native-proof';const c=fresh();sessions.push(c);
    assert.ok((await c.auth.verifyOtp({token_hash:a.hash,type:'recovery'})).error);
    ok(await c.auth.verifyOtp({token_hash:a.hash,type:'invite'}));pass('Invite proof cannot be used as recovery; email ownership verifies');
    stage='native-invite-status';
    const initialStatus=ok(await c.rpc('life_auth_status'));
    assert.equal(initialStatus.active,true);
    const initialIdentity=ok(await c.rpc('life_identity'));
    // Native invite proof may already authenticate the learner; it must never grant staff.
    assert.deepEqual(initialIdentity?.roles ?? [],[]);pass('Native invite session is active without elevated roles');
    assert.ok((await c.auth.updateUser({password:'weak'})).error);
    ok(await c.auth.updateUser({password}));ok(await c.auth.signOut({scope:'global'}));pass('Native password policy enforced; initial password set');
    assert.ok((await fresh().auth.verifyOtp({token_hash:a.hash,type:'invite'})).error);pass('Native invitation cannot be replayed');
  }
  stage='login';const login=fresh();sessions.push(login);ok(await login.auth.signInWithPassword({email:a.email,password}));
  const identity=ok(await login.rpc('life_identity'));assert.equal(identity.id,a.person);assert.deepEqual(identity.roles,[]);pass('New password login works without metadata privilege escalation');
  assert.ok(ok(await admin.auth.admin.getUserById(a.id)).user.email_confirmed_at);pass('Email confirmation completed through invite proof');
  if(!WEB) {
    stage='mfa';const label=ok(await login.rpc('life_prepare_mfa_change',{k:'ENROLL'}));
    const factor=ok(await login.auth.mfa.enroll({factorType:'totp',friendlyName:label,issuer:'U-LIFE TEST'}));
    ok(await login.auth.mfa.challengeAndVerify({factorId:factor.id,code:totp(factor.totp.secret)}));
    assert.equal(ok(await login.rpc('life_security_status')).recent,true);pass('Invited account can enroll and verify native TOTP');
    stage='expiry';const expired=await invite();await sql(`update auth.users set invited_at=now()-interval '20 minutes',confirmation_sent_at=now()-interval '20 minutes' where id=${q(expired.id)}`);
    assert.ok((await fresh().auth.verifyOtp({token_hash:expired.hash,type:'invite'})).error);pass('Expired invitation proof rejected');
  }
  stage='complete';console.log(`${checks} ${WEB?'web':'native'} initial-account checks passed; no mail sent.`);
} catch(e) { console.error(`FAILED ${stage}: ${e.code ?? e.message}`);process.exitCode=1; }
finally {
  for(const c of sessions)await c.auth.signOut().catch(()=>{});
  for(const id of users)ok(await admin.auth.admin.deleteUser(id));
  if(seeded)await sql(`begin;
    delete from public.life_consent_events where policy_id=${q(policy)};
    alter table public.life_policy_versions disable trigger life_policy_freeze;
    delete from public.life_policy_versions where id=${q(policy)} and org_id=${q(org)};
    alter table public.life_policy_versions enable trigger life_policy_freeze;
    delete from public.life_auth_links where person_id in (${[...people,approver].map(q).join(',')});
    delete from public.life_people where id in (${[...people,approver].map(q).join(',')});
    delete from public.life_project_years where id=${q(year)};
    delete from public.life_organizations where id=${q(org)};commit;`);
  console.log('Synthetic Preview accounts and fixture data cleaned.');
}
