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
  "@/lib/learner-profile/data":{getLearnerProfile:async()=>({phone:""})},
  "@/lib/supabase/server":{createServerSupabaseClient:async()=>({auth:{getUser:async()=>{reads++;return authError?{data:{user:null},error:new Error("read")}
    :{data:{user:{phone:"821012345678",user_metadata:{mobile_phone:"+821000000000",birth_date:"1990-02-28",unrelated:"private"}}},error:null};}}})}});
await test("server profile reads authenticated self and exposes only document fields",async()=>{
  assert.deepEqual(await profileApi.getLearnerDocumentProfile(),{phone:"010-1234-5678",birthDate:"1990-02-28",unavailable:false});assert.equal(reads,1);
  authError=true;assert.deepEqual(await profileApi.getLearnerDocumentProfile(),{phone:"",birthDate:"",unavailable:true});authError=false;
});
const course={id:"2026-example-course",name:"A과정",offeringId:"10000000-0000-4000-8000-000000000099",tuition:0,period_label:"2026-10-10 ~ 2026-11-10"};
const documentCourse={id:course.id,name:course.name,offeringId:course.offeringId,tuition:course.tuition,periodLabel:course.period_label};
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
  for(const id of [course.id,course.offeringId]){const view=await render({course:id,type:"application"});assert.deepEqual(view.props.initialCourse,documentCourse);
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
await test("only actual offering IDs reach the editor, including distinct same-name cohorts",async()=>{
  const second={...course,id:"second-guide",offeringId:"10000000-0000-4000-8000-000000000098",period_label:"2026-11-10 ~ 2026-12-10"};
  courses=[course,second,{...course,id:"unlinked-guide",offeringId:null},{...course,id:"invalid-guide",offeringId:"unknown"}];unavailable=false;
  const view=await render({});assert.deepEqual(view.props.courses.map(c=>c.offeringId),[course.offeringId,second.offeringId]);
  assert.equal(view.props.courses[1].periodLabel,second.period_label);
  await assert.rejects(render({course:"unlinked-guide"}),/404/);
  unavailable=true;assert.deepEqual((await render({})).props.courses,[]);assert.equal((await render({})).props.coursesUnavailable,true);
  courses=[];unavailable=false;assert.deepEqual((await render({})).props.courses,[]);assert.equal((await render({})).props.coursesUnavailable,false);
});
let dbReads=0,pdfRenders=0,lookup=course,submitted;
const action=load("src/app/mypage/documents/actions.ts",{
  "next/cache":{revalidatePath(){}},"@/lib/auth/session":{requireIdentity:async()=>({id:"synthetic"})},
  "@/lib/learner-documents/model":model,"@/lib/learner-document-workflow/types":{DOCUMENT_KIND:{application:"APPLICATION"}},
  "@/lib/portal/data":{UUID:/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i},
  "@/lib/learner-documents/pdf":{renderLearnerDocument:async()=>{pdfRenders++;return Buffer.from("%PDF-1.7\nsynthetic\n");}},
  "@/lib/supabase/server":{createServerSupabaseClient:async()=>{dbReads++;const query={select(){return this;},eq(){return this;},maybeSingle:async()=>({data:lookup,error:null})};
    return{from:()=>query,rpc:async(name,args)=>{submitted=args;return{data:"synthetic-request",error:null};}};}}
}).submitLearnerDocument;
const values={...model.initialValues("합성 회원","synthetic@example.invalid","위조된 과정명",course.offeringId),phone:"01012345678",birthDate:"1990-02-28",gender:"female",address:"가상로 1",purposes:["자기계발"],privacy:"yes",publicity:"no",portrait:"no",signature:"synthetic-signature"};
const submit=overrides=>action({type:"application",requestKey:"10000000-0000-4000-8000-000000000011",values:{...values,...overrides}});
await test("missing or malformed offering is blocked before database or PDF work",async()=>{
  for(const offeringId of ["","custom-course","../private"]) {const result=await submit({offeringId});assert.equal(result.ok,false);assert.ok(result.fieldErrors.courseName);assert.ok(model.documentErrors("application",{...values,offeringId}).courseName);}
  assert.equal(dbReads,0);assert.equal(pdfRenders,0);
});
await test("unknown DB offering is blocked and actual course name overrides client text",async()=>{
  lookup=null;assert.equal((await submit({})).ok,false);assert.equal(pdfRenders,0);
  lookup={id:course.offeringId,name:course.name,tuition:0};assert.equal((await submit({})).ok,true);
  assert.equal(submitted.f,course.offeringId);assert.equal(submitted.course_name,course.name);assert.equal(pdfRenders,1);
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
