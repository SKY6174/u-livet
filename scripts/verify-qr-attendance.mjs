import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(file,mocks={}) {
  const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const m={exports:{}};new Function('require','module','exports',code)(name=>name in mocks?mocks[name]:require(name),m,m.exports);return m.exports;
}
const id='10000000-0000-4000-8000-000000000001',session='10000000-0000-4000-8000-000000000002',token='b'.repeat(64);
let identity=true,calls=[],invalidations=[],response={data:{session_title:'수업',checked_in_at:new Date().toISOString()},error:null};
const qr=load('src/lib/attendance/qr.ts');
const common={
  '@/lib/portal/data':{UUID:/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i},
  '@/lib/attendance/qr':qr,
  '@/lib/auth/session':{getSessionIdentity:async()=>identity?{id:'self'}:null},
  '@/lib/supabase/server':{createServerSupabaseClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});if(response instanceof Error)throw response;return response;}})},
  'next/cache':{revalidatePath:path=>invalidations.push(path)},
};
const checkin=load('src/app/learning/[id]/attendance/checkin-actions.ts',common).recordStudentQrCheckin;
const issue=load('src/app/qr-attendance-actions.ts',common);
const form=(overrides={})=>{const f=new FormData();for(const [key,value]of Object.entries({offering:id,session,token,...overrides}))f.set(key,value);return f;};
for(const changes of [{offering:'bad'},{session:'bad'},{token:''},{token:'short'}])assert(!(await checkin({},form(changes))).ok);
identity=false;assert(!(await checkin({},form())).ok);assert.equal(calls.length,0);identity=true;
const good=await checkin({},form());assert(good.ok);assert.deepEqual(calls[0],{name:'life_qr_checkin',args:{f:id,s:session,t:token}});assert.equal(invalidations.length,2);
console.log('PASS input and identity checks precede scoped RPC; success requires a valid receipt');
for(const value of [{data:null,error:{message:'QR_EXPIRED'}},{data:null,error:{message:'missing',code:'PGRST202'}},{data:null,error:null},{data:{session_title:'x',checked_in_at:'invalid'},error:null},Error('offline')]) {
 response=value;invalidations=[];assert(!(await checkin({},form())).ok);assert.equal(invalidations.length,0);
}
console.log('PASS DB errors, unavailable migration, malformed receipts and connection failures cannot report success');
response={data:{token,expires_at:new Date(Date.now()+120000).toISOString()},error:null};assert((await issue.issueAttendanceQr(id,session)).challenge);
response={data:null,error:{message:'CLASS_NOT_OPEN'}};assert(!(await issue.issueAttendanceQr(id,session)).challenge);
assert(!(await issue.stopAttendanceQr(id,session)).ok);
response={data:null,error:null};assert((await issue.stopAttendanceQr(id,session)).ok);
console.log('PASS issuing and stopping QR propagate server failures');
let next='';
const page=load('src/app/learning/[id]/attendance/checkin/page.tsx',{
 ...common,'next/link':'a','@/lib/auth/session':{requireIdentity:async path=>{next=path;return {name:'테스트'};}},
 '@/components/portal/ui':{PageIntro:'header',Empty:'div'},'@/components/attendance/qr-checkin':{QrCheckin:'form'},
}).default;
calls=[];await page({params:Promise.resolve({id}),searchParams:Promise.resolve({session,t:token})});
assert.equal(calls.length,0);assert.equal(next,`/learning/${id}/attendance/checkin?session=${session}&t=${token}`);
console.log('PASS GET renders confirmation without writes and preserves QR token through login');
const nav=load('src/lib/auth/workspace-navigation.ts',{'./login-audience':load('src/lib/auth/login-audience.ts')});
for(const roles of [['INSTRUCTOR'],['INSTRUCTOR','COURSE_MANAGER']]) {
 const links=nav.primaryLinks({roles:roles.map(role=>({role,org_id:id}))});assert.equal(links.filter(l=>l.label==='My Room').length,1);assert(!links.some(l=>l.href==='/mypage'));
}
console.log('PASS instructor and mixed-role menus have one My Room');
console.log('5 QR action and navigation checks passed.');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const Records=load('src/app/instructor/records/page.tsx',{
 'next/link':'a','next/navigation':{notFound:()=>{throw Error('NOT_FOUND');}},
 '@/lib/auth/session':{requireIdentity:async()=>({id:'self',roles:[{role:'INSTRUCTOR'}]})},
 '@/lib/supabase/server':{createServerSupabaseClient:async()=>({
  rpc:async()=>({error:null,data:[{id:'own',person_id:'self',course_name:'배정 종료된 본인 강좌',session_title:'과거 수업',minutes:60,current:true,starts_at:'2026-01-01',ends_at:'2026-01-01'},
  {id:'other',person_id:'other',course_name:'다른 강사 비공개 이력',minutes:120}]}),
  from:()=>({select(){return this;},eq:async()=>({data:[],error:null})}),
 })},
 '@/lib/portal/data':{getWorkspaceOfferings:async()=>({offerings:[],unavailable:false}),dateTime:value=>value},
 '@/components/portal/ui':{PageIntro:({children})=>React.createElement('header',null,children),Empty:({title})=>React.createElement('p',null,title)},
 '@/components/portal/action-form':{ActionForm:'form'},'@/app/certificate-actions':{submitTeaching:()=>{}},
}).default;
const history=renderToStaticMarkup(await Records());
assert(history.includes('배정 종료된 본인 강좌'));assert(!history.includes('다른 강사 비공개 이력'));assert(history.includes('60분'));
console.log('PASS historical teaching survives assignment expiration and excludes other teachers in mixed-role responses');
console.log('6 QR, navigation and history checks passed.');
