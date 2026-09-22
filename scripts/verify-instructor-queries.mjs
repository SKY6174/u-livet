import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createClient } from '@supabase/supabase-js';

const require = createRequire(import.meta.url);
const org = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const dossier = '20000000-0000-4000-8000-000000000001';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const plain = value => JSON.parse(JSON.stringify(value));
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
function load(path, replacements) {
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { exports: module.exports, module,
    require: name => Object.hasOwn(replacements, name) ? replacements[name] : require(name) });
  return module.exports;
}
const calls = [];
let failure = '';
const db = createClient('https://synthetic.example', 'synthetic-public-key', {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: async (input, options) => {
    const url = new URL(input); calls.push(url);
    assert.equal(options.method, 'GET');
    if (failure === 'network') throw Error('offline');
    if (failure) return new Response('{"message":"denied"}', { status: 403 });
    return new Response(JSON.stringify([
      { id: org, name: '울산과학대학교 앵커사업단' },
      { id: other, name: '울산과학대학교 산학협력단' },
    ]));
  } },
});
const getOrganizations = load('src/lib/instructors/organizations.ts', {
  '@/lib/supabase/server': { createServerSupabaseClient: async () => db },
  '@/lib/portal/data': { UUID },
}).getManagedInstructorOrganizations;
const roles = [{ role: 'COURSE_MANAGER', org_id: org }, { role: 'COURSE_MANAGER', org_id: other }];
await test('manager query has deduplicated scope and only id/name fields', async () => {
  const result = await getOrganizations({ roles: [...roles, roles[0], { role: 'INSTRUCTOR', org_id: dossier }] });
  assert.equal(result.unavailable, false);
  assert.deepEqual(plain(result.organizations.map(o => o.id)), [other, org]);
  const url = calls.at(-1);
  assert.equal(url.pathname, '/rest/v1/life_organizations');
  assert.equal(url.searchParams.get('select'), 'id,name');
  assert.equal(url.searchParams.get('id'), `in.(${org},${other})`);
});
await test('no management role or invalid ID never requests all organizations', async () => {
  const before = calls.length;
  for (const role of ['SYSTEM_ADMIN', 'INSTRUCTOR', '']) {
    const result = await getOrganizations({ roles: role ? [{ role, org_id: org }] : [] });
    assert.equal(result.organizations.length, 0); assert.equal(result.unavailable, false);
  }
  assert.equal((await getOrganizations({ roles: [{ role: 'COURSE_MANAGER', org_id: 'invalid' }] })).unavailable, true);
  assert.equal(calls.length, before);
});
await test('DB and network errors remain unavailable', async () => {
  for (failure of ['denied', 'network']) {
    const result = await getOrganizations({ roles });
    assert.equal(result.unavailable, true); assert.equal(result.organizations.length, 0);
  }
  failure = '';
});

function page(path, rpc, organizations = [{ id: org, name: '기관' }], unavailable = false) {
  return load(path, {
    'next/link': { default: 'a' },
    'next/navigation': { notFound: () => { throw Error('NOT_FOUND'); } },
    '@/lib/auth/session': { requireIdentity: async () => ({ roles }) },
    '@/lib/supabase/server': { createServerSupabaseClient: async () => ({ rpc }) },
    '@/lib/portal/data': { UUID },
    '@/lib/instructors/organizations': { getManagedInstructorOrganizations: async () => ({ organizations, unavailable }) },
    '@/lib/instructors/types': { reviewLabels: {} },
    '@/lib/instructors/pool': { pageNumber: n => Number(n) || 1 },
    '@/components/instructors/pool-dashboard': { PoolDashboard: () => null },
    '@/components/portal/ui': { Empty: ({ title }) => createElement('p', null, title), PageIntro: () => null },
    '@/components/portal/instructor-detail': { DossierDetail: () => null },
    '@/components/instructor-documents/document-portal': { DocumentPortal: () => null },
    '@/components/instructor-documents/document-popup': { DocumentPopup: () => null },
  }).default;
}
const poolPage = 'src/app/admin/instructors/page.tsx';
const docsPage = 'src/app/admin/instructors/documents/page.tsx';
await test('pool tabs skip options RPC and reject unassigned URL scope', async () => {
  for (const tab of ['master', 'history', 'payments', 'review']) {
    const rpc = [];
    const tree = await page(poolPage, async (name, args) => {
      rpc.push(name); assert.equal(args.o, org); return { data: {}, error: null };
    })({ searchParams: Promise.resolve({ tab, org: other }) });
    assert.equal(tree.props.org, org);
    assert.deepEqual(rpc, ['life_instructor_pool_board']);
  }
});
await test('review detail fetches policies in parallel with the board', async () => {
  let started = 0, release;
  const barrier = new Promise(resolve => { release = resolve; });
  const policies = [{ id: 'policy', body: 'approved policy' }];
  const run = page(poolPage, async name => {
    assert.ok(['life_instructor_pool_board', 'life_instructor_options'].includes(name));
    if (++started === 2) release(); await barrier;
    return { data: name === 'life_instructor_options' ? { policies } : {}, error: null };
  });
  let timer;
  try {
    const tree = await Promise.race([run({ searchParams: Promise.resolve({ d: dossier }) }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error('sequential queries')), 1000); })]);
    assert.equal(started, 2); assert.deepEqual(tree.props.review.props.policies, policies);
  } finally { clearTimeout(timer); }
});
await test('failed policies do not render an empty approval form', async () => {
  const tree = await page(poolPage, async name => name === 'life_instructor_options'
    ? { data: null, error: Error('DB') } : { data: {}, error: null })({ searchParams: Promise.resolve({ d: dossier }) });
  assert.match(renderToStaticMarkup(tree), /심사 기준을 불러오지 못했습니다/);
});
await test('empty or failed organization lookup skips sensitive RPCs', async () => {
  for (const path of [poolPage, docsPage]) {
    const tree = await page(path, () => { throw Error('unexpected RPC'); }, [], true)({ searchParams: Promise.resolve({}) });
    assert.match(renderToStaticMarkup(tree), /담당 기관/);
  }
});
await test('document directory queries only the selected managed institution', async () => {
  const rpc = [];
  const tree = await page(docsPage, async (name, args) => {
    rpc.push(name); assert.equal(args.p_org, org); return { data: { items: [] }, error: null };
  })({ searchParams: Promise.resolve({ org: other }) });
  assert.match(renderToStaticMarkup(tree), /등록된 강사가 없습니다/);
  assert.deepEqual(rpc, ['life_instructor_document_directory']);
});
console.log(`${passed} instructor query checks passed.`);
