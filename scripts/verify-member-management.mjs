import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const load = (file, mocks = {}) => {
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), module, module.exports);
  return module.exports;
};
let checks = 0;
const test = async (name, run) => { await run(); checks++; console.log('PASS ' + name); };
const audienceValidation = load('src/lib/auth/login-audience.ts');
const registration = load('src/lib/auth/registration.ts');
const model = load('src/lib/members/model.ts', { '@/lib/auth/login-audience': audienceValidation, '@/lib/auth/registration': registration });
const form = overrides => { const f = new FormData(); for (const [key, value] of Object.entries({ person_id: '20000000-0000-4000-8000-000000000001', group: 'learner', name: '검증 회원', revision: '0', mobile_phone: '010-1234-5678', birth_date: '1990-03-01', notes: '', ...overrides })) f.set(key, value); return f; };
await test('valid learner input normalizes mobile and preserves date', () => {
  const input = model.memberInput(form()); assert.equal(input.p_mobile_phone, '+821012345678'); assert.equal(input.p_birth_date, '1990-03-01');
});
for (const change of [{ name: '' }, { group: 'admin' }, { revision: '-1' }, { revision: '1.5' }, { mobile_phone: 'abc' }, { birth_date: '2026-02-30' }, { birth_date: '2099-01-01' }, { birth_date: '1899-01-01' }, { office_phone: '123' }, { instructor_phone: 'javascript:alert(1)' }, { notes: 'x'.repeat(2001) }, { group: 'instructor', instructor_kind: 'FAKE' }]) {
  await test('reject invalid fields: ' + Object.keys(change).join(','), () => assert.equal(model.memberInput(form(change)), null));
}
await test('office and instructor phone normalization handles landlines', () => {
  assert.equal(model.normalizeContact('052-230-0000'), '0522300000'); assert.equal(model.displayPhone('0212345678'), '02-1234-5678'); assert.equal(model.displayPhone('+821012345678'), '010-1234-5678');
});
await test('query parameters cannot inject member group or pagination', () => {
  assert.equal(model.memberGroup('SYSTEM_ADMIN'), 'office'); assert.equal(model.memberPage('-1'), 1); assert.equal(model.memberPage('999999'), 100000); assert.equal(model.memberPage(['2']), 1);
});
let allowed = true, rpcCalls = [], rpcError = null;
const mocks = {
  '@/lib/auth/login-audience': audienceValidation, 'next/cache': { revalidatePath() {} }, 'next/navigation': { redirect(url) { throw Error('REDIRECT ' + url); } },
  '@/lib/supabase/server': { createServerSupabaseClient: async () => ({ rpc: async (name, args) => { rpcCalls.push({ name, args }); return { error: rpcError }; } }) },
  '@/lib/portal/data': { UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i },
  '@/lib/auth/mfa-message': { MFA_REAUTH_MESSAGE: '추가 인증 필요' }, '@/lib/members/model': model,
  '@/lib/members/data': { memberAdmin: async () => { if (!allowed) throw Error('FORBIDDEN'); return { id: '20000000-0000-4000-8000-000000000099', roles: [{role:'SYSTEM_ADMIN'}] }; } },
};
const actions = load('src/app/admin/accounts/actions.ts', mocks);
await test('server action denies unauthorized writes before RPC', async () => { allowed = false; await assert.rejects(actions.saveMember({}, form()), /FORBIDDEN/); assert.equal(rpcCalls.length, 0); allowed = true; });
await test('malformed and extra fields never reach the write RPC', async () => {
  await actions.saveMember({}, form({ person_id: 'invalid' })); assert.equal(rpcCalls.length, 0);
  await assert.rejects(actions.saveMember({}, form({ email: 'attacker@example.invalid', roles: 'SYSTEM_ADMIN' })), /REDIRECT.*saved=1/);
  assert.equal(rpcCalls[0].args.email, undefined); assert.equal(rpcCalls[0].args.roles, undefined);
});
await test('MFA and conflicts return actionable messages without redirect', async () => {
  rpcError = { message: 'MFA_REAUTH_REQUIRED' }; assert.equal((await actions.saveMember({}, form())).message, '추가 인증 필요');
  rpcError = { message: 'REVISION_CONFLICT' }; assert.match((await actions.saveMember({}, form())).message, /새로고침/); rpcError = null;
});
await test('delete requires confirmation and rejects self deletion', async () => {
  const before = rpcCalls.length;
  await actions.deleteMember({}, form()); await actions.deleteMember({}, form({ confirmed: 'yes', person_id: '20000000-0000-4000-8000-000000000099' })); assert.equal(rpcCalls.length, before);
  await assert.rejects(actions.deleteMember({}, form({ confirmed: 'yes' })), /REDIRECT.*deleted=1/); assert.equal(rpcCalls.at(-1).name, 'life_delete_member');
});
const audience = load('src/lib/auth/login-audience.ts');
let directory = { items: [{ id: '20000000-0000-4000-8000-000000000001', name: '검증 회원', email: 'synthetic@example.invalid', office_position: 'DIRECTOR', instructor_kind: 'EXTERNAL', notes: '<script>alert(1)</script>', revision: 0 }], total: 1, counts: { office: 1, instructor: 1, learner: 1 } };
let reads = 0;
const page = load('src/app/admin/accounts/page.tsx', { 'next/link': 'a', 'next/navigation': mocks['next/navigation'], '@/lib/auth/login-audience': audience, '@/lib/members/model': model,
  '@/components/portal/member-notice': load('src/components/portal/member-notice.tsx'),
  '@/components/portal/ui': { PageIntro: ({ title }) => React.createElement('h1', null, title), Empty: ({ title }) => React.createElement('p', null, title) },
  '@/lib/members/data': { memberAdmin: mocks['@/lib/members/data'].memberAdmin, getMembers: async () => { reads++; return { data: directory, error: directory === null }; } },
}).default;
for (const [group, columns] of [['office', ['직책', '사무실 전화번호', '핸드폰 전화번호']], ['instructor', ['교내/교외', '강의이력', '연락처']], ['learner', ['생년월일', '수강이력', '핸드폰 전화번호']]]) await test(group + ' renders requested columns, actions and escaped data in one read', async () => {
  const before = reads; const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ group }) }));
  for (const column of columns) assert(html.includes(column)); assert(html.includes('수정') && html.includes('삭제')); assert(!html.includes('<script>')); assert.equal(reads - before, 1);
});
await test('chief is rendered from existing member data without write controls when read only', async () => {
  directory = {...directory, items:[{...directory.items[0],name:'송경영',is_super_admin:true,can_manage:false}], counts:{office:1,instructor:0,learner:0}};
  const html=renderToStaticMarkup(await page({searchParams:Promise.resolve({group:'office'})}));
  assert(html.includes('송경영') && html.includes('최고 관리자') && html.includes('단장'));
  assert(html.includes('사업단 목록') && html.includes('1명'));
  assert(!html.includes('aria-label="송경영 수정"') && !html.includes('aria-label="송경영 삭제"'));
});
await test('chief self edit link is shown independently of deletion rights', async () => {
  directory = {...directory,items:[{...directory.items[0],id:'20000000-0000-4000-8000-000000000099',can_edit:true}]};
  const html=renderToStaticMarkup(await page({searchParams:Promise.resolve({group:'office'})}));
  assert(html.includes('aria-label="송경영 수정"'));
  assert(!html.includes('aria-label="송경영 삭제"'));
});
const detail = load('src/app/admin/accounts/[id]/page.tsx', {
  'next/link':'a','next/navigation':{...mocks['next/navigation'],notFound(){throw Error('NOT_FOUND');}},
  '@/lib/auth/login-audience':audience,'@/lib/portal/data':mocks['@/lib/portal/data'],'@/lib/members/model':model,
  '@/components/portal/ui':{PageIntro:({title})=>React.createElement('h1',null,title),Empty:({title})=>React.createElement('p',null,title)},
  '@/components/portal/action-form':{ActionForm:({children,label})=>React.createElement('form',null,children,React.createElement('button',null,label))},
  '@/lib/members/data':{memberAdmin:mocks['@/lib/members/data'].memberAdmin,getMembers:async()=>({data:directory,error:false})},
  '../actions':actions,
}).default;
await test('chief can open edit form but cannot open protected delete view', async () => {
  const params=Promise.resolve({id:directory.items[0].id});
  const html=renderToStaticMarkup(await detail({params,searchParams:Promise.resolve({group:'office'})}));
  assert(html.includes('송경영 · 구성원 수정') && html.includes('변경사항 저장'));
  assert(!html.includes('view=delete'));
  await assert.rejects(detail({params,searchParams:Promise.resolve({group:'office',view:'delete'})}),/NOT_FOUND/);
  directory.items[0].can_edit=false;
  await assert.rejects(detail({params,searchParams:Promise.resolve({group:'office'})}),/NOT_FOUND/);
});
await test('failed list is not presented as an empty member database', async () => { directory = null; assert.match(renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) })), /목록을 불러오지 못했습니다/); });
console.log(`${checks} member management checks passed.`);
