import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const load = (file, mocks = {}) => {
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), module, module.exports);
  return module.exports;
};
let checks=0;
const test=async(name,run)=>{await run();checks++;console.log('PASS '+name);};
const guides=JSON.parse(readFileSync('docs/operations/2026-public-course-guides.json')).courses;
const model=load('src/lib/course-guide/model.ts');
const instructorNames=load('src/components/portal/instructor-names.tsx');
const offerings=guides.filter(c=>c.offering_id).map(c=>({...c,id:c.offering_id,status:'ARCHIVED',starts_on:'2026-07-01',ends_on:'2026-07-31'}));
const courses=model.mergeCatalog(guides,offerings);
const now=Date.parse('2026-10-07T12:00:00+09:00');
const visible=model.filterCatalog(courses,model.catalogFilters({}),now);
await test('16 source courses deduplicate the three linked operational offerings',()=>assert.equal(courses.length,16));
await test('new public offerings remain discoverable',()=>assert.equal(model.mergeCatalog(guides,[...offerings,{...offerings[0],id:'new-offering'}]).length,17));
await test('Korean spaced certificate search finds upcoming matching course',()=>assert.equal(model.filterCatalog(courses,model.catalogFilters({q:'시니어 요리 지도사'}),now)[0].id,'2026-silver-food'));
await test('mode filter, empty results and whitespace search are correct',()=>{assert.equal(model.filterCatalog(courses,model.catalogFilters({mode:'ONLINE'}),now).length,0);assert.equal(model.filterCatalog(courses,model.catalogFilters({q:'   '}),now).length,visible.length);});
await test('ended source guides are hidden and unknown schedules remain visible',()=>{
  assert.ok(visible.some(c=>c.id==='2026-manual-therapy'));
  assert.ok(!visible.some(c=>c.id==='2026-park-golf'));
  assert.ok(visible.every(c=>c.status!=='ARCHIVED' && (!c.ends_on || c.ends_on>='2026-10-07')));
});
await test('inclusive course end day changes only at Korean midnight',()=>{
  const c={ends_on:'2026-10-07'};
  assert.equal(model.courseIsUpcoming(c,Date.parse('2026-10-07T14:59:59Z')),true);
  assert.equal(model.courseIsUpcoming(c,Date.parse('2026-10-07T15:00:00Z')),false);
  assert.equal(model.courseIsUpcoming({...c,status:'ARCHIVED'},now),false);
  assert.equal(model.guideEndDate('2026.12.20–01.05',2026),'2027-01-05');
  assert.equal(model.guideEndDate('07.14–07.21',2026),'2026-07-21');
  assert.equal(model.guideEndDate('2026.02.30',2026),null);
  assert.equal(model.guideEndDate('2026년 12월 예정',2026),null);
});
await test('query arrays and invalid modes cannot break render',()=>assert.deepEqual(model.catalogFilters({q:['a','b'],mode:'invalid',view:['list']}),{q:'',mode:'',state:'current',view:'cards'}));
await test('view URL preserves and safely encodes query, mode and completion condition',()=>{const url=model.catalogHref(model.catalogFilters({q:'목공 & test',mode:'OFFLINE',state:'completed'}),'list');const p=new URL(url,'http://localhost').searchParams;assert.equal(p.get('q'),'목공 & test');assert.equal(p.get('view'),'list');assert.equal(p.get('mode'),'OFFLINE');assert.equal(p.get('state'),'completed');});
await test('completed and current partition the permitted catalogue and all retains every item',()=>{
  const completed=model.filterCatalog(courses,model.catalogFilters({state:'completed'}),now);
  const all=model.filterCatalog(courses,model.catalogFilters({state:'all'}),now);
  assert(completed.length>0 && visible.length>0);
  assert.equal(all.length,courses.length);
  assert.equal(completed.length+visible.length,all.length);
  assert.equal(new Set([...completed,...visible].map(c=>c.id)).size,all.length);
  assert(completed.some(c=>c.status==='ARCHIVED'));
  assert(completed.some(c=>c.status!=='ARCHIVED' && c.ends_on<'2026-10-07'));
});
await test('completion state combines with text and delivery filters',()=>{
  const ended={...courses[0],id:'ended',name:'지난 목공 과정',summary:'',academy:'',certificate:null,status:'CLOSED',ends_on:'2026-10-06',mode:'OFFLINE'};
  const future={...ended,id:'future',ends_on:'2026-12-30'};
  const online={...ended,id:'online',mode:'ONLINE'};
  const filters=model.catalogFilters({state:'completed',q:'지난 목공',mode:'OFFLINE'});
  assert.deepEqual(model.filterCatalog([ended,future,online],filters,now).map(c=>c.id),['ended']);
  assert.deepEqual(model.filterCatalog([ended,future,online],{...filters,state:'current'},now).map(c=>c.id),['future']);
  assert.deepEqual(model.filterCatalog([ended,future,online],{...filters,state:'all'},now).map(c=>c.id),['ended','future']);
});
await test('missing, unknown and repeated states safely use the default',()=>{
  for(const state of [undefined,'invalid','COMPLETED',['completed'],['all','current']]) {
    const filters=model.catalogFilters({state});assert.equal(filters.state,'current');
    assert.deepEqual(model.filterCatalog(courses,filters,now),visible);
  }
  assert(!new URL(model.catalogHref(model.catalogFilters({}),'list'),'http://localhost').searchParams.has('state'));
});
await test('completion filter follows Korean midnight, archive state and unknown dates',()=>{
  const endDay={...courses[0],status:'CLOSED',ends_on:'2026-10-07'};
  const filters=model.catalogFilters({state:'completed'});
  assert.equal(model.filterCatalog([endDay],filters,Date.parse('2026-10-07T14:59:59Z')).length,0);
  assert.equal(model.filterCatalog([endDay],filters,Date.parse('2026-10-07T15:00:00Z')).length,1);
  assert.equal(model.filterCatalog([{...endDay,status:'ARCHIVED',ends_on:'2026-12-30'}],filters,now).length,1);
  assert.equal(model.filterCatalog([{...endDay,status:null,ends_on:null}],filters,now).length,0);
});
let dbError=null,throwDb=false;
const selections=[];
const query={select(v){selections.push(v);return this;},eq(){return this;},order(){return this;},maybeSingle:async()=>({data:guides[0],error:dbError}),then(resolve){resolve({data:dbError?null:guides,error:dbError});}};
const api=load('src/lib/course-guide/data.ts',{'./model':model,'@/lib/supabase/server':{createServerSupabaseClient:async()=>{if(throwDb)throw Error('network');return{from:()=>query};}},'@/lib/portal/data':{getCourseCards:async()=>({offerings,unavailable:false}),getCourseInstructorNames:async()=>({})}});
await test('DB-backed catalog reads guides and preserves linked deduplication',async()=>{assert.equal((await api.getCourseCatalog()).courses.length,16);assert(selections.every(s=>!s.includes('*')));});
await test('failed DB guides report partial availability',async()=>{dbError={message:'unavailable'};const r=await api.getCourseCatalog();assert.equal(r.unavailable,true);assert.equal(r.courses.length,3);await assert.rejects(api.getCourseGuide('2026-manual-therapy'),/불러오지/);dbError=null;});
await test('connection failure handled and invalid detail IDs not queried',async()=>{throwDb=true;assert.equal((await api.getCourseCatalog()).unavailable,true);assert.equal(await api.getCourseGuide('../bad'),null);throwDb=false;});
const portalData={getCourseInstructorNames:async()=>({}),modeLabel:{OFFLINE:'대면',ONLINE:'온라인',BLENDED:'혼합'},getCourseIntroduction:async()=>null,dateTime:value=>value??'미기재'};
const Link=({children,scroll,...props})=>React.createElement('a',props,children);
const documentModel=load('src/lib/learner-documents/model.ts',{'../auth/registration':load('src/lib/auth/registration.ts')});
const popup={DocumentPopup:({windowName,children,...props})=>React.createElement('a',props,children)};
const ui=load('src/components/portal/ui.tsx',{'next/link':Link,'@/lib/portal/data':portalData});
const catalog=load('src/components/course-guide/catalog.tsx',{'next/link':Link,'@/lib/portal/data':portalData,'@/lib/course-guide/model':{...model,recruitmentLabel:course=>model.recruitmentLabel(course,now)},'@/components/portal/instructor-names':instructorNames});
let unavailable=false;
const page=load('src/app/courses/page.tsx',{'next/link':Link,'@/lib/auth/session':{getSessionIdentity:async()=>null},'@/lib/course-guide/data':{getCourseCatalog:async()=>({courses,unavailable}),editableGuideOrgs:()=>[]},'@/lib/course-guide/model':{...model,filterCatalog:(items,filters)=>model.filterCatalog(items,filters,now)},'@/components/course-guide/catalog':catalog,'@/components/portal/ui':ui}).default;
const render=async params=>renderToStaticMarkup(await page({searchParams:Promise.resolve(params)}));
await test('cards show current courses, certificates and admission information',async()=>{const html=await render({});assert.equal((html.match(/data-course-card/g)??[]).length,visible.length);assert(html.includes('시니어요리지도사'));assert(html.includes('xl:grid-cols-3'));assert(html.includes('aria-current="page"'));assert(html.includes('신청기간'));assert(html.includes('수강료'));assert(html.includes('value="current" selected=""'));assert(!html.includes('class="badge">운영 완료'));assert(html.includes('모집 안내 확인'));});
await test('completed cards and list show historical links, badges and selected condition',async()=>{
  const completed=model.filterCatalog(courses,model.catalogFilters({state:'completed'}),now);
  for(const view of ['cards','list']) {
    const html=await render({state:'completed',view});
    assert.equal((html.match(view==='cards'?/data-course-card/g:/scope="row"/g)??[]).length,completed.length);
    assert(html.includes('value="completed" selected=""'));
    assert.equal((html.match(/class="badge(?: mt-2)?">운영 완료/g)??[]).length,completed.length);
    assert(html.includes('state=completed'));
    for(const c of completed)assert(html.includes(`href="${c.href}"`));
  }
});
await test('all condition renders both groups in cards and list',async()=>{
  for(const view of ['cards','list']) {
    const html=await render({state:'all',view});
    assert.equal((html.match(view==='cards'?/data-course-card/g:/scope="row"/g)??[]).length,courses.length);
    assert(html.includes('value="all" selected=""'));
  }
});
await test('list is accessible table with current courses and retained form view',async()=>{const html=await render({view:'list'});assert.equal((html.match(/scope="row"/g)??[]).length,visible.length);assert(html.includes('role="region"'));assert(html.includes('name="view" value="list"'));assert(!html.includes('data-course-card'));});
await test('zero results and partial data are not misleading',async()=>{assert((await render({q:'no-matching-course'})).includes('조건에 맞는'));unavailable=true;assert((await render({})).includes('일부 교육과정을'));unavailable=false;});
let detail=guides[0];
const detailPage=load('src/app/courses/[id]/page.tsx',{'next/link':Link,'next/navigation':{notFound:()=>{throw Error('404');}},'@/lib/auth/session':{getSessionIdentity:async()=>null},'@/lib/course-guide/data':{getCourseGuide:async()=>detail,canEditGuide:()=>false},'@/lib/portal/data':portalData,'@/components/portal/instructor-names':instructorNames,'@/components/portal/scholarship-notice':load('src/components/portal/scholarship-notice.tsx'),'@/components/portal/ui':ui,'@/lib/learner-documents/model':documentModel,'@/components/instructor-documents/document-popup':popup}).default;
await test('details show pending dates and schedule history without opening admissions',async()=>{const html=renderToStaticMarkup(await detailPage({params:Promise.resolve({id:detail.id})}));assert(html.includes('2026년 12월 예정'));assert(html.includes('일정 변경 안내'));assert(html.includes('관련 자격증 미기재'));assert(!html.includes('/apply'));});
await test('course detail opens its own application document including guide slug',async()=>{const html=renderToStaticMarkup(await detailPage({params:Promise.resolve({id:detail.id})}));assert(html.includes(`type=application&amp;course=${detail.id}`));assert(html.includes('수강신청원서 작성'));});
await test('unknown or unpublished details return404',async()=>{detail=null;await assert.rejects(detailPage({params:Promise.resolve({id:'private'})}),/404/);});
await test('recruitment labels use actual windows and do not invent missing admissions',()=>{
  const c={status:'PUBLISHED',apply_from:'2026-10-07T00:00:00Z',apply_until:'2026-10-08T00:00:00Z'};
  assert.equal(model.recruitmentLabel(c,Date.parse(c.apply_from)-1),'모집 예정');
  assert.equal(model.recruitmentLabel(c,Date.parse(c.apply_from)),'접수 중');
  assert.equal(model.recruitmentLabel(c,Date.parse(c.apply_until)),'접수 종료');
  assert.equal(model.recruitmentLabel({status:null}),'모집 안내 확인');
  assert.equal(model.recruitmentLabel({status:'ARCHIVED'}),'운영 완료');
  assert.equal(model.recruitmentLabel({status:'CLOSED'}),'모집 종료');
  assert.equal(model.recruitmentLabel({status:'DRAFT'}),'모집 준비 중');
  assert.equal(model.recruitmentLabel({status:'PUBLISHED',ends_on:'2026-10-06'},now),'운영 완료');
  assert.equal(model.recruitmentLabel({status:'CLOSED',ends_on:'2026-10-07'},now),'모집 종료');
});
await test('linked course guides retain actual admission dates and price',()=>{
  const c=model.mergeCatalog([guides.find(g=>g.offering_id)],[{...offerings[0],tuition:0,apply_from:'2026-10-07T00:00:00Z',apply_until:'2026-10-08T00:00:00Z'}])[0];
  assert.equal(c.tuition,0);assert.equal(c.status,'ARCHIVED');assert.equal(c.apply_from,'2026-10-07T00:00:00Z');
});
console.log(`${checks} course catalog checks passed.`);
