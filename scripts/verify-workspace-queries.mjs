import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const denied = new Error('NOT_FOUND');
const org = '10000000-0000-4000-8000-000000000001';
const otherOrg = '10000000-0000-4000-8000-000000000002';
const course = '20000000-0000-4000-8000-000000000001';
let passed = 0;
const plain = value => JSON.parse(JSON.stringify(value));
async function test(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
function page(path, { roles = [], db = {}, workspace = async () => ({ offerings: [], unavailable: false }) } = {}) {
  const replacements = {
    'next/link': { default: 'a' },
    'next/navigation': { notFound: () => { throw denied; } },
    '@/lib/auth/session': { requireIdentity: async () => ({ id: 'tester', name: 'TEST', roles }) },
    '@/lib/auth/workspace-navigation': { hasRole: (identity, ...accepted) => identity.roles.some(role => accepted.includes(role.role)) },
    '@/lib/completion/offerings': { mergeCompletionOfferings: offerings => offerings.map(offering => ({ id: offering.id, registered: true, sourceId: null, name: offering.name, academy: '', capacity: offering.capacity ?? null, yearLabel: offering.year_label ?? '', startsOn: offering.starts_on ?? '', endsOn: offering.ends_on ?? '', status: offering.status ?? null })) },
    '@/lib/supabase/server': { createServerSupabaseClient: async () => db },
    '@/lib/operation-documents/prefilled-data': { PREFILLED_COURSES: [], findPrefilledCourse: () => undefined },
    '@/lib/portal/data': { getWorkspaceOfferings: workspace, dateTime: () => 'date', statusLabel: {} },
    '@/components/portal/ui': {
      PageIntro: ({ title, children }) => createElement('section', null, title, children),
      Empty: ({ title }) => createElement('p', null, title),
    },
    '@/components/portal/action-form': { ActionForm: ({ children }) => createElement('form', null, children) },
    '@/app/certificate-actions': {},
    '@/components/teaching/teaching-segments-input': { TeachingSegmentsInput: () => null },
    '@/components/teaching/teaching-signature-form': { TeachingSignatureForm: () => null },
    '@/lib/certificates/types': { kindLabel: {}, certificateState: {} },
  };
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { exports: module.exports, module,
    require: name => Object.hasOwn(replacements, name) ? replacements[name] : require(name), Date });
  return module.exports.default;
}
const instructorRoles = [{ role: 'INSTRUCTOR', org_id: org }];
const managerRoles = [{ role: 'COURSE_MANAGER', org_id: org }];
const recordsPath = 'src/app/instructor/records/page.tsx';
const completionPath = 'src/app/completion/page.tsx';
const credentialsPath = 'src/app/credentials/page.tsx';
const assignmentQuery = result => ({ select() { return this; }, eq() { return Promise.resolve(result); } });
const certificatesDb = logs => ({ rpc: async name => ({ error: null,
  data: name === 'life_certificate_options' ? { issuers: [], templates: [] } : name === 'life_teaching_records' ? logs : [] }) });

await test('staff pages deny learners before any DB call', async () => {
  for (const path of [recordsPath, completionPath, credentialsPath])
    await assert.rejects(page(path)(), error => error === denied);
});
await test('completion queries only authorized organizations and renders its courses', async () => {
  const run = page(completionPath, { roles: [...managerRoles, { role: 'CERTIFIER', org_id: otherOrg }],
    workspace: async (column, ids) => {
      assert.equal(column, 'org_id'); assert.deepEqual(plain(ids), [org, otherOrg]);
      return { offerings: [{ id: course, name: 'Visible course', year_label: '2026' }], unavailable: false };
    } });
  const html = renderToStaticMarkup(await run());
  assert(html.includes('Visible course')); assert(html.includes(`/completion/${course}`));
});
await test('instructor with no assignments requests no sessions or unscoped courses', async () => {
  const run = page(recordsPath, { roles: instructorRoles,
    db: { rpc: async () => ({ data: [], error: null }), from: table => {
      assert.equal(table, 'life_offering_instructors'); return assignmentQuery({ data: [], error: null });
    } }, workspace: async (column, ids) => {
      assert.equal(column, 'id'); assert.deepEqual(plain(ids), []); return { offerings: [], unavailable: false };
    } });
  assert(renderToStaticMarkup(await run()).includes('기록할 완료 수업이 없습니다'));
});
await test('assignment failure prevents dependent queries and preserves the error screen', async () => {
  const run = page(recordsPath, { roles: instructorRoles,
    db: { rpc: async () => ({ data: [], error: null }), from: table => {
      assert.equal(table, 'life_offering_instructors'); return assignmentQuery({ data: null, error: new Error('DB') });
    } }, workspace: async () => { throw Error('Unexpected course query'); } });
  assert(renderToStaticMarkup(await run()).includes('강의실적을 불러오지 못했습니다'));
});
await test('valid assignment scopes courses and independent session reads start together', async () => {
  let started = 0, release;
  const barrier = new Promise(resolve => { release = resolve; });
  const begin = async () => { if (++started === 2) release(); await barrier; };
  const run = page(recordsPath, { roles: instructorRoles,
    db: { rpc: async () => ({ data: [], error: null }), from: table => {
      if (table === 'life_offering_instructors') return assignmentQuery({ error: null, data: [
        { offering_id: course, valid_until: null }, { offering_id: 'expired', valid_until: '2000-01-01' },
      ] });
      assert.equal(table, 'life_class_sessions');
      return { select() { return this; }, in(column, ids) { assert.equal(column, 'offering_id'); assert.deepEqual(plain(ids), [course]); return this; },
        eq() { return this; }, lte() { return this; }, async order() { await begin(); return { data: [], error: null }; } };
    } }, workspace: async (column, ids) => {
      assert.equal(column, 'id'); assert.deepEqual(plain(ids), [course]); await begin();
      return { offerings: [], unavailable: true };
    } });
  let timer;
  try {
    const tree = await Promise.race([run(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Sequential query deadlock')), 1000); })]);
    assert.equal(started, 2); assert(renderToStaticMarkup(tree).includes('강의실적을 불러오지 못했습니다'));
  } finally { clearTimeout(timer); }
});
await test('certifier-only workspace has no course-manager scope', async () => {
  const run = page(credentialsPath, { roles: [{ role: 'CERTIFIER', org_id: org }], db: certificatesDb([]),
    workspace: async (column, ids) => { assert.equal(column, 'org_id'); assert.deepEqual(plain(ids), []); return { offerings: [], unavailable: false }; } });
  assert(renderToStaticMarkup(await run()).includes('증명 관리'));
});
await test('manager sees teaching records only for managed course organizations', async () => {
  const logs = [
    { id: 'own', offering_id: course, person_name: 'Own teacher', course_name: 'Own course', minutes: 60, current: true },
    { id: 'other', offering_id: 'unrelated', person_name: 'Other teacher', course_name: 'Other course', minutes: 60, current: true },
  ];
  const run = page(credentialsPath, { roles: managerRoles, db: certificatesDb(logs), workspace: async (column, ids) => {
    assert.equal(column, 'org_id'); assert.deepEqual(plain(ids), [org]);
    return { offerings: [{ id: course, org_id: org }], unavailable: false };
  } });
  const html = renderToStaticMarkup(await run()); assert(html.includes('Own teacher')); assert(!html.includes('Other teacher'));
});
await test('certificate course failure remains an error', async () => {
  const run = page(credentialsPath, { roles: managerRoles, db: certificatesDb([]),
    workspace: async () => ({ offerings: [], unavailable: true }) });
  assert(renderToStaticMarkup(await run()).includes('증명 관리 정보를 불러오지 못했습니다'));
});
console.log(`${passed} workspace query behavior checks passed.`);
