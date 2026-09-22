import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createClient } from '@supabase/supabase-js';

const require = createRequire(import.meta.url);
const org = '10000000-0000-4000-8000-000000000001';
const course = '20000000-0000-4000-8000-000000000001';
const person = '30000000-0000-4000-8000-000000000001';
const other = '40000000-0000-4000-8000-000000000001';
const noAccess = Error('NOT_FOUND');
const component = ({ children, title }) => React.createElement('div', null, title, children);
function load(path, replacements = {}) {
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => Object.hasOwn(replacements, name)
    ? replacements[name] : require(name), module, module.exports);
  return module.exports;
}
const common = {
  'next/link': component,
  'next/navigation': { notFound: () => { throw noAccess; } },
  '@/lib/portal/data': { getOffering: async () => ({ id: course, name: 'Test course', org_id: org }), dateTime: () => 'date' },
  '@/app/actions': {},
  '@/components/portal/action-form': { ActionForm: component },
  '@/components/portal/ui': { PageIntro: component, Empty: component },
};
let checks = 0;
async function test(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
const learnerPath = 'src/app/learning/[id]/page.tsx';
const teacherPath = 'src/app/instructor/offerings/[id]/page.tsx';
function classroom(path, { allowed = true, expired = false, failure } = {}) {
  const requests = [];
  const client = createClient('https://synthetic.invalid', 'test-public-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, options) => {
      const url = new URL(input); requests.push(url);
      if (url.pathname.includes('/rpc/')) return Response.json([]);
      assert.equal(options.method, 'GET');
      const table = url.pathname.split('/').at(-1);
      if (table === failure) return Response.json({ code: '42501', message: 'denied' }, { status: 403 });
      if (table === 'life_enrollments') return Response.json(allowed ? [{ id: 'enrollment' }] : []);
      if (table === 'life_offering_instructors') return Response.json(allowed
        ? [{ valid_until: expired ? '2000-01-01' : null }] : []);
      return Response.json([]);
    } },
  });
  const Page = load(path, { ...common,
    '@/lib/auth/session': { requireIdentity: async () => ({ id: person, roles: [] }) },
    '@/lib/supabase/server': { createServerSupabaseClient: async () => client },
  }).default;
  return { requests, run: () => Page({ params: Promise.resolve({ id: course }) }) };
}
for (const [label, path] of [['learner', learnerPath], ['instructor', teacherPath]]) {
  await test(`${label} filters submissions and grades in the database while preserving parallel reads`, async () => {
    const { run, requests } = classroom(path);
    const html = renderToStaticMarkup(await run());
    assert(html.includes('Test course'));
    const byTable = table => requests.find(url => url.pathname.endsWith('/' + table)).searchParams;
    const submissions = byTable('life_submissions');
    assert.equal(submissions.get('select'), '*,life_assignments!inner(offering_id)');
    assert.equal(submissions.get('life_assignments.offering_id'), `eq.${course}`);
    const grades = byTable('life_submission_grades');
    assert.equal(grades.get('select'), '*,life_submissions!inner(life_assignments!inner(offering_id))');
    assert.equal(grades.get('life_submissions.life_assignments.offering_id'), `eq.${course}`);
    assert.equal(requests.length, 6, 'Do not add serial ID lookups');
    if (label === 'learner') {
      assert.equal(submissions.get('person_id'), `eq.${person}`);
      assert.equal(grades.get('life_submissions.person_id'), `eq.${person}`);
      const reads = byTable('life_lesson_reads');
      assert.equal(reads.get('select'), 'lesson_id,life_lessons!inner(offering_id)');
      assert.equal(reads.get('person_id'), `eq.${person}`);
      assert.equal(reads.get('life_lessons.offering_id'), `eq.${course}`);
    } else {
      assert.equal(byTable('life_offering_instructors').get('select'), 'valid_until');
      assert.equal(submissions.get('person_id'), null, 'Instructor must see assigned learners');
    }
  });
  await test(`${label} rejects access before loading coursework`, async () => {
    const { run, requests } = classroom(path, { allowed: false });
    await assert.rejects(run(), error => error === noAccess); assert.equal(requests.length, 1);
  });
  await test(`${label} reports query failure instead of an empty success`, async () => {
    const { run } = classroom(path, { failure: 'life_submission_grades' });
    assert(renderToStaticMarkup(await run()).includes('불러오지 못했습니다'));
  });
}
await test('expired instructor assignment prevents subsequent queries', async () => {
  const { run, requests } = classroom(teacherPath, { expired: true });
  await assert.rejects(run(), error => error === noAccess); assert.equal(requests.length, 1);
});

const { mergeOperationCourses } = load('src/lib/course-budget/model.ts');
async function management({ role = 'COURSE_MANAGER', failure = false } = {}) {
  const started = new Set();
  let release, dashboard;
  const barrier = new Promise(resolve => { release = resolve; });
  const expected = role === 'COURSE_MANAGER' ? 4 : 3;
  async function begin(name, result) {
    started.add(name); if (started.size === expected) release();
    await barrier; return result;
  }
  const courseRow = { id: course, org_id: org, name: 'Own course' };
  const Page = load('src/app/admin/courses/page.tsx', { ...common,
    '@/lib/auth/session': { requireIdentity: async () => ({ roles: [{ role, org_id: org }] }) },
    '@/lib/auth/workspace-navigation': { courseOperationLinks: [] },
    '@/lib/course-workspace/data': { getCourseWorkspaces: () => begin('workspace', { courses: [courseRow, { id: other, org_id: other }], unavailable: failure }) },
    '@/lib/course-budget/data': { getCourseBudgets: (id, rows) => {
      assert.equal(id, org); assert.deepEqual(rows, []);
      return begin('budget', { courses: [{ offering_id: course }, { offering_id: other }], workbooks: [], unavailable: false });
    } },
    '@/lib/course-budget/model': { mergeOperationCourses },
    '@/lib/supabase/server': { createServerSupabaseClient: async () => ({
      rpc: name => { assert.equal(name, 'life_operation_list'); return begin('responsibility', { data: [], error: null }); },
      from: name => { assert.equal(name, 'life_project_years'); return { select: fields => {
        assert.equal(fields, 'id,org_id,label'); return { in: (field, ids) => {
          assert.equal(field, 'org_id'); assert.deepEqual(ids, [org]); return begin('years', { data: [] });
        } };
      } }; },
    }) },
    '@/lib/course-opening/server': { getCourseOpeningPlan: () => { throw Error('Unexpected plan read'); } },
    '@/lib/course-opening/working-copy-server': { getOpeningWorkingCopy: () => { throw Error('Unexpected copy read'); } },
    '@/lib/course-opening/prefill': {},
    '@/components/course-plan/offering-draft-form': { OfferingDraftForm: () => null },
    '@/components/course-workspace/course-list': { CourseList: () => null },
    '@/components/course-workspace/operations-dashboard': { OperationsDashboard: props => { dashboard = props; return null; } },
  }).default;
  let timer;
  try {
    const tree = await Promise.race([Page({ searchParams: Promise.resolve({}) }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Independent queries ran sequentially')), 1000); })]);
    const html = renderToStaticMarkup(tree);
    assert.equal(started.size, expected);
    if (failure) { assert(html.includes('과정 정보를 불러오지 못했습니다')); assert.equal(dashboard, undefined); }
    else {
      assert.equal(dashboard.courses[0].workspace?.id ?? null, role === 'COURSE_MANAGER' ? course : null);
      assert.equal(dashboard.courses[1].workspace, null, 'Do not combine another organization');
      assert.equal(dashboard.manager, role === 'COURSE_MANAGER');
    }
  } finally { clearTimeout(timer); }
}
await test('manager starts independent reads together and joins only its own workspaces', () => management());
await test('system administrator retains budget-only access without loading manager workspaces', () => management({ role: 'SYSTEM_ADMIN' }));
await test('workspace failure retains management error screen', () => management({ failure: true }));
console.log(`${checks} DB response optimization checks passed.`);
