// Dedicated local native Auth -> RPC -> server action -> enrollment acceptance.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";

const dir=process.env.APPLICATION_TEST_DB_DIR;
assert.ok(dir);
assert.match(readFileSync(resolve(dir,"supabase/config.toml"),"utf8"),/^project_id = "uc-life-issues"$/m);
const config=JSON.parse(execFileSync("supabase",["status","--workdir",dir,"-o","json"],{encoding:"utf8",stdio:["ignore","pipe","pipe"]}));
assert.equal(config.API_URL,"http://127.0.0.1:56321");
const {ids,password,manager}=JSON.parse(readFileSync("/tmp/u-livet-issues-browser-fixtures.json","utf8"));
const sql=q=>execFileSync("docker",["exec","-i","supabase_db_uc-life-issues","psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-qtA"],{input:q,encoding:"utf8",stdio:["pipe","pipe","pipe"]}).trim();
const ok=r=>{assert.ifError(r.error);return r.data;};
const client=()=>createClient(config.API_URL,config.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const jar=new Map();
const staff=createServerClient(config.API_URL,config.ANON_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:items=>items.forEach(({name,value})=>jar.set(name,value))}});
ok(await staff.auth.signInWithPassword({email:manager.email,password}));
const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const run=randomUUID(); const learners=[]; const checks=[];
const pass=label=>{checks.push(label);console.log("PASS "+label);};
const output=resolve("artifacts/document-link");mkdirSync(output,{recursive:true});
const date=days=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);
const makeOffering=async (name,capacity=10,publish=true)=>{
 const f=ok(await staff.rpc("life_create_offering",{o:ids.org,y:ids.year,title:name,academy:"검증",summary:"원서 연결 검증",curriculum:"합성 자료",mode:"ONLINE",location:"검증실",capacity,selection_method:"REVIEW",apply_from:new Date(Date.now()-86400000).toISOString(),apply_until:new Date(Date.now()+7*86400000).toISOString(),starts_on:date(9),ends_on:date(30)}));
 if(publish)ok(await staff.rpc("life_publish",{f,enrollment_policy:ids.enrollment,completion_policy:ids.completion}));
 return f;
};
for(let i=0;i<3;i++){
 const name=`[검증용] 원서 연결 ${run.slice(0,8)}-${i}`;const email=`link-${run}-${i}@example.invalid`;
 ok(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name,privacy_accepted:true,privacy_policy_id:ids.privacy,mobile_phone:"+821000009876"}}));
 const db=client();ok(await db.auth.signInWithPassword({email,password}));
 learners.push({db,name,person:ok(await db.rpc("life_identity")).id});
}
const pdf=Buffer.from("%PDF-1.7\n% synthetic link fixture\n%%EOF\n");
const sha=createHash("sha256").update(pdf).digest("hex");
const makeDoc=async (learner,f=null)=>{
 const r=ok(await learner.db.rpc("life_submit_learner_document",{k:"APPLICATION",f,request_key:randomUUID(),course_name:"원본 과정명",applicant_name:learner.name,phone:"01000009876",occurrence:null,amount:null,pdf_base64:pdf.toString("base64"),pdf_sha256:sha}));
 // Historical unlinked fixture: original records belonged to the document org.
 if(!f)sql(`update public.life_learner_document_requests set org_id='${ids.org}' where id='${r}'`);
 return r;
};
const mine=async (learner,r)=>ok(await learner.db.rpc("life_my_learner_documents")).find(x=>x.id===r);
const legacy=await makeDoc(learners[0]); const offering=await makeOffering("[검증용] 실제 기수 "+run.slice(0,8));
const application=ok(await learners[0].db.rpc("life_apply",{f:offering,policy:ids.enrollment}));
assert.equal((await staff.rpc("life_decide_learner_document",{r:legacy,next_status:"APPROVED",note:"",expected_revision:1})).error?.message,"LINK_REQUIRED");
assert.ok((await learners[0].db.rpc("life_link_learner_document",{r:legacy,f:offering,expected_revision:1})).error);
assert.equal((await staff.rpc("life_link_learner_document",{r:legacy,f:offering,expected_revision:9})).error?.message,"STALE_REVISION");
pass("미연결 승인·수강생 연결·오래된 버전 차단");
const original=await mine(learners[0],legacy);
const draft=await makeOffering("[검증용] 준비 기수",10,false);
const ended=await makeOffering("[검증용] 종료 기수",10,false);
sql(`update public.life_offerings set starts_on=current_date-20,ends_on=current_date-10 where id='${ended}'`);
assert.equal((await staff.rpc("life_link_learner_document",{r:legacy,f:ended,expected_revision:1})).error?.message,"OFFERING_UNAVAILABLE");
const foreign=await makeDoc(learners[1]);sql(`update public.life_learner_document_requests set org_id='${ids.otherOrg}' where id='${foreign}'`);
assert.equal((await staff.rpc("life_link_learner_document",{r:foreign,f:offering,expected_revision:1})).error?.message,"FORBIDDEN");
assert.equal(sql("select has_function_privilege('authenticated','life_private.document_registration_state(uuid)','EXECUTE')"),"f");
assert.equal(sql("select has_function_privilege('authenticated','life_private.decide_learner_document_base(uuid,text,text,integer)','EXECUTE')"),"f");
pass("종료 기수·다른 기관 연결·내부 우회 경로 차단");

const base="http://127.0.0.1:3100";
const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-p","3100","-H","127.0.0.1"],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:config.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:config.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:config.SERVICE_ROLE_KEY,AUTH_RATE_LIMIT_SECRET:randomBytes(32).toString("hex"),AUTH_SITE_ORIGIN:base,CERTIFICATE_VERIFY_ORIGIN:base,AUTH_PROFILE:"managed-cloud-v1",AUTH_EMAIL_ENABLED:"true",AUTH_SIGNUP_ENABLED:"true",AUTH_CAPTCHA_ENABLED:"false",PREVIEW_REVIEW_ONLY:"false"},stdio:"ignore"});
let browser;
try{
 let ready=false;for(let i=0;i<60;i++){try{ready=(await fetch(base+"/api/health")).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,500));}assert.ok(ready);
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addCookies([...jar].map(([name,value])=>({name,value,url:base,httpOnly:true,sameSite:"Lax"})));
 const page=await context.newPage();
 await page.goto(`${base}/admin/learner-documents?q=${encodeURIComponent(learners[0].name)}&kind=APPLICATION`);
 assert.equal(await page.locator('select[name="next_status"] option[value="APPROVED"]').count(),0);
 await page.locator('select[name="offering_id"]').selectOption(offering);await page.getByRole("button",{name:"과정 연결",exact:true}).click();
 await page.getByRole("status").filter({hasText:"개설 과정을 연결했습니다"}).waitFor();
 let row=await mine(learners[0],legacy);assert.equal(row.offering_id,offering);assert.equal(row.course_name,original.course_name);assert.equal(row.current_note,original.current_note);assert.equal(row.revision,2);
 assert.equal(sql(`select pdf_sha256 from life_private.learner_document_files where request_id='${legacy}'`),sha);
 ok(await staff.rpc("life_link_learner_document",{r:legacy,f:offering,expected_revision:1}));
 assert.equal((await mine(learners[0],legacy)).revision,2);
 assert.equal((await staff.rpc("life_link_learner_document",{r:legacy,f:draft,expected_revision:2})).error?.message,"LINK_IMMUTABLE");
 pass("실제 연결 폼·원본 이름/안내/PDF 보존·중복 이력과 재연결 방지");
 await page.locator('select[name="next_status"]').selectOption("APPROVED");await page.getByRole("button",{name:"상태 저장",exact:true}).click();
 await page.getByRole("status").filter({hasText:"승인 상태로 처리했습니다"}).waitFor();
 row=await mine(learners[0],legacy);assert.equal(row.status,"APPROVED");assert.ok(row.resolved_at);assert.equal(row.registration.application_id,application);assert.ok(row.registration.active);
 await page.getByText("수강 등록 완료 · 내 강의실에서 수업 정보를 확인할 수 있습니다.",{exact:true}).waitFor();
 await page.locator("main").screenshot({path:resolve(output,"linked-and-enrolled.png")});
 ok(await staff.rpc("life_admit_learner_document",{r:legacy,expected_revision:1}));
 assert.equal((await mine(learners[0],legacy)).revision,row.revision);
 assert.equal(sql(`select count(*) from public.life_enrollments where application_id='${application}'`),"1");
 pass("실제 빈 안내 승인→동의된 신청 등록·종결·중복 등록 방지");
 const approvedLegacy=await makeDoc(learners[1]);
 sql(`update public.life_learner_document_requests set status='APPROVED',resolved_at=now(),revision=2 where id='${approvedLegacy}'`);
 ok(await learners[1].db.rpc("life_apply",{f:offering,policy:ids.enrollment}));
 await page.goto(`${base}/admin/learner-documents?q=${encodeURIComponent(learners[1].name)}&kind=APPLICATION`);
 await page.locator('select[name="offering_id"]').selectOption(offering);await page.getByRole("button",{name:"과정 연결",exact:true}).click();
 await page.getByRole("status").filter({hasText:"개설 과정을 연결했습니다"}).waitFor();
 assert.equal((await mine(learners[1],approvedLegacy)).status,"APPROVED");
 await page.getByRole("button",{name:"수강 등록 확정",exact:true}).click();
 await page.getByRole("status").filter({hasText:"수강 등록 절차를 처리했습니다"}).waitFor();
 const approvedRow=await mine(learners[1],approvedLegacy);assert.ok(approvedRow.registration.active);assert.equal(approvedRow.status,"APPROVED");assert.equal(approvedRow.revision,4);
 await page.locator("main").screenshot({path:resolve(output,"legacy-approved-repair.png")});
 pass("기존 승인 원서도 실제 연결·등록 확정 폼으로 복구");
}finally{await browser?.close();server.kill("SIGTERM");}

const prepared=await makeDoc(learners[1]);ok(await staff.rpc("life_link_learner_document",{r:prepared,f:draft,expected_revision:1}));
ok(await staff.rpc("life_decide_learner_document",{r:prepared,next_status:"APPROVED",note:"",expected_revision:2}));
assert.equal((await staff.rpc("life_admit_learner_document",{r:prepared,expected_revision:3})).error?.message,"APPLICATION_REQUIRED");
assert.equal((await mine(learners[1],prepared)).registration.offering_status,"DRAFT");
pass("준비 기수 원서는 보관하되 신청·동의 없는 등록 차단");
const capacity=await makeOffering("[검증용] 정원 검증",1);const docs=[];
for(const learner of learners.slice(1)){
 ok(await learner.db.rpc("life_apply",{f:capacity,policy:ids.enrollment}));docs.push(await makeDoc(learner,capacity));
}
const approvals=await Promise.all(docs.map(r=>staff.rpc("life_decide_learner_document",{r,next_status:"APPROVED",note:"",expected_revision:1})));
assert.equal(approvals.filter(x=>!x.error).length,1);assert.equal(approvals.filter(x=>x.error?.message==="CAPACITY_FULL").length,1);
const losing=approvals.findIndex(x=>x.error);assert.equal((await mine(learners[losing+1],docs[losing])).status,"RECEIVED");assert.equal((await mine(learners[losing+1],docs[losing])).revision,1);
pass("동시 승인 정원 보호·실패한 원서 승인/이력 전체 되돌림");

// Paid course must reserve a seat/invoice rather than create active enrollment.
const paid=await makeOffering("[검증용] 유료 검증",10,false);
const refund=sql(`select id from public.life_policy_versions where org_id='${ids.org}' and kind='REFUND' and status='APPROVED' order by version desc limit 1`);
ok(await staff.rpc("life_configure_finance",{f:paid,tuition:300000,policy:refund,hours:24,instructions:"실제 납부 금지 · 합성 검증"}));
ok(await staff.rpc("life_publish",{f:paid,enrollment_policy:ids.enrollment,completion_policy:ids.completion}));
const paidApp=ok(await learners[2].db.rpc("life_apply",{f:paid,policy:ids.enrollment}));const paidDoc=await makeDoc(learners[2],paid);
ok(await staff.rpc("life_decide_learner_document",{r:paidDoc,next_status:"APPROVED",note:"",expected_revision:1}));
const paidState=(await mine(learners[2],paidDoc)).registration;assert.equal(paidState.application_status,"PENDING_PAYMENT");assert.equal(paidState.active,false);
assert.equal(sql(`select count(*) from public.life_invoices where application_id='${paidApp}'`),"1");
pass("유료 원서 승인→납부 대기·청구서 발행·납부 전 등록 방지");

const consentCourse=await makeOffering("[검증용] 동의 검증");const consentApp=ok(await learners[1].db.rpc("life_apply",{f:consentCourse,policy:ids.enrollment}));const consentDoc=await makeDoc(learners[1],consentCourse);
sql(`update public.life_consent_events set accepted=false where person_id='${learners[1].person}' and policy_id='${ids.enrollment}' and source='APPLICATION'`);
assert.equal((await staff.rpc("life_decide_learner_document",{r:consentDoc,next_status:"APPROVED",note:"",expected_revision:1})).error?.message,"CONSENT_REQUIRED");
assert.equal((await mine(learners[1],consentDoc)).status,"RECEIVED");
sql(`update public.life_consent_events set accepted=true where person_id='${learners[1].person}' and policy_id='${ids.enrollment}' and source='APPLICATION';update public.life_offerings set status='DRAFT' where id='${consentCourse}'`);
assert.equal((await staff.rpc("life_decide_learner_document",{r:consentDoc,next_status:"APPROVED",note:"",expected_revision:1})).error?.message,"OFFERING_UNAVAILABLE");
assert.equal(sql(`select status from public.life_applications where id='${consentApp}'`),"SUBMITTED");
pass("동의 누락·미개설 과정의 원서 승인/등록 우회 차단");

// Exercise the exact migration repair against a synthetic historical document.
const repaired=await makeDoc(learners[2]);const title="보존된 원본 "+run.slice(0,8);const guide="link-test-"+run;
sql(`update public.life_learner_document_requests set course_name='${title}',status='APPROVED',resolved_at=now(),current_note='기존 안내' where id='${repaired}';
 insert into public.life_course_guides(id,year,sort_order,name,academy,summary,mode,capacity,teaching_hours,period_label,time_label,location,offering_id,published) values('${guide}',2099,10000+(select coalesce(max(sort_order),0) from public.life_course_guides where year=2099),'${title}','검증','합성 자료','ONLINE',10,10,'검증','검증','검증','${offering}',true);`);
const beforeRepair=await mine(learners[2],repaired);
const migration=readFileSync("supabase/migrations/20261007113241_application_document_link.sql","utf8");
sql(migration.slice(migration.indexOf("do $$",migration.indexOf("-- Historical repair")),migration.indexOf("-- Rebind wrappers")));
const afterRepair=await mine(learners[2],repaired);assert.equal(afterRepair.offering_id,offering);assert.equal(afterRepair.status,beforeRepair.status);assert.equal(afterRepair.course_name,title);assert.equal(afterRepair.current_note,"기존 안내");assert.equal(afterRepair.resolved_at,beforeRepair.resolved_at);assert.equal(afterRepair.revision,beforeRepair.revision+1);
assert.equal(sql(`select pdf_sha256 from life_private.learner_document_files where request_id='${repaired}'`),sha);
pass("고유 안내 연결 복구가 PDF/이름/승인/안내/최초 종결 시각 보존");
for(const learner of learners)await learner.db.auth.signOut({scope:"local"});await staff.auth.signOut({scope:"local"});
writeFileSync(resolve(output,"result.json"),JSON.stringify({checks,passed:checks.length},null,2)+"\n");
console.log(`${checks.length} document link checks passed.`);
