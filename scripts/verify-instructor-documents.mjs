// Dedicated local database only; synthetic accounts, no outbound email or AI calls.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { ensureLocalMfa } from './local-mfa.mjs';

const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], {encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(status.API_URL, 'http://127.0.0.1:55321');
const sql = q => execFileSync('docker', ['exec','-i','supabase_db_uc-life-core','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-qtA'], {input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const service = createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const ok = r => { assert.ifError(r.error); return r.data; };
let checks=0;
const pass = text => { checks++; console.log('PASS '+text); };
async function account(label) {
  const email=`documents-${label}@example.invalid`;
  let user=ok(await service.auth.admin.listUsers({perPage:1000})).users.find(u=>u.email===email);
  if(!user) user=ok(await service.auth.admin.createUser({email,password:'Local-Only-2026!',email_confirm:true,user_metadata:{name:'가상 서류 '+label,privacy_policy_id:'20000000-0000-4000-8000-000000000011',privacy_accepted:true}})).user;
  const client=createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  ok(await client.auth.signInWithPassword({email,password:'Local-Only-2026!'}));
  await ensureLocalMfa(client);
  return {client,id:user.id,person:ok(await client.rpc('life_identity')).id};
}
const owner=await account('owner'), other=await account('other'), manager=await account('manager');
const org=randomUUID(), role=randomUUID();
sql(`insert into public.life_organizations(id,slug,name) values('${org}','documents-${org}','가상 서류 검증 기관');insert into public.life_role_assignments(id,person_id,org_id,role) values('${role}','${owner.person}','${org}','INSTRUCTOR'),(gen_random_uuid(),'${manager.person}','${org}','COURSE_MANAGER');`);
const worker=spawn('npx',['-y','deno','run','--allow-env','--allow-net','supabase/functions/instructor-documents/index.ts'],{env:{...process.env,SUPABASE_URL:status.API_URL,SUPABASE_ANON_KEY:status.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY,ADVISORY_PII_KEY:randomBytes(32).toString('base64'),INSTRUCTOR_DOCUMENT_ALLOWED_ORIGINS:'http://localhost:3100',OPENAI_API_KEY:'',GEMINI_API_KEY:''},stdio:['ignore','ignore','ignore'],detached:true});
async function call(actor,action,body={}) {
  const jwt=actor?ok(await actor.client.auth.getSession()).session.access_token:'';
  const r=await fetch('http://localhost:8000',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${jwt}`},body:JSON.stringify({action,...body})});
  return {status:r.status,...await r.json()};
}
try {
  let ready=false;
  for(let i=0;i<40;i++){try{await fetch('http://localhost:8000');ready=true;break;}catch{await new Promise(r=>setTimeout(r,250));}}
  assert.ok(ready,'local Edge handler starts');
  assert.equal((await call(null,'session')).status,403); pass('anonymous access denied');
  assert.equal((await call(other,'session',{person_id:owner.person,org_id:org})).status,403);pass('another account cannot open owner documents');
  assert.ok((await other.client.rpc('life_instructor_document_directory',{p_org:org})).error);
  const directory=ok(await manager.client.rpc('life_instructor_document_directory',{p_org:org}));
  assert.ok(directory.items.some(x=>x.id===owner.person));
  assert.ok(directory.items.every(x=>!('resident_number' in x)&&!('object_path' in x)));
  pass('directory limited to scoped manager and non-sensitive status');
  const entered=await call(owner,'session',{person_id:owner.person,org_id:org});assert.equal(entered.ok,true,JSON.stringify(entered));const token=entered.data.token;
  assert.equal((await call(manager,'session',{person_id:owner.person,org_id:org})).ok,true);pass('owner and scoped manager can enter');
  assert.equal((await call(other,'advisory-intake-context',{voter_token:token})).status,403);pass('stolen document token rejected for another JWT');
  const draft={korean_name:'가상 서류 owner',email:'',resident_number:'',address:'가상주소',phones:{},education:[],careers:[],licenses:[]};
  const saved=await call(owner,'advisory-intake-save-profile-draft',{voter_token:token,resume:draft});assert.equal(saved.ok,true,JSON.stringify(saved));
  const ciphertext=sql(`select encrypted_resume from public.life_instructor_private_profile_drafts where person_id='${owner.person}'`);assert.ok(ciphertext.length>30&&!ciphertext.includes('가상주소'));
  const ctx=await call(owner,'advisory-intake-context',{voter_token:token});assert.equal(ctx.data.resume.address,'가상주소');assert.equal(ctx.data.documents.RESUME.exists,false);assert.equal(ctx.data.documents.RESUME.is_draft,true);pass('AES-GCM draft roundtrip without marking completed');
  const complete={...draft,email:'owner@example.invalid',resident_number:'000000-0000000',phones:{mobile:'010-0000-0000'}};
  assert.equal((await call(owner,'advisory-intake-save-profile',{voter_token:token,resume:complete})).ok,true);
  const final=await call(owner,'advisory-intake-context',{voter_token:token});assert.equal(final.data.documents.RESUME.exists,true);assert.equal(final.data.documents.RESUME.is_draft,false);pass('completed resume replaces draft');
  assert.equal((await call(owner,'advisory-intake-save-profile',{voter_token:token,resume:{...complete,korean_name:'다른사람'}})).status,400);pass('name mismatch rejected');
  assert.equal((await call(owner,'advisory-intake-upload',{voter_token:token,document_type:'ID_COPY',file_name:'fake.png',data_url:'data:image/png;base64,ZmFrZQ=='})).status,400);pass('fake image signature rejected');
  for(const table of ['private_profiles','private_profile_drafts','private_documents','generated_documents','document_sessions']) assert.ok((await owner.client.from('life_instructor_'+table).select('*')).error);
  pass('direct authenticated table access denied');
  sql(`update public.life_role_assignments set valid_until=now() where id='${role}'`);
  assert.equal((await call(owner,'advisory-intake-context',{voter_token:token})).status,403);pass('revoked instructor role immediately denies active token');
  sql(`update public.life_role_assignments set valid_until=null where id='${role}'`);
  assert.equal((await call(owner,'logout',{voter_token:token})).ok,true);
  assert.equal((await call(owner,'advisory-intake-context',{voter_token:token})).status,403);pass('logout revokes token');
  const last=await call(owner,'session',{person_id:owner.person,org_id:org});
  sql(`update public.life_instructor_document_sessions set expires_at=now()-interval '1 second' where actor_user_id='${owner.id}'`);
  assert.equal((await call(owner,'advisory-intake-context',{voter_token:last.data.token})).status,403);pass('expired session denied');
  assert.equal(sql("select public from storage.buckets where id='instructor-private-documents'"),'f');pass('private storage bucket');
} finally {
  try {process.kill(-worker.pid,'SIGTERM');} catch { /* Process may already have exited. */ }
  sql(`delete from public.life_instructor_document_sessions where org_id='${org}';delete from public.life_instructor_private_profiles where person_id='${owner.person}';delete from public.life_instructor_private_profile_drafts where person_id='${owner.person}';delete from public.life_role_assignments where org_id='${org}';delete from public.life_organizations where id='${org}';`);
}
console.log(`${checks} instructor document checks passed.`);
