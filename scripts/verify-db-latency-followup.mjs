import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => Object.hasOwn(mocks, name)
    ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}
let checks = 0;
async function test(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
async function bounded(promise) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(Error('Independent reads did not start together')), 1000);
  })]); } finally { clearTimeout(timer); }
}
const source = JSON.parse(readFileSync('docs/operations/2026-public-course-guides.json')).courses;
const model = load('src/lib/course-guide/model.ts');
let failure = false;
const requests = [];
const client = createClient('https://synthetic.invalid', 'synthetic-public-key', {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: async (input, options) => {
    const url = new URL(input); requests.push(url);
    assert.equal(options.method, 'GET');
    if (failure) return Response.json({ message: 'unavailable' }, { status: 503 });
    const fields = url.searchParams.get('select').split(',');
    let rows = source;
    const id = url.searchParams.get('id');
    if (id) rows = rows.filter(row => row.id === id.slice(3));
    return Response.json(rows.map(row => Object.fromEntries(fields.map(key => [key, row[key]]))));
  } },
});
const catalog = load('src/lib/course-guide/data.ts', {
  './model': model,
  '@/lib/portal/data': { getCourseCards: async () => ({ offerings: [], unavailable: false }), getCourseInstructorNames: async () => ({}) },
  '@/lib/supabase/server': { createServerSupabaseClient: async () => client },
});
await test('catalog projects summary fields while preserving publication and sort filters', async () => {
  const result = await catalog.getCourseCatalog();
  const params = requests.findLast(url => url.pathname.endsWith('/life_course_guides')).searchParams;
  assert.equal(params.get('published'), 'eq.true');
  assert.equal(params.get('order'), 'year.desc,sort_order.asc');
  for (const key of ['curriculum', 'schedule_history', 'time_label', 'location']) {
    assert(!params.get('select').split(',').includes(key));
    assert(result.courses.every(row => !(key in row)));
  }
  const old = model.mergeCatalog(source, []);
  const visible = rows => rows.map(({ id, name, academy, summary, mode, capacity,
    period_label, certificate, teaching_hours, href }) => ({ id, name, academy, summary,
    mode, capacity, period_label, certificate, teaching_hours, href }));
  assert.deepEqual(visible(result.courses), visible(old));
  for (const q of ['', '시니어 요리 지도사', '목공', '없는 과정']) {
    const filters = model.catalogFilters({ q });
    assert.deepEqual(visible(model.filterCatalog(result.courses, filters)), visible(model.filterCatalog(old, filters)));
  }
});
await test('detail retains curriculum, location and schedule history', async () => {
  const result = await catalog.getCourseGuide(source[0].id);
  for (const key of ['curriculum', 'schedule_history', 'location'])
    assert.deepEqual(result[key], source[0][key]);
  assert.equal(result.time_label, '월 17:00 - 21:00\n수 17:00 - 21:00\n금 17:00 - 21:00');
});
await test('catalog failure remains unavailable', async () => {
  failure = true;
  try { assert.equal((await catalog.getCourseCatalog()).unavailable, true); }
  finally { failure = false; }
});

const id = '20000000-0000-4000-8000-000000000001';
const context = { course: { id, name: 'Test course', starts_on: '2026-09-23', curriculum: 'Long detail' }, documents: [] };
const notFound = Error('NOT_FOUND');
const login = Error('LOGIN_REQUIRED');
function operation({ authenticated = true, contextError = null, listError = null, list = [context.course], data = context, barrier = false } = {}) {
  const calls = [];
  let authorized = false, release;
  const ready = new Promise(resolve => { release = resolve; });
  const client = createClient('https://synthetic.invalid', 'synthetic-public-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, options) => {
      assert(authorized, 'RPC started before authentication');
      const name = new URL(input).pathname.split('/').at(-1);
      calls.push(name);
      assert.equal(options.method, 'POST');
      if (name === 'life_operation_context') assert.deepEqual(JSON.parse(options.body), { f: id });
      else assert.equal(name, 'life_operation_list');
      if (calls.length === 2) release();
      if (barrier) await ready;
      const error = name === 'life_operation_context' ? contextError : listError;
      return error ? Response.json(error, { status: 403 }) : Response.json(name === 'life_operation_context' ? data : list);
    } },
  });
  const api = load('src/lib/operation-documents/data.ts', {
    'server-only': {},
    'next/navigation': { notFound: () => { throw notFound; } },
    '@/lib/auth/session': { requireIdentity: async () => { if (!authenticated) throw login; authorized = true; } },
    '@/lib/portal/data': { UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i },
    '@/lib/supabase/server': { createServerSupabaseClient: async () => client },
  });
  return { api, calls };
}
await test('editor starts both RPCs together and returns only selector fields', async () => {
  const { api, calls } = operation({ barrier: true });
  const result = await bounded(api.getOperationEditorData(id));
  assert.deepEqual(result.initial, context);
  assert.deepEqual(result.courseOptions, [{ id, name: context.course.name, starts_on: context.course.starts_on }]);
  assert.equal(calls.length, 2);
});
await test('authentication rejection prevents all DB requests', async () => {
  const { api, calls } = operation({ authenticated: false });
  await assert.rejects(api.getOperationEditorData(id), error => error === login);
  assert.equal(calls.length, 0);
});
await test('invalid course ID prevents all DB requests', async () => {
  const { api, calls } = operation();
  await assert.rejects(api.getOperationEditorData('../invalid'), error => error === notFound);
  assert.equal(calls.length, 0);
});
await test('forbidden context never returns the concurrently loaded options', async () => {
  const { api } = operation({ contextError: { message: 'FORBIDDEN' }, barrier: true });
  await assert.rejects(bounded(api.getOperationEditorData(id)), error => error === notFound);
});
await test('context DB error and null data preserve explicit failure', async () => {
  for (const config of [{ contextError: { message: 'DB_FAILED' } }, { data: null }])
    await assert.rejects(operation(config).api.getOperationEditorData(id), /운영 문서를 불러오지 못했습니다/);
});
await test('missing or unavailable list preserves a minimal current-course option', async () => {
  for (const config of [{ list: [] }, { list: null }, { listError: { message: 'DB_FAILED' } }]) {
    const { courseOptions } = await operation(config).api.getOperationEditorData(id);
    assert.deepEqual(courseOptions, [{ id, name: context.course.name, starts_on: context.course.starts_on }]);
  }
});
await test('print loader still reads only the requested context', async () => {
  const { api, calls } = operation();
  assert.deepEqual(await api.getOperationContext(id), context);
  assert.deepEqual(calls, ['life_operation_context']);
});
await test('editor page rejects invalid document kind before loading and preserves editor props', async () => {
  let calls = 0;
  const data = { initial: context, courseOptions: [] };
  const Page = load('src/app/operation-documents/[id]/[kind]/page.tsx', {
    'next/navigation': { notFound: () => { throw notFound; } },
    '@/lib/operation-documents/data': { getOperationEditorData: async value => { assert.equal(value, id); calls++; return data; } },
    '@/components/operation-documents/document-editor': { DocumentEditor: () => null },
  }).default;
  await assert.rejects(Page({ params: Promise.resolve({ id, kind: 'invalid' }) }), error => error === notFound);
  assert.equal(calls, 0);
  for (const kind of ['plan', 'result']) {
    const element = await Page({ params: Promise.resolve({ id, kind }) });
    assert.equal(element.props.kind, kind);
    assert.equal(element.props.initial, data.initial);
    assert.equal(element.props.courseOptions, data.courseOptions);
  }
});
console.log(`${checks} DB latency follow-up checks passed.`);
