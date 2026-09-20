import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let passed=0;
const check=(label,condition)=>{assert.ok(condition,label);passed++;console.log('PASS '+label);};
function load(path,modules={}) {
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,URL,process:{env:{}},require:n=>{if(n in modules)return modules[n];throw Error('Unexpected dependency '+n);}});
 return exports;
}
const reg=load('src/lib/auth/registration.ts');
const audiences=load('src/lib/auth/login-audience.ts');
const providers=load('src/lib/auth/social-providers.ts',{'server-only':{}});
for(const n of ['010-1234-5678','01012345678','+82 10 1234 5678'])check('mobile normalized '+n,reg.normalizeMobilePhone(n)==='+821012345678');
for(const n of [null,'','010123','0212345678','010<script>','010123456789','+1 555 1234567'])check('invalid or absent phone rejected',reg.normalizeMobilePhone(n)===null);
for(const n of ['https://example.invalid','//example.invalid','/%2fexample.invalid','/foo/../auth/callback','/auth/security?next=/admin','/%5cexample.invalid','/%0a','/%'])check('unsafe OAuth return path rejected',reg.socialReturnTo(n)==='/mypage');
check('legitimate work path retained',reg.socialReturnTo('/courses/123/apply?view=1')==='/courses/123/apply?view=1');
check('untrusted provider error text suppressed',reg.socialLoginError('<script>')===null);
function mock({state='PENDING',enabled=true,guard=true,user=true,policy=true,rpcError=false,mfa=false}={}) {
 const calls=[];
 const client={auth:{getUser:async()=>({data:{user:user?{id:'user-1'}:null}}),signOut:async()=>{calls.push('signOut');},signInWithOAuth:async input=>{calls.push(['oauth',input]);return {data:{url:'https://db.example.invalid/auth/v1/authorize?provider=kakao'}};}},rpc:async(name,args)=>{
 calls.push([name,args]);if(name==='life_registration_status')return {data:{state}};
 if(name==='life_security_status')return {data:{active:true,needs_reset:false,mfa_required:mfa,mfa_verified:false}};
 if(name==='life_login_context')return {data:{audience:'learner',roles:[],office_position:null,instructor_kind:null}};
 if(name==='life_identity')return {data:{id:'person-1'}};
 if(name==='life_complete_registration')return {error:rpcError?{}:null};
 if(name==='life_signup_policy')return {data:'policy-1'};throw Error(name);
 }};
 const base={'server-only':{},'@/lib/supabase/server':{createServerSupabaseClient:async()=>client},'@/lib/portal/data':{getPolicies:async()=>policy?[{id:'policy-1'}]:[]},'./signup-config':{publicSignupEnabled:()=>enabled},'./registration':reg,'./login-audience':audiences};
 const social=load('src/lib/auth/social.ts',base);
 const actions=load('src/app/auth/social-actions.ts',{
 'next/navigation':{redirect:url=>{throw Error('REDIRECT '+url);}},'next/cache':{revalidatePath:()=>{}},'@/lib/supabase/server':base['@/lib/supabase/server'],
 '@/lib/auth/abuse':{guardAuthRequest:async(...args)=>{calls.push(['guard',...args]);return guard?{allowed:true}:{allowed:false,state:{message:'LIMIT'}};}},
 '@/lib/auth/recovery':{recoveryOrigin:()=> 'https://uc-life.example.invalid'},'@/lib/supabase/config':{getSupabaseConfig:()=>({url:'https://db.example.invalid'})},
 '@/lib/deployment/review-mode':{isReviewOnly:()=>false},'@/lib/auth/social':social,'@/lib/auth/signup-config':{publicSignupEnabled:()=>enabled,PUBLIC_SIGNUP_PENDING:'CLOSED'},'@/lib/auth/registration':reg,'@/lib/auth/login-audience':audiences,'@/lib/auth/social-providers':providers});
 return {calls,social,actions};
}
function form(values={}) {const f=new FormData();for(const[k,v]of Object.entries({name:'Synthetic',phone:'010-1234-5678',privacy_policy_id:'policy-1',privacy_accepted:'on',next:'/courses',...values}))f.set(k,v);return f;}
{
 const m=mock();await assert.rejects(m.actions.loginWithKakao({},form({next:'//evil.invalid'})),/REDIRECT https:\/\/db.example.invalid/);
 const input=m.calls.find(c=>c[0]==='oauth')[1];check('Kakao PKCE uses fixed site origin and safe return path',input.provider==='kakao' && input.options.redirectTo==='https://uc-life.example.invalid/auth/callback?next=%2Fmypage');
 check('OAuth rate limit uses separate flow',m.calls.find(c=>c[0]==='guard')[4]==='oauth');
 check('unneeded nickname and photo scopes are omitted',input.options.queryParams.scope==='account_email');
}
{const m=mock({guard:false});check('rate limit prevents OAuth start',(await m.actions.loginWithKakao({},form())).message==='LIMIT'&&!m.calls.some(c=>c[0]==='oauth'));}
for(const [state,expected]of [['PENDING','/auth/complete-signup'],['EMAIL_LOGIN_REQUIRED','social_error=staff'],['CLOSED','social_error=closed'],['UNAVAILABLE','social_error=unavailable'],['COMPLETE','/courses']]){const m=mock({state});check('callback destination for '+state,(await m.social.socialDestination('/courses')).includes(expected));}
{const m=mock({state:'COMPLETE',mfa:true});check('OAuth learner retains configured MFA',(await m.social.socialDestination('/courses')).startsWith('/auth/security?next='));}
for(const [options,values]of [[{enabled:false},{}],[{}, {phone:''}],[{}, {privacy_accepted:''}],[{user:false},{}],[{policy:false},{}]]) {const m=mock(options);const r=await m.actions.completeKakaoSignup({},form(values));check('incomplete signup rejected before DB write',!!r.message&&!m.calls.some(c=>c[0]==='life_complete_registration'));}
{const m=mock({rpcError:true});check('DB failure does not report successful signup',!(await m.actions.completeKakaoSignup({},form())).ok);}
{
 const m=mock({state:'COMPLETE'});await assert.rejects(m.actions.completeKakaoSignup({},form({role:'SYSTEM_ADMIN',phone_verified_at:'now'})),/REDIRECT \/courses/);
 const args=m.calls.find(c=>c[0]==='life_complete_registration')[1];check('only allowed registration fields reach DB',args.p_phone==='+821012345678' && Object.keys(args).sort().join(',')==='p_accepted,p_name,p_phone,p_policy');
}
console.log(`${passed} Kakao signup checks passed. No network or accounts created.`);
