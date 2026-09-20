import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(path, dependencies = {}) {
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { fileName: path, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require','module','exports',code)(name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), module, module.exports);
  return module.exports;
}
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log('PASS ' + name); }
const model = load('src/lib/course-opening/working-copy.ts');
const blank = Object.fromEntries(Object.keys(model.OPENING_FIELDS).map(k => [k, '']));
const org = '10000000-0000-4000-8000-000000000001';
const role = { role: 'COURSE_MANAGER', org_id: org };
const identity = { roles: [role] };
const UUID = /^[0-9a-f-]{36}$/i;
let me = identity, calls = [], result = { data: { revision: 1, updated_at: '2026-09-21T00:00:00Z' }, error: null }, networkError = false;
const dependencies = {
  'server-only': {}, '@/lib/course-opening/working-copy': model, './working-copy': model,
  '@/lib/auth/mfa-message': { MFA_REAUTH_MESSAGE: 'MFA required' }, '@/lib/portal/data': { UUID },
  '@/lib/auth/session': { getSessionIdentity: async () => me, requireIdentity: async () => { if (!me) throw Error('LOGIN'); return me; } },
  '@/lib/supabase/server': { createServerSupabaseClient: async () => ({ rpc: async (name,args) => { calls.push({name,args}); if(networkError) throw Error('network'); return result; } }) },
};
const { saveOpeningWorkingCopy: save } = load('src/app/opening-working-copy-actions.ts', dependencies);
const { getOpeningWorkingCopy: get } = load('src/lib/course-opening/working-copy-server.ts', dependencies);
function form(values = {}) { const f = new FormData(); for(const [k,v] of Object.entries({ ...blank, org, source:'P01', revision:'0', ...values })) f.set(k,v); return f; }
await check('optional blanks and real leap dates are valid, malformed payloads never are', () => {
  assert(model.validOpeningValues(blank));
  assert(model.validOpeningValues({ ...blank, starts_on:'2028-02-29', apply_from:'2026-09-21T13:09' }));
  for (const bad of [null,[],{}, { ...blank, extra:'' },{ ...blank, title:null },{ ...blank, title:'x'.repeat(201) },{ ...blank, capacity:'1.5' },{ ...blank, capacity:'0' },{ ...blank, capacity:'1001' },{ ...blank, year:'abc' },{ ...blank, starts_on:'2026-02-29' },{ ...blank, starts_on:'0099-01-01' },{ ...blank, apply_from:'2026-09-21T24:00' },{ ...blank, mode:'remote' }]) assert(!model.validOpeningValues(bad));
});
await check('identity and same-organization role are checked before any DB write', async () => {
  for (me of [null, { roles:[] }, { roles:[{ ...role, role:'SYSTEM_ADMIN' }] }, { roles:[{ ...role, org_id:org.replace(/1$/,'3') }] }]) assert(!(await save({},form())).ok);
  assert.equal(calls.length,0); me=identity;
});
await check('the action rejects invalid plan/revision/value formats without querying', async () => {
  for(const patch of [{ source:'P17' },{ revision:'' },{ revision:'-1' },{ revision:'1.2' },{ revision:'2147483647' },{ starts_on:'2026-02-30' }]) assert(!(await save({},form(patch))).ok);
  assert.equal(calls.length,0);
});
await check('one whitelisted save RPC carries blank values and no supplied person identity', async () => {
  const r=await save({},form({ person_id:'spoofed', title:'편집 내용' })); assert.equal(r.revision,1); assert(r.ok);
  assert.equal(calls.length,1); assert.equal(calls[0].name,'life_save_opening_working_copy');
  assert.deepEqual(calls[0].args,{ o:org,source:'P01',payload:{...blank,title:'편집 내용'},expected_revision:0 });
});
await check('MFA, conflict and connection failures have actionable messages', async () => {
  result={error:{message:'MFA_REAUTH_REQUIRED'}}; assert.equal((await save({},form())).message,'MFA required');
  result={error:{message:'REVISION_CHANGED'}}; assert.match((await save({},form())).message,/다른 창/);
  networkError=true; assert.match((await save({},form())).message,/입력 내용은 유지/); networkError=false;
});
await check('loader distinguishes an empty DB from failed or malformed reads', async () => {
  result={data:null,error:null}; assert.deepEqual(await get(org,'P01'),{copy:null,unavailable:false});
  for(const data of [{payload:blank,revision:0,updated_at:'2026-09-21'}, {payload:{},revision:1,updated_at:'2026-09-21'}, {payload:blank,revision:1,updated_at:'bad'}]) {result={data,error:null};assert((await get(org,'P01')).unavailable);}
  result={data:null,error:{message:'connection'}}; assert((await get(org,'P01')).unavailable);
  networkError=true; assert((await get(org,'P01')).unavailable); networkError=false;
  const before=calls.length; await get(org,'P17'); await get('bad','P01'); assert.equal(calls.length,before);
});
const plan=JSON.parse(readFileSync('docs/operations/2026-course-opening-plans.json','utf8'));
const prefill=load('src/lib/course-opening/prefill.ts');
const Link=({children,...props})=>React.createElement('a',props,children);
const formDeps={
  'next/link':Link,'@/app/actions':{createOffering:()=>{}},'@/lib/course-opening/prefill':prefill,
  '@/lib/course-plan/model':load('src/lib/course-plan/model.ts'),
  '@/components/portal/action-form':{ActionForm:({children})=>React.createElement('form',{},children)},
  './working-copy-form':{WorkingCopyForm:({children})=>React.createElement('form',{},children)},
};
const {OfferingDraftForm}=load('src/components/course-plan/offering-draft-form.tsx',formDeps);
await check('restored blank edits remain blank instead of reverting to the plan',()=>{
  const html=renderToStaticMarkup(React.createElement(OfferingDraftForm,{orgId:org,years:[{id:org,label:'연도'}],plan:plan.courses[0],copy:{payload:{...blank,year:org,apply_from:'2026-09-25T09:00'},revision:2,updated_at:'2026-09-21'}}));
  assert.match(html,/<input[^>]*name="title"[^>]*value=""/);
  assert.match(html,/<input[^>]*name="capacity"[^>]*value=""/);
  assert.match(html,/<input[^>]*name="apply_from"[^>]*value="2026-09-25T09:00"/);
  assert.match(html,/본인이 임시저장한/);
});
await check('failed working-copy load hides the editor instead of offering a blank overwrite',async()=>{
  const Page=load('src/app/admin/courses/page.tsx',{
    'next/link':Link,'next/navigation':{notFound:()=>{throw Error('404');}},
    '@/lib/auth/workspace-navigation':{courseOperationLinks:[]},'@/lib/auth/session':dependencies['@/lib/auth/session'],
    '@/lib/course-opening/prefill':prefill,'@/lib/course-opening/server':{getCourseOpeningPlan:async()=>plan},
    '@/lib/course-opening/working-copy-server':{getOpeningWorkingCopy:async()=>({copy:null,unavailable:true})},
    '@/lib/course-workspace/data':{getCourseWorkspaces:async()=>({courses:[],unavailable:false})},
    '@/components/course-workspace/course-list':{CourseList:()=>null},
    '@/components/course-plan/offering-draft-form':{OfferingDraftForm},
    '@/lib/supabase/server':{createServerSupabaseClient:async()=>({from:()=>({select:()=>({in:async()=>({data:[]})})})})},
    '@/components/portal/ui':{PageIntro:()=>null,Empty:()=>null},
  }).default;
  const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({plan:'P01'})}));
  assert.match(html,/임시저장본을 불러오지 못했습니다/); assert(!html.includes('<form'));
});
console.log(`${checks} working-copy application checks passed.`);
