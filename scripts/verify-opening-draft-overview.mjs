import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
function load(path,deps={}) {
  const code=ts.transpileModule(readFileSync(path,'utf8'),{fileName:path,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const module={exports:{}};
  new Function('require','module','exports',code)(name=>Object.hasOwn(deps,name)?deps[name]:require(name),module,module.exports);
  return module.exports;
}
let checks=0;
async function check(name,fn){await fn();checks++;console.log('PASS '+name);}
const plan=JSON.parse(readFileSync('docs/operations/2026-course-opening-plans.json','utf8'));
const oldModel=load('src/lib/course-plan/model.ts');
const model=load('src/lib/course-opening/model.ts',{'@/lib/course-plan/model':oldModel});
const summariesModel=load('src/lib/course-opening/working-copy-overview.ts',{'./working-copy':load('src/lib/course-opening/working-copy.ts')});
const one={source_id:'P01',revision:2,updated_at:'2026-09-20T23:00:00Z'};
const all=plan.courses.map(c=>({...one,source_id:c.sourceId}));
const Link=({children,...props})=>React.createElement('a',props,children);
const {CourseOpeningView}=load('src/components/course-plan/course-opening-view.tsx',{'next/link':Link,'@/lib/course-plan/model':oldModel,'@/lib/course-opening/model':model});
const render=(items=[],params={},unavailable=false)=>renderToStaticMarkup(React.createElement(CourseOpeningView,{plan,filters:model.normalizeOpeningFilters(params),workingCopies:{items,unavailable}}));
const articles=html=>[...html.matchAll(/<article[^>]+id="(P\d+)"/g)].map(m=>m[1]);
await check('saved filter accepts only the exact scalar value and keeps other filters',()=>{
  assert(model.normalizeOpeningFilters({drafts:'saved'}).savedOnly);
  for(const drafts of ['true','SAVED','constructor',['saved'],undefined])assert(!model.normalizeOpeningFilters({drafts}).savedOnly);
  assert.equal(model.normalizeOpeningFilters({q:' 액자 ',drafts:'saved'}).q,'액자');
});
await check('empty and full summaries validate while malformed, duplicate or private fields fail',()=>{
  assert(summariesModel.validOpeningCopySummaries([]));assert(summariesModel.validOpeningCopySummaries(all));
  for(const v of [null,{},[null],[[]],[{...one,payload:{}}],[{...one,source_id:'P17'}],[{...one,revision:0}],[{...one,revision:1.5}],[{...one,updated_at:1}],[{...one,updated_at:'bad'}],[one,one],[...all,one]])assert(!summariesModel.validOpeningCopySummaries(v));
});
await check('empty draft state preserves all 16 plans and provides a clear starting path',()=>{
  const html=render();assert.equal(articles(html).length,16);assert.match(html,/내 임시저장 <span[^>]+>0개/);assert.match(html,/등록 양식에 불러오기/);assert(!html.includes('이어서 준비하기'));
  const filtered=render([],{drafts:'saved'});assert.equal(articles(filtered).length,0);assert.match(filtered,/조건에 맞는 임시저장 과정이 없습니다/);
});
await check('saved cards expose only resume links and a Korean-time timestamp',()=>{
  const html=render([one]);assert.equal(articles(html).length,16);assert.match(html,/내 임시저장 <span[^>]+>1개/);
  assert.match(html,/<time dateTime="2026-09-20T23:00:00Z">2026\. 9\. 21\. 오전 8:00:00<\/time>/);
  const p01=html.slice(html.indexOf('<article'),html.indexOf('<article',html.indexOf('<article')+1));
  assert.match(p01,/이어서 준비하기/);assert.match(p01,/\/admin\/courses\?plan=P01#offering-draft/);
  assert.match(html,/실제 기수 등록·모집 공개 여부와 별도/);
});
await check('saved filtering combines with academy, source search and coverage without changing totals',()=>{
  assert.deepEqual(articles(render(all,{drafts:'saved'})),plan.courses.map(c=>c.sourceId));
  assert.deepEqual(articles(render([one],{drafts:'saved',q:'P01',academy:plan.courses[0].academy})),['P01']);
  assert.deepEqual(articles(render([one],{drafts:'saved',q:'P02'})),[]);
  assert.deepEqual(articles(render(all,{drafts:'saved',coverage:'additional'})),['P03','P07','P15']);
  assert.match(render([one],{drafts:'saved'}),/전체 16개 계획서/);
});
await check('failed summary reads never claim zero drafts or hide source plans behind saved filters',()=>{
  const html=render([],{drafts:'saved',q:'P01'},true);assert.deepEqual(articles(html),['P01']);
  for(const text of ['임시저장 현황을 불러오지 못했습니다','임시저장 필터는 적용하지 않았습니다','저장 여부 확인 불가','등록 양식 확인'])assert(html.includes(text));
  assert(!html.includes('본인이 임시저장한 준비 내용이 없습니다'));assert(!html.includes('>0개</span>'));
  assert.match(html,/q=P01.*drafts=saved#draft-overview/);
});
const org='10000000-0000-4000-8000-000000000001';
let me={roles:[{role:'COURSE_MANAGER',org_id:org}]},calls=[],response={data:[one],error:null},fail=false;
const get=load('src/lib/course-opening/working-copy-overview-server.ts',{
  'server-only':{},'./working-copy-overview':summariesModel,'@/lib/portal/data':{UUID:/^[0-9a-f-]{36}$/i},
  '@/lib/auth/session':{requireIdentity:async()=>{if(!me)throw Error('LOGIN');return me;}},
  '@/lib/supabase/server':{createServerSupabaseClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});if(fail)throw Error('connection');return response;}})},
}).getOpeningWorkingCopyOverview;
await check('loader enforces identity and course-manager scope before one small RPC',async()=>{
  me=null;await assert.rejects(get(),/LOGIN/);
  me={roles:[{role:'SYSTEM_ADMIN',org_id:org}]};assert((await get()).unavailable);assert.equal(calls.length,0);
  me={roles:[{role:'COURSE_MANAGER',org_id:org},{role:'COURSE_MANAGER',org_id:org.replace(/1$/,'3')}]};
  assert.deepEqual(await get(),{items:[one],unavailable:false});assert.deepEqual(calls,[{name:'life_opening_working_copy_summaries',args:{o:org}}]);
});
await check('loader distinguishes no saved work from invalid response or connection failure',async()=>{
  response={data:[],error:null};assert.deepEqual(await get(),{items:[],unavailable:false});
  for(const data of [null,[one,one],[{...one,payload:{}}]]){response={data,error:null};assert((await get()).unavailable);}
  response={data:[],error:{message:'failed'}};assert((await get()).unavailable);
  fail=true;assert((await get()).unavailable);
});
await check('page passes normalized filters and current personal summaries to the actual view',async()=>{
  const Page=load('src/app/admin/course-plan/opening/page.tsx',{
    '@/components/course-plan/course-opening-view':{CourseOpeningView},'@/lib/course-opening/model':model,
    '@/lib/course-opening/server':{getCourseOpeningPlan:async()=>plan},
    '@/lib/course-opening/working-copy-overview-server':{getOpeningWorkingCopyOverview:async()=>({items:[one],unavailable:false})},
  }).default;
  const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({drafts:'saved'})}));assert.deepEqual(articles(html),['P01']);assert.match(html,/이어서 준비하기/);
});
console.log(`${checks} opening-draft overview checks passed.`);
