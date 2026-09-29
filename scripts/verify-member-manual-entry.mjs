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
let checks = 0;
const test = async (name, run) => { await run(); checks++; console.log('PASS ' + name); };
const id = '20000000-0000-4000-8000-000000000001';
const audienceValidation = load('src/lib/auth/login-audience.ts');
const registration = load('src/lib/auth/registration.ts');
const model = load('src/lib/members/model.ts', { '@/lib/auth/login-audience': audienceValidation, '@/lib/auth/registration': registration });
const audience = load('src/lib/auth/login-audience.ts');
const form = extra => { const f = new FormData(); Object.entries({request_id:id,org_id:id,group:'learner',name:'수동 회원',email:' NEW@EXAMPLE.INVALID ',notes:'',...extra}).forEach(([k,v])=>f.set(k,v)); return f; };
await test('manual input normalizes email without requiring existing person or revision',()=> {const input=model.newMemberInput(form());assert.equal(input.p_email,'new@example.invalid');assert.equal(input.p_person,undefined);assert.equal(input.p_revision,undefined);});
for(const email of ['','wrong','a@b','a b@example.com','a@b..com']) await test('reject invalid manual email '+email,()=>assert.equal(model.newMemberInput(form({email})),null));
let me = {id, name:'관리자',roles:[{role:'SYSTEM_ADMIN',org_id:id}]};
let calls=0, rpcError=null, rpcData=id;
const provisionCalls=[];
const next={notFound(){throw Error('NOT_FOUND');},redirect(url){throw Error('REDIRECT '+url);}};
const client={rpc:async()=>{calls++;return {data:rpcData,error:rpcError};}};
const data=load('src/lib/members/data.ts',{'server-only':{},'next/navigation':next,'@/lib/auth/session':{requireIdentity:async()=>me},'@/lib/supabase/server':{createServerSupabaseClient:async()=>client}});
const actions=load('src/app/admin/accounts/actions.ts',{'@/lib/auth/login-audience': audienceValidation, 'next/cache':{revalidatePath(){}},'next/navigation':next,'@/lib/members/data':data,'@/lib/members/model':model,'@/lib/supabase/server':{createServerSupabaseClient:async()=>client},'@/lib/auth/member-provisioning':{provisionMember:async (...args)=>provisionCalls.push(args)},'@/lib/portal/data':{UUID:/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i},'@/lib/auth/mfa-message':{MFA_REAUTH_MESSAGE:'추가 인증 필요'}});
await test('ordinary SYSTEM_ADMIN cannot create through server action',async()=>{await assert.rejects(actions.createMember({},form()),/NOT_FOUND/);assert.equal(calls,0);});
me={...me,roles:[],member_entry_orgs:[{org_id:id,org_name:'검증 사업단',is_super_admin:false}]};
await test('designated operator can read but cannot gain existing edit/delete permission',async()=>{assert.equal((await data.memberAdmin()).id,id);await assert.rejects(data.memberAdmin(true),/NOT_FOUND/);});
await test('create action rejects forged organization before DB request',async()=>{const before=calls;assert.match((await actions.createMember({},form({org_id:'20000000-0000-4000-8000-000000000002'}))).message,/권한/);assert.equal(calls,before);});
await test('create action redirects only after database ID is returned',async()=>{await assert.rejects(actions.createMember({},form()),/REDIRECT.*created=1/);rpcData=null;assert.match((await actions.createMember({},form())).message,/결과/);rpcData=id;});
await test('duplicate and MFA failures preserve actionable errors',async()=>{rpcError={message:'MEMBER_EMAIL_EXISTS'};assert.match((await actions.createMember({},form())).message,/이미 등록된 이메일/);rpcError={message:'MFA_REAUTH_REQUIRED'};assert.equal((await actions.createMember({},form())).message,'추가 인증 필요');rpcError=null;});
await test('office and internal manual registration provision only university email accounts',async()=>{
  for(const extra of [{group:'office',email:'member@uc.ac.kr'},{group:'instructor',instructor_kind:'INTERNAL',email:'teacher@uc.ac.kr'}])
    await assert.rejects(actions.createMember({},form(extra)),/REDIRECT.*created=1/);
  assert.deepEqual(provisionCalls.map(args=>args[1]),['member@uc.ac.kr','teacher@uc.ac.kr']);
  assert.match((await actions.createMember({},form({group:'office',email:'other@example.com'}))).message,/대학 이메일/);
});
const navigation=load('src/lib/auth/workspace-navigation.ts',{'./login-audience':audience});
await test('entry-only operator gets member menu without unrelated staff modules',()=>{assert.equal(navigation.isOfficeMember(me),true);assert.deepEqual(navigation.officeSections(me).flatMap(s=>s.links.map(l=>l.href)),['/admin/accounts']);});
await test('chief administrator label is explicit',()=>assert.equal(navigation.memberLabel({...me,is_super_admin:true}),'최고 관리자'));
const ui={'next/link':'a','next/navigation':next,'@/lib/auth/login-audience':audience,'@/lib/members/model':model,'@/components/portal/ui':{PageIntro:({title,children})=>React.createElement('div',null,React.createElement('h1',null,title),children),Empty:({title})=>React.createElement('p',null,title)},'@/components/portal/action-form':{ActionForm:({children,label})=>React.createElement('form',null,children,React.createElement('button',null,label))}};
const newPage=load('src/app/admin/accounts/new/page.tsx',{...ui,'@/lib/members/data':data,'../actions':actions}).default;
for(const [group,fields] of [['office',['직책','사무실 전화번호']],['instructor',['교내/교외','Q&amp;A']],['learner',['생년월일','핸드폰 전화번호']]]) await test(group+' manual form contains required fields and request ID',async()=>{const html=renderToStaticMarkup(await newPage({searchParams:Promise.resolve({group})}));for(const field of fields)assert(html.includes(field));assert(html.includes('name="request_id"'));assert(html.includes('type="email" required=""'));});
const directory={items:[{id,name:'수동 회원',email:'new@example.invalid',is_manual:true,can_manage:false,notes:'',current_courses:[{id,name:'올해 실제 과정'}]}],total:1,page:1,page_size:20,current_year:2026,counts:{office:0,instructor:0,learner:1}};
const page=load('src/app/admin/accounts/page.tsx',{...ui,'@/components/members/member-excel':{MemberExcel:({orgs})=>orgs.length ? React.createElement('a',null,'구성원 수동 등록') : null},'@/components/portal/member-notice':load('src/components/portal/member-notice.tsx'),'@/lib/members/data':{memberAdmin:data.memberAdmin,getFilteredMembers:async()=>({data:directory,error:false})}}).default;
await test('current course column precedes full history and operator cannot see edit/delete',async()=>{const html=renderToStaticMarkup(await page({searchParams:Promise.resolve({group:'learner'})}));assert(html.indexOf('올해 수강과목')<html.indexOf('수강이력'));assert(html.includes('올해 실제 과정'));assert(html.includes('구성원 수동 등록'));assert(!html.includes('aria-label="수동 회원 수정"'));assert(html.includes('수동 등록</span>'));});
me={id,name:'일반 관리자',roles:[{role:'SYSTEM_ADMIN',org_id:id}]};
await test('manual registration button hidden for unlisted administrator',async()=>{const html=renderToStaticMarkup(await page({searchParams:Promise.resolve({group:'learner'})}));assert(!html.includes('구성원 수동 등록'));await assert.rejects(newPage({searchParams:Promise.resolve({})}),/NOT_FOUND/);});

await test('all seven positions survive create and edit parsing', () => {
  assert.deepEqual(Object.values(audience.OFFICE_POSITIONS), ['단장','본부장','센터장','운영팀장','책임연구원','선임연구원','연구원']);
  for (const position of Object.keys(audience.OFFICE_POSITIONS)) {
    assert.equal(model.newMemberInput(form({group:'office',office_position:position})).p_position, position);
    assert.equal(model.memberInput(form({group:'office',office_position:position,revision:'0'})).p_position, position);
  }
  assert.equal(model.newMemberInput(form({group:'office',office_position:'SYSTEM_ADMIN'})), null);
  assert.equal(model.newMemberInput(form({group:'office',office_position:'toString'})), null);
});
await test('manual internal instructor requires the school address', () => {
  assert.equal(model.newMemberInput(form({group:'instructor',instructor_kind:'INTERNAL'})), null);
  assert.equal(model.newMemberInput(form({group:'instructor',instructor_kind:'INTERNAL',email:' Teacher@UC.AC.KR '})).p_email, 'teacher@uc.ac.kr');
});
await test('verified manual office classification does not grant staff modules', () => {
  const office = {roles:[],member_group:'office',office_position:'DIVISION_HEAD'};
  assert.equal(navigation.memberLabel(office),'관리자 · 본부장');
  assert.deepEqual(navigation.officeSections(office).flatMap(s=>s.links),[]);
});
const authUi = load('src/components/auth/auth-form.tsx', {
  ...ui, '@/components/common/support-contact': {SupportContact:()=>null}, '@/app/auth/actions': {},
  './password-field': {PasswordField:()=>null}, './phone-field': {PhoneField:()=>null},
  './social-login': {SocialLogin:()=>React.createElement('div',null,'SOCIAL_LOGIN')},
  '@/lib/auth/social-providers': {socialProviderOptions:()=>[]},
  '@/lib/auth/bot-config': {getBotProtection:()=>undefined},
  '@/lib/deployment/review-mode': {isReviewOnly:()=>false},
  '@/lib/auth/email-config': {authEmailEnabled:()=>true},
  '@/lib/auth/signup-config': {publicSignupEnabled:()=>true},
});
for (const audience of ['office','internal']) await test(audience+' offers first-password activation without public signup', () => {
  const login=renderToStaticMarkup(React.createElement(authUi.AuthForm,{audience}));
  assert(login.includes('href="/auth/forgot-password?first=1"'));
  assert(login.includes('신규 비밀번호 설정'));
  assert(login.includes('처음 로그인하시나요?'));
  assert(login.includes('대학 이메일(@uc.ac.kr)'));
  assert(!login.includes('href="/auth/signup?audience='+audience+'"'));
  assert(!login.includes('SOCIAL_LOGIN'));
});
await test('external instructor retains public signup option',()=>{
  const login=renderToStaticMarkup(React.createElement(authUi.AuthForm,{audience:'external'}));
  assert(login.includes('href="/auth/signup?audience=external"'));
});
console.log(`${checks} manual member checks passed.`);
