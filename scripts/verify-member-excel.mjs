import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}
let checks = 0;
async function check(name, run) { await run(); checks++; console.log('PASS ' + name); }
const audience = load('src/lib/auth/login-audience.ts');
const registration = load('src/lib/auth/registration.ts');
const member = load('src/lib/members/model.ts', { '@/lib/auth/login-audience': audience, '@/lib/auth/registration': registration });
const excel = load('src/lib/members/excel.ts', { '@/lib/auth/login-audience': audience, './model': member });
const org = '20000000-0000-4000-8000-000000000001';
const person = '20000000-0000-4000-8000-000000000002';
const columns = group => excel.MEMBER_EXCEL_COLUMNS[group].map(([, label]) => label);
const row = (group, values) => excel.MEMBER_EXCEL_COLUMNS[group].map(([key]) => values[key] ?? '');

await check('three templates use exactly the editable member fields', () => {
  assert.deepEqual(columns('office'), ['구성원 ID','수정 버전','성명','이메일(아이디)','직책','사무실 전화번호','핸드폰 전화번호','비고']);
  assert(columns('instructor').includes('교내/교외'));
  assert(columns('learner').includes('생년월일'));
});
await check('new office rows normalize title, email and contact before DB submission', () => {
  const parsed = excel.parseMemberWorkbook([columns('office'),row('office',{name:' 신규 연구원 ',email:' NEW@UC.AC.KR ',position:'선임연구원',mobile_phone:'010-1234-5678'})], 'office');
  const [verified] = excel.validateMemberExcelRows(parsed,'office',org);
  assert.equal(verified.person_id,'');
  assert.equal(verified.position,'SENIOR_RESEARCHER');
  assert.equal(verified.email,'new@uc.ac.kr');
  assert.equal(verified.mobile_phone,'+821012345678');
  assert.match(verified.request_id,/^[0-9a-f-]{36}$/i);
});
await check('existing rows retain identity and revision for guarded edits', () => {
  const parsed = excel.parseMemberWorkbook([columns('learner'),row('learner',{person_id:person,revision:3,name:'기존 학생',email:'old@example.com',mobile_phone:'010-1234-5678',birth_date:'2000-01-02'})], 'learner');
  const [verified] = excel.validateMemberExcelRows(parsed,'learner','');
  assert.equal(verified.person_id,person);
  assert.equal(verified.revision,3);
  assert.equal(verified.request_id,'');
});
await check('file mismatches, duplicates and bad values stop before any write', () => {
  assert.throws(()=>excel.parseMemberWorkbook([columns('office'),row('office',{name:'A'})],'learner'),/서식/);
  const cells=[columns('instructor'),row('instructor',{name:'A',email:'a@example.com',kind:'교외'}),row('instructor',{name:'B',email:'A@example.com',kind:'교외'})];
  assert.throws(()=>excel.validateMemberExcelRows(excel.parseMemberWorkbook(cells,'instructor'),'instructor',org),/중복/);
  assert.throws(()=>excel.validateMemberExcelRows(excel.parseMemberWorkbook([columns('instructor'),row('instructor',{name:'A',email:'a@example.com',kind:'교내'})],'instructor'),'instructor',org),/학교|이메일|성명/);
  assert.throws(()=>excel.validateMemberExcelRows(excel.parseMemberWorkbook([columns('office'),row('office',{person_id:person,revision:'',name:'A'})],'office'),'office',''),/수정 버전/);
});
await check('export values preserve member ID and readable labels', () => {
  const values=excel.memberExcelValues('office',{person_id:person,revision:2,name:'관리자',email:'a@uc.ac.kr',position:'DIRECTOR',office_phone:'0522300427',mobile_phone:'+821012345678',notes:'확인'});
  assert.deepEqual(values,[person,'2','관리자','a@uc.ac.kr','단장','052-230-0427','010-1234-5678','확인']);
});

let me={id:person,roles:[],member_entry_orgs:[{org_id:org,org_name:'사업단'}]};
let calls=[];let result={data:{created:1,updated:0},error:null};
const db={rpc:async(name,args)=>{calls.push({name,args});return result;}};
const actions=load('src/app/admin/accounts/excel-actions.ts',{
  'next/cache':{revalidatePath(){}},'@/lib/supabase/server':{createServerSupabaseClient:async()=>db},
  '@/lib/members/data':{memberAdmin:async()=>me},'@/lib/members/model':member,'@/lib/members/excel':excel,
  '@/lib/auth/mfa-message':{MFA_REAUTH_MESSAGE:'추가 인증 필요'},
});
const newRow=()=>excel.parseMemberWorkbook([columns('office'),row('office',{name:'등록 회원',email:'new@uc.ac.kr'})],'office');
const editRow=()=>excel.parseMemberWorkbook([columns('office'),row('office',{person_id:person,revision:0,name:'기존 회원'})],'office');
await check('designated entry operator can import new rows but cannot edit',async()=>{
  assert((await actions.importMemberExcel('office',org,newRow())).ok);
  assert.equal(calls.at(-1).name,'life_member_excel_import');
  const before=calls.length;
  assert.match((await actions.importMemberExcel('office',org,editRow())).message,/시스템 관리자/);
  assert.equal(calls.length,before);
});
await check('administrator can edit, while a different organization cannot create',async()=>{
  me={...me,roles:[{role:'SYSTEM_ADMIN',org_id:org}],member_entry_orgs:[]};
  result={data:{created:0,updated:1},error:null};
  assert((await actions.importMemberExcel('office','',editRow())).ok);
  const before=calls.length;
  assert.match((await actions.importMemberExcel('office',org,newRow())).message,/등록 권한/);
  assert.equal(calls.length,before);
});
await check('row-level database errors are understandable and no success is reported',async()=>{
  me={...me,member_entry_orgs:[{org_id:org,org_name:'사업단'}]};
  result={data:null,error:{message:'ROW_1: MEMBER_EMAIL_EXISTS'}};
  const response=await actions.importMemberExcel('office',org,newRow());
  assert.equal(response.ok,false);assert.match(response.message,/2행.*이미 등록된 이메일/);
  result={data:null,error:{message:'ROW_1: MFA_REAUTH_REQUIRED'}};
  assert.match((await actions.importMemberExcel('office',org,newRow())).message,/추가 인증 필요/);
});
await check('download passes group and search to authorized scoped RPC',async()=>{
  result={data:[],error:null};
  assert.deepEqual(await actions.exportMemberExcel('learner','학생'),[]);
  assert.deepEqual(calls.at(-1),{name:'life_member_excel_export',args:{p_group:'learner',p_query:'학생'}});
});
console.log(`${checks} member Excel workflow checks passed.`);
