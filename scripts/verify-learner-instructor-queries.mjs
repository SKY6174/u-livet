import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createClient } from '@supabase/supabase-js';

const require = createRequire(import.meta.url);
const id = '20000000-0000-4000-8000-000000000001';
const person = '30000000-0000-4000-8000-000000000001';
const denied = Error('NOT_FOUND');
const component = ({ children, title }) => React.createElement('div', null, title, children);
const book = { offering: { id, name: 'Course' }, viewer_id: person, generated_at: new Date().toISOString(), members: [], sessions: [], attendance: [] };
function load(path, mocks) {
  const code = ts.transpileModule(readFileSync(path,'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  new Function('require','module','exports',code)(name => Object.hasOwn(mocks,name) ? mocks[name] : require(name),module,module.exports);
  return module.exports;
}
const portal = { UUID: /^[0-9a-f-]{36}$/i, getOffering: async () => ({ id, name: 'Course' }), dateTime: () => 'date' };
const navigation = { notFound: () => { throw denied; } };
const ui = { PageIntro: component, Empty: component };
const actions = { ActionForm: component };
let checks = 0;
async function test(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
function barrier(expected) {
  let release, signal;
  const pending = new Promise(resolve => { release=resolve; });
  const ready = new Promise(resolve => { signal=resolve; });
  let started = 0;
  return { enter: async () => { if (++started===expected) signal(); await pending; }, release,
    wait: async () => {
      let timer;
      try { await Promise.race([ready,new Promise((_,reject) => { timer=setTimeout(() => reject(Error('Independent reads did not start together')),3000); })]); }
      finally { clearTimeout(timer); }
    } };
}
function attendance({ failure, includeQr, identityDenied=false, clientFailure=false, invalidId=false }={}) {
  const requests=[];const gate=barrier(includeQr===false ? 1 : 2);
  const db=createClient('https://synthetic.invalid','test-public-key',{ auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async (input,options) => {
    const name=new URL(input).pathname.split('/').at(-1);requests.push(name);
    assert.deepEqual(JSON.parse(options.body),{f:id});
    if (!failure) await gate.enter();
    if (failure===name) return Response.json({message:'unavailable',code:'XX000'},{status:500});
    if (failure==='forbidden' && name!=='life_qr_checkins') return Response.json({message:'FORBIDDEN',code:'P0001'},{status:403});
    if (failure==='throw' && name==='life_qr_checkins') throw Error('transport failure');
    return Response.json(name==='life_qr_checkins' ? [{session_id:'session',person_id:person}] : structuredClone(book));
  }}});
  const data=load('src/lib/attendance/data.ts',{
    react:{cache:fn=>fn},'next/navigation':navigation,'@/lib/portal/data':portal,
    '@/lib/auth/session':{requireIdentity:async()=>{if(identityDenied)throw denied;}},
    '@/lib/supabase/server':{createServerSupabaseClient:async()=>{if(clientFailure)throw Error('offline');return db;}},
  });
  return { requests, gate, run: audience => data.getAttendanceBook(invalidId?'invalid':id,audience,includeQr) };
}
for(const audience of ['learner','instructor','manager']) await test(`${audience} attendance and QR begin together with exact course scope`,async()=>{
  const x=attendance();const promise=x.run(audience);await x.gate.wait();
  assert.equal(x.requests.length,2);x.gate.release();
  const result=await promise;assert.equal(result.unavailable,false);assert.equal(result.book.qr_checkins.length,1);
  assert(x.requests.includes(audience==='learner'?'life_my_attendance':'life_teaching_attendance'));
});
await test('evaluation omits unused QR query',async()=>{
  const x=attendance({includeQr:false});const p=x.run('learner');await x.gate.wait();x.gate.release();
  assert.equal((await p).unavailable,false);assert.deepEqual(x.requests,['life_my_attendance']);
});
for(const failure of ['life_qr_checkins','throw']) await test(`QR ${failure} preserves attendance with explicit warning`,async()=>{
  const x=attendance({failure});const r=await x.run('learner');assert.equal(r.unavailable,false);
  assert.equal(r.book.qr_unavailable,true);assert.deepEqual(r.book.qr_checkins,[]);
});
await test('book failure remains unavailable and forbidden still rejects',async()=>{
  assert.equal((await attendance({failure:'life_my_attendance'}).run('learner')).unavailable,true);
  await assert.rejects(attendance({failure:'forbidden'}).run('instructor'),e=>e===denied);
});
await test('identity or invalid ID rejects before any attendance/QR request; client failure is unavailable',async()=>{
  for(const input of [{identityDenied:true},{invalidId:true}]) {
    const x=attendance(input);await assert.rejects(x.run('learner'),e=>e===denied);assert.equal(x.requests.length,0);
  }
  assert.equal((await attendance({clientFailure:true}).run('learner')).unavailable,true);
});
for(const audience of ['learner','instructor']) {
  const path=audience==='learner'?'src/app/learning/[id]/page.tsx':'src/app/instructor/offerings/[id]/page.tsx';
  for(const allowed of [true,false]) await test(`${audience} questions share coursework phase after access check (${allowed})`,async()=>{
    const gate=barrier(6);let questionReads=0;let scopedReads=0;
    const db=createClient('https://synthetic.invalid','test-public-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async input=>{
      const name=new URL(input).pathname.split('/').at(-1);
      if(name==='life_enrollments'||name==='life_offering_instructors') return Response.json(allowed?[{id:'enrollment',valid_until:null}]:[]);
      scopedReads++;await gate.enter();return Response.json([]);
    }}});
    const Page=load(path,{
      'next/link':component,'next/navigation':navigation,'@/lib/portal/data':portal,
      '@/lib/auth/session':{requireIdentity:async()=>({id:person})},'@/lib/supabase/server':{createServerSupabaseClient:async()=>db},
      '@/app/actions':{},'@/components/portal/action-form':actions,'@/components/portal/ui':ui,
      '@/components/classroom/class-questions':{ClassQuestions:({questions})=>{assert.equal(questions,null);return React.createElement('div',null,'Question data unavailable');}},
      '@/lib/classroom-questions/data':{getClassQuestions:async target=>{assert.equal(target,id);questionReads++;await gate.enter();return null;}},
    }).default;
    const p=Page({params:Promise.resolve({id})});
    if(!allowed){await assert.rejects(p,e=>e===denied);assert.equal(questionReads,0);assert.equal(scopedReads,0);}
    else {await gate.wait();assert.equal(questionReads,1);assert.equal(scopedReads,5);gate.release();assert(renderToStaticMarkup(await p).includes('Course'));}
  });
  await test(`${audience} evaluation explicitly skips QR while keeping exam request`,async()=>{
    let argumentsReceived;const rpcCalls=[];
    const Page=load(audience==='learner'?'src/app/learning/[id]/evaluation/page.tsx':'src/app/instructor/offerings/[id]/evaluation/page.tsx',{
      'next/link':component,'@/lib/portal/data':portal,
      '@/lib/attendance/data':{getAttendanceBook:async(...args)=>{argumentsReceived=args;return {book};}},
      '@/lib/attendance/model':{attendanceIndex:()=>new Map(),attendanceState:()=>''},
      '@/lib/supabase/server':{createServerSupabaseClient:async()=>({rpc:async(name,args)=>{rpcCalls.push([name,args]);return {data:{quizzes:[],attempts:[]}};}})},
      '@/components/portal/ui':ui,'@/components/portal/action-form':actions,
      '@/components/portal/quiz-editor':{QuizEditor:component},'@/app/evaluation-actions':{},
    }).default;
    renderToStaticMarkup(await Page({params:Promise.resolve({id})}));
    assert.deepEqual(argumentsReceived,[id,audience,false]);assert.deepEqual(rpcCalls,[['life_exam_room',{f:id}]]);
  });
}
console.log(`${checks} learner/instructor query checks passed.`);
