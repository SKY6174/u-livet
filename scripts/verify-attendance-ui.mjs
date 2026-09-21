import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}
const model = load('src/lib/attendance/model.ts');
const uuid = '10000000-0000-4000-8000-000000000001', person = '20000000-0000-4000-8000-000000000001';
const other = '20000000-0000-4000-8000-000000000002';
const now = Date.parse('2026-09-20T00:00:00Z');
const sessions = Array.from({ length: 4 }, (_, i) => ({ id: String(i), title: '수업 ' + i, starts_at: '2026-09-19T00:00:00Z', ends_at: i === 3 ? '2026-09-21T01:00:00Z' : '2026-09-19T01:00:00Z', status: i === 2 ? 'CANCELLED' : 'SCHEDULED', replaces_id: null, reason: '휴강' }));
const attendance = [{ session_id: '0', person_id: person, credited_minutes: 60, reason: '직접 확인', revision: 1, recorded_at: '2026-09-19T01:00:00Z' }];
const book = { offering: { id: uuid, name: '합성 과정', starts_on: '2026-09-01', ends_on: '2026-09-30' }, viewer_id: person, generated_at: new Date(now).toISOString(), sessions, attendance, members: [{ person_id: person, name: '합성 수강생' }] };
let checks = 0;
async function test(label, run) { await run(); checks++; console.log('PASS ' + label); }
await test('summary distinguishes missing, absence, future and cancelled classes', () => {
  const partial = model.attendanceSummary(sessions, model.attendanceIndex(attendance), person, now);
  assert.deepEqual(partial, { ended: 2, recorded: 1, missing: 1, credited: 60, total: 120, percent: null });
  const complete = model.attendanceSummary(sessions, model.attendanceIndex([...attendance, { ...attendance[0], session_id: '1', credited_minutes: 0 }]), person, now);
  assert.equal(complete.percent, 50); assert.equal(complete.missing, 0);
  assert.equal(model.attendanceState(sessions[1], undefined, now), '미입력');
  assert.equal(model.attendanceState(sessions[1], { credited_minutes: 0 }, now), '결석');
  assert.equal(model.attendanceState(sessions[1], { credited_minutes: 30 }, now), '일부 출석');
  assert.equal(model.attendanceState(sessions[0], attendance[0], now), '출석');
  assert.equal(model.attendanceState(sessions[2], attendance[0], now), '휴강');
  assert.equal(model.attendanceState(sessions[3], undefined, now), '예정·진행 중');
  assert.equal(model.attendanceSummary([], new Map(), person, now).percent, null);
});
const portal = { UUID: /^[a-f0-9-]{36}$/i, dateTime: value => value, statusLabel: {}, modeLabel: {} };
const ui = { PageIntro: ({ title, children }) => React.createElement('header', null, title, children), Empty: ({ title }) => React.createElement('p', null, title) };
const common = { 'next/link': 'a', '@/lib/attendance/model': model, '@/lib/portal/data': portal, '@/components/portal/ui': ui };
const Printed = load('src/components/attendance/attendance-print.tsx', { ...common, './attendance-print.module.css': { sheet: 'attendance-sheet' } }).AttendancePrint;
await test('print pagination contains every member/session exactly in its page segment', () => {
  const large = { ...book, members: Array.from({ length: 21 }, (_, i) => ({ person_id: 'p'+i, name: '수강생'+i })), sessions: Array.from({ length: 7 }, (_, i) => ({ ...sessions[0], id: 's'+i, title: '회차'+i })) };
  const output = renderToStaticMarkup(React.createElement(Printed, { book: large }));
  assert.equal((output.match(/class="report-sheet report-landscape /g) ?? []).length, 4);
  assert.equal((output.match(/scope="row"/g) ?? []).length, 42);
  assert(output.includes('회차6') && output.includes('수강생20') && output.includes('서명란'));
  assert(!output.includes('email'));
});
let identity = true, requests = [], response = { data: book, error: null };
const notFound = () => { throw Error('NOT_FOUND'); };
const data = load('src/lib/attendance/data.ts', { ...common, react: { cache: fn => fn }, 'next/navigation': { notFound },
  '@/lib/auth/session': { requireIdentity: async () => { if (!identity) throw Error('LOGIN_REQUIRED'); } },
  '@/lib/supabase/server': { createServerSupabaseClient: async () => ({ rpc: async (name, args) => { requests.push({ name, args }); if (response instanceof Error) throw response; return name === "life_qr_checkins" ? { data: [], error: null } : response; } }) },
});
await test('book loader scopes attendance and QR reads without accepting a learner person identifier', async () => {
  for (const [audience, name] of [['instructor', 'life_teaching_attendance'], ['learner', 'life_my_attendance']]) {
    requests = []; assert.equal((await data.getAttendanceBook(uuid, audience)).book, book);
    assert.deepEqual(requests, [{ name, args: { f: uuid } }, { name: "life_qr_checkins", args: { f: uuid } }]);
  }
  requests = []; identity = false; await assert.rejects(data.getAttendanceBook(uuid, 'instructor'), /LOGIN_REQUIRED/); assert.equal(requests.length, 0);
  identity = true; await assert.rejects(data.getAttendanceBook('invalid', 'learner'), /NOT_FOUND/); assert.equal(requests.length, 0);
});
await test('permission denial and DB outage do not become an empty successful attendance book', async () => {
  response = { data: null, error: { message: 'FORBIDDEN' } }; await assert.rejects(data.getAttendanceBook(uuid, 'learner'), /NOT_FOUND/);
  for (const value of [{ data: null, error: { message: 'timeout' } }, Error('offline'), { data: null, error: null }]) {
    response = value; const result = await data.getAttendanceBook(uuid, 'learner'); assert.equal(result.unavailable, true); assert.equal(result.book, null);
  }
});
const Student = load('src/app/learning/[id]/attendance/page.tsx', { ...common, '@/lib/attendance/data': { getAttendanceBook: async () => ({ book }) } }).default;
await test('learner screen labels incomplete attendance as pending rather than zero percent', async () => {
  const output = renderToStaticMarkup(await Student({ params: Promise.resolve({ id: uuid }) }));
  assert(output.includes('확인 중')); assert(output.includes('미입력 1회')); assert(output.includes('60 / 120분')); assert(!output.includes('0%'));
  assert(output.includes('예정·진행 중')); assert(output.includes('휴강 사유'));
});
let calls = [], invalidations = [], rpcResponse = { data: 1, error: null };
const actions = load('src/app/attendance-actions.ts', { ...common,
  '@/lib/auth/mfa-message': { MFA_REAUTH_MESSAGE: 'MFA required' },
  'next/cache': { revalidatePath: (...args) => invalidations.push(args) },
  '@/lib/auth/session': { getSessionIdentity: async () => identity ? { id: person } : null },
  '@/lib/supabase/server': { createServerSupabaseClient: async () => ({ rpc: async (name, args) => { calls.push({ name, args }); if (rpcResponse instanceof Error) throw rpcResponse; return rpcResponse; } }) },
});
const form = rows => { const f = new FormData(); f.set('session', uuid); f.set('records', typeof rows === 'string' ? rows : JSON.stringify(rows)); return f; };
const valid = { person_id: person, minutes: 0, reason: '확인한 결석', expected_revision: 0 };
await test('server boundary validates identity, UUID, numeric data, reasons, duplicates and batch size', async () => {
  identity = false; assert(!(await actions.saveAttendanceBatch({}, form([valid]))).ok); assert.equal(calls.length, 0); identity = true;
  for (const rows of ['invalid', [], [null], [{ ...valid, minutes: null }], [{ ...valid, minutes: -1 }], [{ ...valid, minutes: '60' }], [{ ...valid, reason: ' ' }], [{ ...valid, expected_revision: 0.1 }], [{ ...valid, expected_revision: -1 }], [{ ...valid, person_id: 'bad' }], [valid, valid], Array.from({ length: 201 }, () => valid)]) assert(!(await actions.saveAttendanceBatch({}, form(rows))).ok);
  assert.equal(calls.length, 0);
  const bad = form([valid]); bad.set('session', 'bad'); assert(!(await actions.saveAttendanceBatch({}, bad)).ok); assert.equal(calls.length, 0);
  assert((await actions.saveAttendanceBatch({}, form([valid]))).ok); assert.equal(calls.length, 1); assert.equal(calls[0].name, 'life_record_attendance_batch');
  assert(invalidations.some(([path]) => path === '/learning') && invalidations.some(([path]) => path === '/admin'));
});
await test('conflict, MFA and connection failures preserve useful user-facing errors', async () => {
  for (const [failure, expected] of [[{ data: null, error: { message: 'REVISION_CHANGED' } }, '입력 내용은 유지'], [{ data: null, error: { message: 'MFA_REAUTH_REQUIRED' } }, 'MFA required'], [Error('offline'), 'DB 연결']]) {
    rpcResponse = failure; invalidations = [];
    const state = await actions.saveAttendanceBatch({}, form([valid])); assert(!state.ok); assert(state.message.includes(expected)); assert.equal(invalidations.length, 0);
  }
});
// Stateful client harness: exercise selection and submitted payload from the real editor.
let stateValues = [], cursor = 0, actionState = { message: '' }, pending = false;
const router = { refresh() {} };
const hooks = { useState(initial) { const i = cursor++; if (!(i in stateValues)) stateValues[i] = initial; return [stateValues[i], value => { stateValues[i] = typeof value === 'function' ? value(stateValues[i]) : value; }]; }, useActionState: () => [actionState, '/save', pending], useEffect: () => {}, useRef: () => ({ current: '' }), useMemo: fn => fn() };
const Editor = load('src/components/attendance/attendance-editor.tsx', { ...common, react: hooks, 'next/navigation': { useRouter: () => router },
  '@/app/attendance-actions': { saveAttendanceBatch: () => {} }, '@/app/evaluation-actions': {}, '@/components/portal/action-form': { ActionForm: () => null }, '@/lib/auth/mfa-message': { MFA_REAUTH_MESSAGE: 'MFA required' },
}).AttendanceEditor;
const instructorBook = { ...book, viewer_id: 'teacher', members: [...book.members, { person_id: other, name: '다른 수강생' }] };
const render = () => { cursor = 0; return Editor({ book: instructorBook }); };
const elements = node => node && typeof node === 'object' ? [node, ...React.Children.toArray(node.props?.children).flatMap(elements)] : [];
const find = (tree, predicate) => elements(tree).find(predicate);
const payload = () => JSON.parse(find(render(), e => e.props?.name === 'records').props.value);
await test('bulk selection fills only unrecorded people and does not write before submission', () => {
  assert.deepEqual(payload(), []);
  find(render(), e => e.type === 'button' && e.props.children === '미입력자 전원 출석 선택').props.onClick();
  const rows = payload(); assert.equal(rows.length, 1); assert.equal(rows[0].person_id, other); assert.equal(rows[0].minutes, 60); assert.equal(rows[0].expected_revision, 0);
  assert.equal(rows[0].reason, '');
  pending = true; assert(find(render(), e => e.type === 'select').props.disabled);
  assert(elements(render()).filter(e => e.props?.type === 'checkbox').every(e => e.props.disabled));
  pending = false;
  actionState = { message: '저장 실패' }; assert.equal(payload().length, 1);
});
await test('existing evaluation pages reuse the bounded attendance snapshot with one exam request', async () => {
  for (const audience of ['instructor', 'learner']) {
    let reads = 0, books = 0;
    const file = audience === 'instructor' ? 'src/app/instructor/offerings/[id]/evaluation/page.tsx' : 'src/app/learning/[id]/evaluation/page.tsx';
    const Page = load(file, { ...common,
      '@/lib/attendance/data': { getAttendanceBook: async (id, actual) => { assert.equal(id, uuid); assert.equal(actual, audience); books++; return { book }; } },
      '@/lib/supabase/server': { createServerSupabaseClient: async () => ({ rpc: async (name, args) => { assert.equal(name, 'life_exam_room'); assert.deepEqual(args, { f: uuid }); reads++; return { data: { quizzes: [], attempts: [] }, error: null }; } }) },
      '@/components/portal/action-form': { ActionForm: () => null }, '@/components/portal/quiz-editor': { QuizEditor: () => null }, '@/app/evaluation-actions': {},
    }).default;
    const output = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: uuid }) }));
    assert.equal(reads, 1); assert.equal(books, 1); assert(output.includes('/attendance'));
  }
});
console.log(`${checks} attendance UI/action checks passed; no network or real users.`);
