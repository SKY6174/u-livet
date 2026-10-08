import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import { renderToStaticMarkup } from 'react-dom/server';

// Exercise the installed Supabase query builder without touching a remote DB.
const require = createRequire(import.meta.url);
function load(file, replacements) {
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { exports: module.exports, module,
    require: name => Object.hasOwn(replacements, name) ? replacements[name] : require(name), Date });
  return module.exports;
}
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
const requests = [];
let fail = false;
let privacyRows = [];
let extraRows = [];
const fixtures = ['DRAFT', 'CLOSED', 'PUBLISHED', 'PUBLISHED', 'PUBLISHED', 'PUBLISHED'].map((status, i) => ({
  id: `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`, status,
  org_id: `20000000-0000-4000-8000-${String(i % 2).padStart(12, '0')}`,
  name: `과정 ${i}`, academy: '교육원', summary: '요약', curriculum: '긴 교육내용'.repeat(2000),
  mode: 'ONLINE', capacity: 10, tuition: 0, apply_from: '2026-01-01', apply_until: '2027-01-01',
  starts_on: '2026-10-01', ends_on: '2026-10-31', created_at: `2026-09-${20 - i}`,
}));
const client = createClient('https://synthetic.example', 'synthetic-public-key', {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: async (input, options) => {
    const url = new URL(input); requests.push(url);
    assert.equal(options.method, 'GET');
    if (fail) return new Response(JSON.stringify({ code: '42501', message: 'denied' }), { status: 403 });
    if (url.pathname.endsWith('/life_policy_versions')) {
      const p = url.searchParams;
      if (p.get('limit') !== '1') return new Response('[]', { status: 200 });
      assert.equal(p.get('kind'), 'eq.ACCOUNT_PRIVACY');
      assert.equal(p.get('status'), 'eq.APPROVED');
      assert.equal(p.get('order'), 'effective_from.desc,approved_at.desc,id.asc');
      assert(p.get('effective_from').startsWith('lte.'));
      const now = p.get('effective_from').slice(4);
      assert.equal(p.get('or'), `(effective_until.is.null,effective_until.gt.${now})`);
      const rows = privacyRows.filter(row => row.kind === 'ACCOUNT_PRIVACY' && row.status === 'APPROVED' &&
        row.effective_from <= now && (!row.effective_until || row.effective_until > now))
        .sort((a, b) => b.effective_from.localeCompare(a.effective_from) ||
          b.approved_at.localeCompare(a.approved_at) || a.id.localeCompare(b.id));
      return new Response(JSON.stringify(rows.slice(0, 1)), { status: 200 });
    }
    let rows = [...fixtures, ...extraRows];
    if (url.pathname.endsWith('/rpc/life_course_introductions')) {
      rows = rows.filter(r => ['PUBLISHED', 'CLOSED'].includes(r.status) ||
        (r.status === 'ARCHIVED' && r.public_introduction));
      const id = url.searchParams.get('f');
      if (id) rows = rows.filter(r => r.id === id);
    }
    for (const column of ['id', 'org_id']) {
      const scope = url.searchParams.get(column);
      if (scope) rows = rows.filter(row => scope.slice(4, -1).split(',').includes(row[column]));
    }
    const filter = url.searchParams.get('status');
    if (filter === 'eq.PUBLISHED') rows = rows.filter(r => r.status === 'PUBLISHED');
    if (filter === 'neq.DRAFT') rows = rows.filter(r => r.status !== 'DRAFT');
    const limit = url.searchParams.get('limit');
    if (limit) rows = rows.slice(0, Number(limit));
    const columns = url.searchParams.get('select');
    if (columns && columns !== '*') rows = rows.map(row => Object.fromEntries(columns.split(',').map(k => [k, row[k]])));
    return new Response(JSON.stringify(rows), { status: 200 });
  } },
});
const data = load('src/lib/portal/data.ts', {
  '@/lib/supabase/server': { createServerSupabaseClient: async () => client },
});

await test('home fetch returns newest three published courses without long curriculum', async () => {
  const result = await data.getCourseCards(true);
  assert.equal(result.unavailable, false);
  assert.deepEqual(result.offerings.map(r => r.id), fixtures.slice(2, 5).map(r => r.id));
  assert(result.offerings.every(r => r.status === 'PUBLISHED' && !('curriculum' in r)));
  assert.equal(requests.at(-1).searchParams.get('order'), 'created_at.desc,id.asc');
  assert.equal(requests.at(-1).searchParams.get('limit'), '3');
  assert(JSON.stringify(result.offerings).length < JSON.stringify(fixtures.slice(2, 5)).length / 10);
});
await test('public catalog includes closed courses but excludes drafts at the DB request', async () => {
  const result = await data.getCourseCards();
  assert.equal(result.offerings.length, 5);
  assert.equal(requests.at(-1).pathname, '/rest/v1/rpc/life_course_introductions');
  assert(requests.at(-1).searchParams.get('select').split(',').includes('created_at'));
  assert.equal(requests.at(-1).searchParams.get('status'), 'neq.DRAFT');
  assert(result.offerings.some(r => r.status === 'CLOSED'));
});
await test('public archive cards and direct detail load without private catalog access', async () => {
  const archive = { ...fixtures[0], id: '30000000-0000-4000-8000-000000000001',
    status: 'ARCHIVED', public_introduction: true, apply_from: null, apply_until: null, tuition: null };
  const hidden = { ...archive, id: '30000000-0000-4000-8000-000000000002', public_introduction: false };
  const draft = { ...archive, id: '30000000-0000-4000-8000-000000000003', status: 'DRAFT' };
  extraRows = [archive, hidden, draft];
  try {
    const result = await data.getCourseCards();
    assert(result.offerings.some(r => r.id === archive.id));
    assert(!result.offerings.some(r => [hidden.id, draft.id].includes(r.id)));
    assert.equal((await data.getCourseIntroduction(archive.id)).id, archive.id);
    assert.equal(await data.getCourseIntroduction(hidden.id), null);
    assert.equal(await data.getCourseIntroduction(draft.id), null);
    const before = requests.length;
    assert.equal(await data.getCourseIntroduction('invalid'), null);
    assert.equal(requests.length, before);
    fail = true;
    assert.equal(await data.getCourseIntroduction(archive.id), null);
  } finally { extraRows = []; fail = false; }
});
await test('staff catalog retains the full record contract', async () => {
  const result = await data.getOfferings();
  assert.equal(result.offerings.length, 6);
  assert('curriculum' in result.offerings[0]);
});
await test('workspace lookup limits courses to assigned IDs without curriculum', async () => {
  const result = await data.getWorkspaceOfferings('id', [fixtures[1].id, fixtures[1].id, fixtures[3].id]);
  assert.deepEqual(result.offerings.map(r => r.id), [fixtures[1].id, fixtures[3].id]);
  assert.equal(result.unavailable, false);
  assert(result.offerings.every(r => !('curriculum' in r)));
  assert(result.offerings.every(r => r.org_id === fixtures[1].org_id));
  assert.equal(requests.at(-1).searchParams.get('id'), `in.(${fixtures[1].id},${fixtures[3].id})`);
  assert.equal(requests.at(-1).searchParams.get('order'), 'created_at.desc,id.asc');
});
await test('manager workspace includes drafts only in managed organizations', async () => {
  const result = await data.getWorkspaceOfferings('org_id', [fixtures[0].org_id]);
  assert.deepEqual(result.offerings.map(r => r.id), [fixtures[0].id, fixtures[2].id, fixtures[4].id]);
  assert.equal(result.offerings[0].status, 'DRAFT');
});
await test('empty and invalid workspace scope never fetch the full catalog', async () => {
  const before = requests.length;
  assert.equal((await data.getWorkspaceOfferings('id', [])).unavailable, false);
  assert.equal((await data.getWorkspaceOfferings('org_id', ['invalid'])).unavailable, true);
  assert.equal((await data.getWorkspaceOfferings('id', [fixtures[0].id, 'invalid'])).unavailable, true);
  assert.equal(requests.length, before);
});
await test('workspace DB failure remains an error instead of an empty assignment list', async () => {
  fail = true;
  const result = await data.getWorkspaceOfferings('id', [fixtures[0].id]);
  assert.equal(result.unavailable, true); assert.equal(result.offerings.length, 0);
  fail = false;
});
await test('failed catalog reads remain unavailable instead of successful empty results', async () => {
  fail = true;
  const result = await data.getCourseCards(true);
  assert.equal(result.unavailable, true); assert.equal(result.offerings.length, 0);
  fail = false;
});
await test('detail policy lookup is limited to its approved policy and kind', async () => {
  const id = fixtures[0].id;
  await data.getPolicies('ENROLLMENT', id);
  const p = requests.at(-1).searchParams;
  assert.equal(p.get('id'), `eq.${id}`); assert.equal(p.get('kind'), 'eq.ENROLLMENT');
  assert.equal(p.get('status'), 'eq.APPROVED');
});
await test('missing or invalid linked policy performs no database request', async () => {
  const before = requests.length;
  for (const id of [null, '', 'invalid']) assert.equal((await data.getPolicies(undefined, id)).length, 0);
  assert.equal(requests.length, before);
});
await test('privacy selects one current approved notice without hardcoded version names', async () => {
  const date = offset => new Date(Date.now() + offset * 86400000).toISOString();
  const current = { id: 'a', kind: 'ACCOUNT_PRIVACY', status: 'APPROVED', version: 'FUTURE-RELEASE-v12',
    title: '개인정보처리 안내', body: '현재 승인 원문', effective_from: date(-2), effective_until: null, approved_at: date(-3) };
  privacyRows = [
    { ...current, id: 'draft', status: 'DRAFT', effective_from: date(-1) },
    { ...current, id: 'future', effective_from: date(1) },
    { ...current, id: 'expired', effective_from: date(-1), effective_until: date(-0.5) },
    { ...current, id: 'other', kind: 'INSTRUCTOR_PRIVACY', effective_from: date(-1) },
    { ...current, id: 'old', version: 'OLD', effective_from: date(-5) },
    { ...current, id: 'earlier-approval', approved_at: date(-4) },
    { ...current, id: 'b' }, current,
  ];
  assert.equal((await data.getLatestPrivacyPolicy()).id, current.id);
  const Privacy = load('src/app/privacy/page.tsx', {
    '@/lib/portal/data': data,
    '@/components/portal/ui': { PageIntro: () => null, Empty: () => '준비 중' },
    '@/components/common/support-contact': { SupportContact: () => null },
  });
  assert.equal(Privacy.dynamic, 'force-dynamic');
  const html = renderToStaticMarkup(await Privacy.default());
  assert.equal((html.match(/<article\b/g) ?? []).length, 1);
  assert(html.includes(current.version));
  assert(!html.includes('OLD'));
  privacyRows = [];
  assert.equal(await data.getLatestPrivacyPolicy(), null);
  assert(renderToStaticMarkup(await Privacy.default()).includes('준비 중'));
  fail = true;
  try { assert.equal(await data.getLatestPrivacyPolicy(), null); } finally { fail = false; }
});
await test('unconfigured DB produces the existing failure state', async () => {
  const broken = load('src/lib/portal/data.ts', {
    '@/lib/supabase/server': { createServerSupabaseClient: async () => { throw new Error('NOT_CONFIGURED'); } },
  });
  assert.equal((await broken.getCourseCards()).unavailable, true);
  assert.equal(await broken.getLatestPrivacyPolicy(), null);
});

// Barrier: sequential awaits deadlock this test; all independent reads must start.
for (const apply of [false, true]) {
  await test(`${apply ? 'application' : 'detail'} independent reads start concurrently`, async () => {
    const expected = apply ? 2 : 5;
    let started = 0;
    let release;
    const barrier = new Promise(resolve => { release = resolve; });
    const wait = async result => { started++; if (started === expected) release(); await barrier; return result; };
    const component = load(`src/app/offerings/[id]/${apply ? 'apply/' : ''}page.tsx`, {
      'next/link': () => null,
      'next/navigation': { notFound: () => { throw new Error('Unexpected 404'); } },
      '@/lib/auth/session': { requireIdentity: async () => ({ id: 'synthetic' }) },
      '@/lib/portal/data': { ...data, getOffering: async () => fixtures[2], getCourseIntroduction: async () => fixtures[2], getPolicies: () => wait([]), getCourseInstructorNames: () => wait({}) },
      '@/lib/supabase/server': { createServerSupabaseClient: async () => ({ rpc: () => wait({ data: null }), from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => wait({ data: null }) }) }) }) }) },
      '@/components/portal/ui': { PageIntro: () => null },
      '@/components/portal/scholarship-notice': { ScholarshipNotice: () => null },
      '@/components/instructor-documents/document-popup': { DocumentPopup: () => null },
      '@/lib/learner-documents/model': { applicationDocumentHref: () => '/' },
      '@/lib/course-workspace/curriculum': { parseCourseCurriculum: () => [] },
      '@/components/portal/instructor-names': { InstructorNames: () => null },
      '@/components/portal/action-form': { ActionForm: () => null },
      '@/app/actions': { applyForCourse: async () => ({}) },
    }).default;
    let timer;
    try {
      await Promise.race([component({ params: Promise.resolve({ id: fixtures[2].id }) }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Sequential database waterfall')), 1000); })]);
      assert.equal(started, expected);
    } finally { clearTimeout(timer); }
  });
}
await test('archived card and detail show completed status without application or private RPCs', async () => {
  const archive = { ...fixtures[0], status: 'ARCHIVED', apply_from: null, apply_until: null,
    tuition: null, completion_policy_id: null };
  const React = require('react');
  const Link = ({ children, ...props }) => React.createElement('a', props, children);
  const ui = load('src/components/portal/ui.tsx', {
    'next/link': { default: Link }, '@/lib/portal/data': data,
  });
  const card = renderToStaticMarkup(React.createElement(ui.CourseCard, { offering: archive }));
  assert(card.includes('운영 완료') && !card.includes('접수 중'));
  const Detail = load('src/app/offerings/[id]/page.tsx', {
    'next/link': { default: Link },
    'next/navigation': { notFound: () => { throw new Error('Unexpected 404'); } },
    '@/lib/portal/data': { ...data, getCourseIntroduction: async () => archive, getPolicies: async () => [], getCourseInstructorNames: async () => ({}) },
    '@/lib/supabase/server': { createServerSupabaseClient: async () => ({ rpc: () => { throw new Error('Archive queried private auxiliary data'); }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) },
    '@/components/portal/ui': ui,
    '@/components/portal/scholarship-notice': { ScholarshipNotice: () => null },
    '@/components/instructor-documents/document-popup': { DocumentPopup: () => null },
    '@/lib/learner-documents/model': { applicationDocumentHref: () => '/' },
    '@/lib/course-workspace/curriculum': { parseCourseCurriculum: () => [] },
    '@/components/portal/instructor-names': { InstructorNames: () => null },
  }).default;
  const html = renderToStaticMarkup(await Detail({ params: Promise.resolve({ id: archive.id }) }));
  assert(html.includes('운영이 완료된 과정입니다.'));
  assert(!html.includes('/apply') && !html.includes('/reports'));
});
console.log(`${passed} DB performance regression checks passed.`);
