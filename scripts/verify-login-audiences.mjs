import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let passed = 0;
const check = (label, condition) => { assert.ok(condition, label); passed++; console.log('PASS ' + label); };
function load(path, modules = {}, env = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText,
    {exports, URL, process: {env}, require: name => { if (name in modules) return modules[name]; throw Error(name); }});
  return exports;
}
const audience = load('src/lib/auth/login-audience.ts');
const reg = load('src/lib/auth/registration.ts');
const providers = load('src/lib/auth/social-providers.ts', {'server-only': {}});
const policy = load('src/lib/auth/password-policy.ts');
for (const value of ['name@uc.ac.kr', 'NAME@UC.AC.KR']) check('school domain accepted', audience.isSchoolEmail(value));
for (const value of ['name@uc.ac.kr.evil.invalid', 'name@gmail.com', 'name@other.uc.ac.kr', 'a@b@uc.ac.kr']) check('other and forged school domain rejected', !audience.isSchoolEmail(value));
check('unknown login audience rejected', audience.loginAudience('SYSTEM_ADMIN') === null);
check('providers stay closed until explicitly configured', !providers.socialProviderEnabled('google') && !providers.socialProviderEnabled('naver'));
check('unknown social provider rejected', providers.socialProvider('github') === null);
function mock({actual='learner', roles=[], mfa=false, contextError=false, env={}}={}) {
  const calls=[];
  const client={auth:{signInWithPassword:async()=>{calls.push('password');return {data:{},error:null};},signOut:async()=>calls.push('signOut'),signInWithOAuth:async input=>{calls.push(input);return {data:{url:'https://db.example.invalid/auth/v1/authorize'}};}},rpc:async name=>{
    calls.push(name);
    if(name==='life_auth_status')return {data:{active:true,needs_reset:false}};
    if(name==='life_security_status')return {data:{active:true,needs_reset:false,mfa_required:mfa,mfa_verified:false}};
    if(name==='life_login_context')return {data:contextError?null:{audience:actual,roles},error:contextError?{}:null};
    if(name==='life_identity')return {data:{id:'person'}};throw Error(name);
  }};
  const modules={
    'next/navigation':{redirect:url=>{throw Error('REDIRECT '+url);}},'next/cache':{revalidatePath:()=>{}},
    '@/lib/supabase/server':{createServerSupabaseClient:async()=>client},'@/lib/auth/session':{safeReturnTo:reg.socialReturnTo},
    '@/lib/auth/social':{},'@/lib/auth/registration':reg,'@/lib/auth/login-audience':audience,
    '@/lib/auth/abuse':{guardAuthRequest:async()=>({allowed:true}),authProviderError:()=>null},
    '@/lib/auth/email-config':{},'@/lib/auth/signup-config':{},'@/lib/auth/password-policy':policy,
    '@/lib/auth/recovery':{recoveryOrigin:()=> 'https://life.example.invalid'},'@/lib/supabase/config':{getSupabaseConfig:()=>({url:'https://db.example.invalid'})},
    '@/lib/deployment/review-mode':{isReviewOnly:()=>false},'@/lib/auth/social-providers':load('src/lib/auth/social-providers.ts',{'server-only':{}},env),
  };
  return {calls,password:load('src/app/auth/actions.ts',modules),social:load('src/app/auth/social-actions.ts',modules)};
}
function form(values={}) {const f=new FormData();for(const[k,v]of Object.entries({email:'teacher@uc.ac.kr',password:'SyntheticPassword123!',audience:'learner',...values}))f.set(k,v);return f;}
{
  const m=mock();check('school domain checked before authentication',(await m.password.authenticate({},form({audience:'internal',email:'teacher@example.invalid'}))).message.includes('학교 이메일') && m.calls.length===0);
}
for(const requested of ['office','internal']){
  const m=mock();const r=await m.password.authenticate({},form({audience:requested}));check('learner cannot enter '+requested+' account route',!!r.message && m.calls.includes('signOut'));
}
for(const [actual,roles]of [['learner',[]],['internal',['INSTRUCTOR']],['external',['INSTRUCTOR']],['office',['SYSTEM_ADMIN']],['office',['COURSE_MANAGER']]]){
  const m=mock({actual,roles});await assert.rejects(m.password.authenticate({},form({audience:actual})),/^Error: REDIRECT \/$/);check(actual+' defaults to personal home',true);
  for (const next of ['/mypage','/courses/123/apply','/mypage/instructor']) {
    await assert.rejects(m.password.authenticate({},form({audience:actual,next})),e=>e.message==='REDIRECT '+next);
    check(actual+' preserves explicit work destination '+next,true);
  }
}
{
  const m=mock({actual:'office',roles:['SYSTEM_ADMIN'],mfa:true});await assert.rejects(m.password.authenticate({},form({audience:'office'})),/REDIRECT \/auth\/security\?next=%2F$/);check('office MFA precedes personal home',true);
  await assert.rejects(m.password.authenticate({},form({audience:'office',next:'/admin/accounts'})),/REDIRECT \/auth\/security\?next=%2Fadmin%2Faccounts$/);check('office MFA retains explicit destination',true);
}
{const m=mock();await assert.rejects(m.password.signOut(),/^Error: REDIRECT \/$/);check('sign out returns to entry point',m.calls.includes('signOut'));}
{
  const m=mock({contextError:true});check('classification failure signs out',(await m.password.authenticate({},form())).message && m.calls.includes('signOut'));
}
for(const requested of ['office','internal']){
  const m=mock();check('forged social audience blocked: '+requested,(await m.social.loginWithSocial({},form({provider:'kakao',audience:requested}))).message.includes('이메일') && m.calls.length===0);
}
for(const provider of ['google','naver','github']){
  const m=mock();check('unconfigured provider is blocked: '+provider,(await m.social.loginWithSocial({},form({provider}))).message.includes('준비 중') && m.calls.length===0);
}
for(const [provider,expected]of [['kakao','kakao'],['google','google'],['naver','custom:naver']]){
  const m=mock({env:{AUTH_GOOGLE_ENABLED:'true',AUTH_NAVER_ENABLED:'true'}});
  await assert.rejects(m.social.loginWithSocial({},form({provider,audience:'external'})),/REDIRECT https:\/\/db.example.invalid/);
  const call=m.calls.find(c=>typeof c==='object');check(provider+' uses fixed provider and personal home callback',call.provider===expected && call.options.redirectTo==='https://life.example.invalid/auth/callback?next=%2F');
  if (provider === 'google') {
    check('Google requests identity and email without profile access', call.options.queryParams.scope === 'openid email' && !call.options.scopes);
    check('Google does not combine previously granted profile scopes', call.options.queryParams.include_granted_scopes === 'false');
  }
}
console.log(`${passed} login audience and provider checks passed; no network, accounts or mail.`);
