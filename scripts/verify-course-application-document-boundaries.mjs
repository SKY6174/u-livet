// Own-profile allowlist and server page boundaries; synthetic data, no database.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import ts from "typescript";
import React from "react";
const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => name in mocks ? mocks[name]
    : name.startsWith(".") ? load(resolve(dirname(file), name + ".ts")) : require(name), module, module.exports);
  return module.exports;
}
let checks = 0;
async function test(label, run) { await run(); checks++; console.log("PASS " + label); }
const model = load("src/lib/learner-documents/model.ts");
await test("signup +82, domestic and native 82 phones become document phone", () => {
  for (const phone of ["+821012345678", "010-1234-5678"]) assert.equal(model.learnerDocumentProfile({mobile_phone:phone}).phone,"010-1234-5678");
  assert.equal(model.learnerDocumentProfile({mobile_phone:"+821000000000"},"821012345678").phone,"010-1234-5678");
  assert.equal(model.learnerDocumentProfile({mobile_phone:"+821012345678"},"invalid").phone,"010-1234-5678");
});
await test("profile accepts only valid existing birthdate and never copies consent or secrets", () => {
  assert.deepEqual(model.learnerDocumentProfile({mobile_phone:123,birth_date:"2026-02-30",password:"secret",privacy_accepted:true}),{phone:"",birthDate:""});
  assert.equal(model.learnerDocumentProfile({birth_date:"9999-01-01"}).birthDate,"");
  const profile=model.learnerDocumentProfile({birth_date:"1990-02-28",mobile_phone:"+821012345678",privacy_accepted:true});
  const values=model.initialValues("합성 회원","synthetic@example.invalid","A과정","",null,profile);
  assert.equal(values.birthDate,"1990-02-28");assert.equal(values.phone,"010-1234-5678");
  for(const key of ["privacy","publicity","portrait","signature","residentFront","residentBack","address","account"]) assert.equal(values[key],"");
});
await test("document URLs contain only type and selected ID", () => {
  const query=new URL(model.applicationDocumentHref("2026-example-course"),"https://example.invalid").searchParams;
  assert.deepEqual([...query.keys()],["type","course"]);assert.equal(query.get("course"),"2026-example-course");
});
let authError=false, returnTo, reads=0;
const profileApi=load("src/lib/learner-documents/profile.ts",{"server-only":{},"./model":model,
  "@/lib/supabase/server":{createServerSupabaseClient:async()=>({auth:{getUser:async()=>{reads++;return authError?{data:{user:null},error:new Error("read")}
    :{data:{user:{phone:"821012345678",user_metadata:{mobile_phone:"+821000000000",birth_date:"1990-02-28",unrelated:"private"}}},error:null};}}})}});
await test("server profile reads authenticated self and exposes only document fields",async()=>{
  assert.deepEqual(await profileApi.getLearnerDocumentProfile(),{phone:"010-1234-5678",birthDate:"1990-02-28",unavailable:false});assert.equal(reads,1);
  authError=true;assert.deepEqual(await profileApi.getLearnerDocumentProfile(),{phone:"",birthDate:"",unavailable:true});authError=false;
});
const course={id:"2026-example-course",name:"A과정",offeringId:"10000000-0000-4000-8000-000000000099",tuition:0};
let courses=[course],unavailable=false;
const page=load("src/app/mypage/documents/page.tsx",{
  "next/link":"a","next/navigation":{notFound:()=>{throw Error("404");}},
  "@/lib/auth/session":{requireIdentity:async path=>{returnTo=path;return{name:"합성 회원",email:"synthetic@example.invalid"};}},
  "@/lib/course-guide/data":{getCourseCatalog:async()=>({courses,unavailable})},
  "@/components/learner-documents/editor":{LearnerDocumentEditor:()=>null},
  "@/lib/learner-documents/model":model,"@/lib/learner-documents/profile":profileApi,
  "@/lib/portal/data":{UUID:/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i},
  "@/components/portal/ui":{Empty:({title,children})=>React.createElement("div",null,title,children)},
  "@/lib/learner-document-workflow/data":{getMyLearnerDocuments:async()=>[],getLearnerDocumentEligibility:async()=>[]},
}).default;
const render=query=>page({searchParams:Promise.resolve(query)});
await test("guide slug and offering UUID select same course and preserve login return URL",async()=>{
  for(const id of [course.id,course.offeringId]){const view=await render({course:id,type:"application"});assert.deepEqual(view.props.initialCourse,course);
    assert.equal(returnTo,`/mypage/documents?type=application&course=${id}`);assert.equal(view.props.profile.phone,"010-1234-5678");}
});
await test("invalid, repeated, oversized and nonexistent course selection returns404",async()=>{
  for(const id of ["../private","a".repeat(101),[course.id,course.id],"10000000-0000-4000-8000-000000000088"])
    await assert.rejects(render({course:id}),/404/);
});
await test("unknown type falls back; catalog and own-profile failures show actionable fallback",async()=>{
  assert.equal((await render({type:["refund","application"]})).props.type,"application");
  authError=true;assert.equal((await render({})).props.profileUnavailable,true);authError=false;
  courses=[];unavailable=true;const fallback=await render({course:course.id});assert.equal(fallback.props.children[1].props.href,"/mypage/documents");
});
let options,refresh=false;
const middleware=load("src/middleware.ts",{
  "next/server":{NextResponse:{next:input=>{options=input;return{headers:new Headers(),cookies:{set(){}}};}}},
  "@/lib/supabase/config":{getSupabaseConfig:()=>({url:"https://example.invalid",key:"synthetic"})},
  "@/lib/deployment/review-mode":{isReviewOnly:()=>false},
  "@supabase/ssr":{createServerClient:(url,key,input)=>({auth:{getUser:async()=>{if(refresh)input.cookies.setAll([{name:"auth",value:"refreshed",options:{}}]);}}})},
}).middleware;
const request=(pathname,search="")=>({method:"GET",headers:new Headers({"x-u-live-document-return-to":"/forged"}),nextUrl:{pathname,search},cookies:{getAll:()=>[],set(){},toString:()=>"auth=refreshed"}});
await test("protected layout receives actual document URL and spoofed headers are overwritten",async()=>{
  for(const renew of [false,true]){refresh=renew;await middleware(request("/mypage/documents",`?type=application&course=${course.id}`));
    assert.equal(options.request.headers.get("x-u-live-document-return-to"),`/mypage/documents?type=application&course=${course.id}`);
    if(renew)assert.equal(options.request.headers.get("cookie"),"auth=refreshed");}
  await middleware(request("/courses"));assert.equal(options.request.headers.get("x-u-live-document-return-to"),null);
});
console.log(`${checks} application document boundary checks passed.`);
