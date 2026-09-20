// Local synthetic DB only. Never accepts a remote target and never sends mail.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { ensureLocalMfa } from './local-mfa.mjs';
const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { stdio: ['ignore', 'pipe', 'pipe'] }));
assert.equal(status.API_URL, 'http://127.0.0.1:55321');
const sql = query => execFileSync('docker', ['exec', '-i', 'supabase_db_uc-life-core', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-tA'], { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const org = '10000000-0000-4000-8000-000000000001', year = '10000000-0000-4000-8000-000000000002';
const privacy = '20000000-0000-4000-8000-000000000011', enrollment = '20000000-0000-4000-8000-000000000012';
const create = () => createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const ok = r => { assert.equal(r.error, null, r.error?.message); return r.data; };
let passed = 0;
const pass = label => { passed++; console.log('PASS ' + label); };
const denied = async (client, name, args, code = 'FORBIDDEN') => { const r = await client.rpc(name, args); assert.equal(r.error?.message, code); };
const runId = randomUUID().slice(0, 8);
const clients = [];
async function account(label, role) {
  const email = `attendance-${runId}-${label}@example.invalid`, password = 'Local-Only-2026!';
  ok(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: '[TEST] ' + label, privacy_policy_id: privacy, privacy_accepted: true } }));
  const c = create(); clients.push(c); ok(await c.auth.signInWithPassword({ email, password }));
  const person = ok(await c.rpc('life_identity')).id;
  if (role) { sql(`insert into public.life_role_assignments(person_id,org_id,role) values('${person}','${org}','${role}');`); await ensureLocalMfa(c); }
  return { c, person };
}
const teacher = await account('teacher', 'INSTRUCTOR'), learner = await account('learner'), other = await account('other'), outsider = await account('outsider'), manager = await account('manager', 'COURSE_MANAGER'), expired = await account('expired', 'INSTRUCTOR');
const iso = delta => new Date(Date.now() + delta).toISOString();
const day = delta => new Date(Date.now() + delta + 9 * 3600000).toISOString().slice(0, 10);
const offering = ok(await manager.c.rpc('life_create_offering', { o: org, y: year, title: '[TEST] Attendance ' + runId, academy: '스마트테크', summary: 'Synthetic attendance', curriculum: 'Synthetic only', mode: 'OFFLINE', location: 'Local only', capacity: 60, selection_method: 'REVIEW', apply_from: iso(-86400000), apply_until: iso(86400000), starts_on: day(-100 * 86400000), ends_on: day(100 * 86400000) }));
sql(`insert into public.life_offering_instructors values('${offering}','${teacher.person}',null),('${offering}','${expired.person}',now()-interval '1 day');`);
const people = [learner.person, other.person, teacher.person, ...Array.from({ length: 37 }, () => randomUUID())];
for (const [i, id] of people.entries()) {
  if (i >= 3) sql(`insert into public.life_people(id,name) values('${id}','[TEST] 수강생 ${i}');`);
  sql(`with a as (insert into public.life_applications(offering_id,person_id,status,policy_id) values('${offering}','${id}','ACCEPTED','${enrollment}') returning id) insert into public.life_enrollments(application_id,offering_id,person_id) select id,'${offering}','${id}' from a;`);
}
const first = ok(await teacher.c.rpc('life_schedule_class', { f: offering, title: '첫 수업', starts_at: iso(-7200000), ends_at: iso(-3600000), replaces: null }));
const future = ok(await teacher.c.rpc('life_schedule_class', { f: offering, title: '예정 수업', starts_at: iso(3600000), ends_at: iso(7200000), replaces: null }));
const cancelled = ok(await teacher.c.rpc('life_schedule_class', { f: offering, title: '휴강 수업', starts_at: iso(-14400000), ends_at: iso(-10800000), replaces: null }));
ok(await teacher.c.rpc('life_cancel_class', { s: cancelled, reason: '합성 휴강' }));
const row = (person, revision = 0, minutes = 60) => ({ person_id: person, expected_revision: revision, minutes, reason: '합성 출석 확인' });
const teacherRead = () => teacher.c.rpc('life_teaching_attendance', { f: offering });
for (const actor of [learner, outsider, manager, expired]) await denied(actor.c, 'life_teaching_attendance', { f: offering });
await denied(outsider.c, 'life_my_attendance', { f: offering });
assert((await create().rpc('life_teaching_attendance', { f: offering })).error);
pass('only an actively assigned instructor can read the roster; anonymous/outsider/manager denied');
const empty = ok(await teacherRead());
assert.equal(empty.members.length, 40); assert.equal(empty.attendance.length, 0);
assert(empty.members.every(member => Object.keys(member).sort().join(',') === 'name,person_id'));
pass('session creation builds the roster without inventing attendance or exposing contacts');
const batch = await teacher.c.rpc('life_record_attendance_batch', { s: first, records: [row(learner.person), row(other.person, 0, 0)] });
assert.equal(ok(batch), 2);
const own = ok(await learner.c.rpc('life_my_attendance', { f: offering }));
assert.equal(own.members.length, 1); assert.equal(own.attendance.length, 1); assert.equal(own.attendance[0].person_id, learner.person);
assert.equal(own.attendance[0].credited_minutes, 60);
assert.equal(ok(await other.c.rpc('life_my_attendance', { f: offering })).attendance[0].credited_minutes, 0);
pass('batch writes are visible in each learner’s own attendance and do not reveal classmates');
const revisions = () => sql(`select academic_revision from public.life_offerings where id='${offering}';`);
const beforeRevision = revisions();
await denied(teacher.c, 'life_record_attendance_batch', { s: first, records: [row(learner.person, 1, 30), row(other.person, 0, 10)] }, 'REVISION_CHANGED');
assert.equal(revisions(), beforeRevision);
assert.equal(ok(await learner.c.rpc('life_my_attendance', { f: offering })).attendance[0].credited_minutes, 60);
pass('a stale row rolls back the entire batch, including academic revisions');
for (const [s, records, error] of [
  [first, [row(learner.person, 1), row(learner.person, 1)], 'INVALID_INPUT'],
  [first, [row(learner.person, 1, 61)], 'INVALID_INPUT'],
  [first, [{ ...row(learner.person, 1), reason: ' ' }], 'INVALID_INPUT'],
  [first, [{ ...row(learner.person, 1), minutes: '60' }], 'INVALID_INPUT'],
  [first, [], 'INVALID_INPUT'], [first, null, 'INVALID_INPUT'],
  [first, [row(teacher.person)], 'SELF_APPROVAL_FORBIDDEN'],
  [first, [row(outsider.person)], 'FORBIDDEN'],
  [future, [row(learner.person)], 'CLASS_NOT_FINISHED'],
  [cancelled, [row(learner.person)], 'CLASS_NOT_FINISHED'],
]) await denied(teacher.c, 'life_record_attendance_batch', { s, records }, error);
await denied(learner.c, 'life_record_attendance_batch', { s: first, records: [row(learner.person, 1)] });
await denied(expired.c, 'life_record_attendance_batch', { s: first, records: [row(learner.person, 1)] });
assert((await teacher.c.from('life_attendance').insert({ session_id: first, person_id: people[3], credited_minutes: 60, reason: 'bypass' })).error);
pass('invalid, duplicate, self, future, cancelled, unrelated and direct-table writes are rejected');
const competition = await Promise.all([teacher.c.rpc('life_record_attendance_batch', { s: first, records: [row(learner.person, 1, 40)] }), teacher.c.rpc('life_record_attendance_batch', { s: first, records: [row(learner.person, 1, 50)] })]);
assert.equal(competition.filter(r => !r.error).length, 1); assert.equal(competition.find(r => r.error).error.message, 'REVISION_CHANGED');
assert(Number(sql(`select count(*) from public.life_audit_events where entity_id='${first}' and action='ATTENDANCE_UPDATE';`)) >= 1);
pass('concurrent edits accept one version and preserve attendance audit history');
sql(`update public.life_enrollments set status='WITHDRAWN' where offering_id='${offering}' and person_id='${other.person}';`);
await denied(other.c, 'life_my_attendance', { f: offering });
await denied(teacher.c, 'life_record_attendance_batch', { s: first, records: [row(other.person, 1)] });
assert(!ok(await teacherRead()).members.some(member => member.person_id === other.person));
pass('withdrawal removes the learner from the active book and blocks subsequent recording');
sql(`update public.life_enrollments set status='ACTIVE' where offering_id='${offering}' and person_id='${other.person}';`);
const replacement = ok(await teacher.c.rpc('life_schedule_class', { f: offering, title: '보강 수업', starts_at: iso(-21600000), ends_at: iso(-18000000), replaces: cancelled }));
assert.equal(ok(await teacherRead()).sessions.find(s => s.id === replacement).replaces_id, cancelled);
pass('make-up sessions preserve their cancelled-session relationship');
// Large synthetic course: 40 people × 35 additional sessions = 1,400 records.
sql(`with new_sessions as (
 insert into public.life_class_sessions(offering_id,title,starts_at,ends_at)
 select '${offering}','규모 검증 '||n,now()-interval '50 days'+n*interval '1 day',now()-interval '50 days'+n*interval '1 day'+interval '1 hour' from generate_series(1,35)n returning id
) insert into public.life_attendance(session_id,person_id,credited_minutes,reason,recorded_by)
 select s.id,e.person_id,60,'합성 규모 검증','${teacher.person}' from new_sessions s cross join public.life_enrollments e where e.offering_id='${offering}';`);
const full = ok(await teacherRead());
assert.equal(full.attendance.length, 1402);
const legacy = ok(await teacher.c.from('life_attendance').select('*,life_class_sessions!inner(offering_id)').eq('life_class_sessions.offering_id', offering));
assert.equal(legacy.length, 1000);
pass('the new book returns all 1,402 records beyond the old 1,000-row API cap');
async function previousRead() {
  const course = ok(await teacher.c.from('life_catalog').select('*').eq('id', offering).single());
  const assigned = ok(await teacher.c.from('life_offering_instructors').select('valid_until').eq('offering_id', offering).eq('person_id', teacher.person).single());
  const roster = ok(await teacher.c.rpc('life_roster', { f: offering }));
  const [sessions, firstPage, secondPage] = await Promise.all([
    teacher.c.from('life_class_sessions').select('*').eq('offering_id', offering).order('starts_at'),
    teacher.c.from('life_attendance').select('*,life_class_sessions!inner(offering_id)').eq('life_class_sessions.offering_id', offering).order('session_id').order('person_id').range(0, 999),
    teacher.c.from('life_attendance').select('*,life_class_sessions!inner(offering_id)').eq('life_class_sessions.offering_id', offering).order('session_id').order('person_id').range(1000, 1999),
  ]);
  return { course, assigned, roster, sessions: ok(sessions), attendance: [...ok(firstPage), ...ok(secondPage)] };
}
const samples = { previous: [], optimized: [] };
for (let i = 0; i < 9; i++) for (const kind of (i % 2 ? ['optimized', 'previous'] : ['previous', 'optimized'])) {
  const start = performance.now(), data = kind === 'optimized' ? ok(await teacherRead()) : await previousRead();
  assert.equal(data.attendance.length, 1402);
  samples[kind].push({ ms: Math.round(performance.now() - start), bytes: Buffer.byteLength(JSON.stringify(data)) });
}
const summary = Object.fromEntries(Object.entries(samples).map(([kind, rows]) => { const warm = rows.slice(1).map(row => row.ms).sort((a, b) => a - b); return [kind, { first: rows[0], median: (warm[3] + warm[4]) / 2, p95: warm[7], bytes: rows[8].bytes, samples: rows }]; }));
mkdirSync('tmp/attendance-review', { recursive: true });
writeFileSync('tmp/attendance-review/db-verification.json', JSON.stringify({ passed, offering, people: people.length, sessions: full.sessions.length, attendance: full.attendance.length, summary }, null, 2));
console.log(JSON.stringify({ performance: Object.fromEntries(Object.entries(summary).map(([key, { samples: _, ...value }]) => [key, value])) }));
for (const c of clients) await c.auth.signOut();
console.log(`${passed} local attendance DB checks passed. Synthetic local fixture retained for diagnosis; no remote writes.`);
