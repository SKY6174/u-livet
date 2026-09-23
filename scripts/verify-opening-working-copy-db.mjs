// Local synthetic identities only; never takes a remote URL or sends mail.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { ensureLocalMfa } from './local-mfa.mjs';
const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { stdio: ['ignore', 'pipe', 'pipe'] }));
assert.equal(status.API_URL, 'http://127.0.0.1:55321');
const sql = query => execFileSync('docker', ['exec', '-i', 'supabase_db_uc-life-core', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-tA'], { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const org = '10000000-0000-4000-8000-000000000001', year = '10000000-0000-4000-8000-000000000002';
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = createClient(status.API_URL, status.ANON_KEY, options);
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
const ok = r => { assert.equal(r.error, null, r.error?.message); return r.data; };
let checks = 0;
const pass = label => { checks++; console.log('PASS ' + label); };
const clients = [], run = randomUUID().slice(0, 8);
async function account(label, role) {
  const email = `opening-copy-${run}-${label}@example.invalid`, password = 'Local-Only-2026!';
  const user = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: '[TEST] ' + label, privacy_policy_id: '20000000-0000-4000-8000-000000000011', privacy_accepted: true } })).user.id;
  const c = createClient(status.API_URL, status.ANON_KEY, options); clients.push(c);
  ok(await c.auth.signInWithPassword({ email, password }));
  const person = ok(await c.rpc('life_identity')).id;
  if (role) { sql(`insert into public.life_role_assignments(person_id,org_id,role) values('${person}','${org}','${role}');`); await ensureLocalMfa(c); }
  return { c, person, user };
}
const blank = Object.fromEntries(['year','title','academy','location','mode','selection_method','capacity','apply_from','apply_until','starts_on','ends_on','summary','curriculum'].map(k => [k, '']));
const args = (payload = blank, revision = 0, source = 'P01', o = org) => ({ o, source, payload, expected_revision: revision });
const get = (a, source = 'P01', o = org) => a.c.rpc('life_opening_working_copy', { o, source });
const overview = (a, o = org) => a.c.rpc('life_opening_working_copy_summaries', { o });
const save = (a, ...p) => a.c.rpc('life_save_opening_working_copy', args(...p));
const denied = (r, message) => { assert(r.error); if (message) assert.equal(r.error.message, message); };
const count = () => sql('select count(*) from public.life_offerings;');
try {
  const a = await account('manager', 'COURSE_MANAGER'), b = await account('other-manager', 'COURSE_MANAGER'), learner = await account('learner'), teacher = await account('teacher', 'INSTRUCTOR');
  const before = count();
  assert.equal(ok(await get(a)), null);
  assert.deepEqual(ok(await overview(a)), []);
  assert.equal(ok(await save(a)).revision, 1);
  assert.deepEqual(ok(await get(a)).payload, blank);
  assert.equal(count(), before);
  pass('all undecided fields round-trip without creating any actual offering');
  assert.equal(ok(await get(b)), null);
  ok(await save(b, { ...blank, title: 'Separate author' }));
  assert.equal(ok(await get(a)).payload.title, '');
  assert.equal(ok(await get(b)).payload.title, 'Separate author');
  assert.equal(ok(await get(a, 'P02')), null);
  for (const actor of [learner, teacher]) { denied(await get(actor), 'FORBIDDEN'); denied(await save(actor), 'FORBIDDEN'); }
  for (const actor of [learner, teacher]) denied(await overview(actor), 'FORBIDDEN');
  denied(await overview(a, randomUUID()), 'FORBIDDEN');
  denied(await anon.rpc('life_opening_working_copy_summaries', { o: org }));
  denied(await admin.rpc('life_opening_working_copy_summaries', { o: org }));
  denied(await get(a, 'P01', randomUUID()), 'FORBIDDEN');
  denied(await save(a, blank, 1, 'P01', randomUUID()), 'FORBIDDEN');
  denied(await anon.rpc('life_opening_working_copy', { o: org, source: 'P01' }));
  denied(await anon.rpc('life_save_opening_working_copy', args()));
  for (const c of [anon, a.c, admin]) {
    denied(await c.from('life_opening_working_copies').select('*'));
    denied(await c.from('life_opening_working_copies').insert({ org_id: org, person_id: a.person, source_id: 'P16', payload: blank }));
  }
  pass('author, plan, organization and role scopes hold; direct/anonymous access denied');
  for (const payload of [null, [], {}, { ...blank, title: null }, { ...blank, extra: 'injected' }, { ...blank, title: 'x'.repeat(201) }, { ...blank, capacity: '0' }, { ...blank, capacity: '1001' }, { ...blank, capacity: '1.5' }, { ...blank, mode: 'unknown' }, { ...blank, year: randomUUID() }, { ...blank, starts_on: '2026-02-30' }, { ...blank, apply_from: '2026-09-20T24:00' }, { ...blank, apply_from: '2026-09-20T12:00Z' }]) denied(await save(a, payload, 1), 'INVALID_INPUT');
  for (const source of ['P00', 'P17', 'P01x', null]) denied(await save(a, blank, 1, source), 'INVALID_INPUT');
  for (const revision of [-1, null, 2147483647]) denied(await save(a, blank, revision), 'INVALID_INPUT');
  assert.equal(ok(await get(a)).revision, 1);
  pass('malformed and oversized values, invalid dates, years, sources and revisions rejected');
  const edited = { ...blank, year, title: 'Edited', capacity: '20', apply_from: '2026-09-25T09:00', starts_on: '2026-10-01' };
  const race = await Promise.all([save(a, edited, 1), save(a, { ...edited, title: 'Other tab' }, 1)]);
  assert.equal(race.filter(r => !r.error).length, 1);
  denied(race.find(r => r.error), 'REVISION_CHANGED');
  const current = ok(await get(a)); assert.equal(current.revision, 2);
  assert.equal(current.payload.apply_until, '');
  denied(await save(a, blank, 1), 'REVISION_CHANGED');
  assert.deepEqual(ok(await get(a)), current);
  pass('concurrent and stale saves cannot overwrite a newer draft');
  const audit = JSON.parse(sql(`select jsonb_agg(details) from public.life_audit_events where actor_id='${a.person}' and action='OPENING_WORKING_COPY_SAVED';`));
  assert.equal(audit.length, 2); assert(audit.every(r => Object.keys(r).sort().join(',') === 'revision,source_id'));
  assert.equal(count(), before);
  pass('audit contains only plan/version metadata and offering count is unchanged');
  for (let n=2;n<=16;n++) ok(await save(a, { ...blank, curriculum:'Private draft content '.repeat(400) }, 0, `P${String(n).padStart(2,'0')}`));
  const summaries=ok(await overview(a));
  assert.equal(summaries.length,16);
  assert.equal(summaries[0].revision,2);
  assert.deepEqual(summaries.map(r=>r.source_id),Array.from({length:16},(_,i)=>`P${String(i+1).padStart(2,'0')}`));
  assert(summaries.every(r=>Object.keys(r).sort().join(',')==='revision,source_id,updated_at'));
  assert.equal(ok(await overview(b)).length,1);
  assert.equal(count(),before);
  pass('single summary RPC covers all 16 plans, isolates the author and never returns payloads');
  const samples=[];
  for(let i=0;i<6;i++){const start=performance.now();assert.equal(ok(await overview(a)).length,16);samples.push(Math.round((performance.now()-start)*10)/10);}
  const warm=samples.slice(1).sort((a,b)=>a-b);
  console.log(JSON.stringify({localOverview:{plans:16,requestsPerRead:1,bytes:Buffer.byteLength(JSON.stringify(summaries)),firstMs:samples[0],warmMedianMs:warm[2],samplesMs:samples}}));
  // Make only this local synthetic MFA session stale; keep current AAL2 for reads.
  const session = ok(await a.c.auth.getSession()).session;
  const claims = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url'));
  sql(`update auth.mfa_amr_claims set updated_at=now()-interval '121 minutes' where session_id='${claims.session_id}' and authentication_method='totp';`);
  denied(await save(a, blank, 2), 'MFA_REAUTH_REQUIRED');
  assert.equal(ok(await get(a)).revision, 2);
  pass('recent MFA is required for writing and a rejected write preserves the saved version');
  sql(`delete from public.life_role_assignments where person_id='${b.person}' and role='COURSE_MANAGER';`);
  denied(await get(b), 'FORBIDDEN'); denied(await save(b, blank, 1), 'FORBIDDEN');
  denied(await overview(b), 'FORBIDDEN');
  pass('revoked course-management role immediately loses draft access');
} finally { for (const c of clients) await c.auth.signOut(); }
console.log(`${checks} local working-copy DB checks passed; no remote writes.`);
