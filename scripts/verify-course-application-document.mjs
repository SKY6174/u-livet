// Real popup/login/prefill/edit/submit/PDF flow in dedicated local Supabase only.
// First run verify-application-flow.mjs to create private synthetic fixtures.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const dbDir = process.env.APPLICATION_TEST_DB_DIR;
assert.ok(dbDir, "Dedicated APPLICATION_TEST_DB_DIR is required.");
assert.match(readFileSync(resolve(dbDir,"supabase/config.toml"),"utf8"),/^project_id = "uc-life-issues"$/m);
const status=JSON.parse(execFileSync("supabase",["status","--workdir",dbDir,"-o","json"],{encoding:"utf8",stdio:["ignore","pipe","pipe"]}));
assert.equal(status.API_URL,"http://127.0.0.1:56321");
const container="supabase_db_uc-life-issues";
assert.equal(JSON.parse(execFileSync("docker",["inspect",container],{encoding:"utf8"}))[0].Config.Labels["com.supabase.cli.project"],"uc-life-issues");
const sql=query=>execFileSync("docker",["exec","-i",container,"psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-tA"],{input:query,encoding:"utf8",stdio:["pipe","pipe","pipe"]}).trim();
const {ids,learner,password}=JSON.parse(readFileSync("/tmp/u-livet-issues-browser-fixtures.json","utf8"));
for(const id of [ids.offering,ids.org,learner.person]) assert.match(id,/^[0-9a-f-]{36}$/);
const guide=sql(`select id from public.life_course_guides where offering_id='${ids.offering}';`) || `application-test-${randomUUID()}`,second=randomUUID();
const beforeDocuments=sql(`select count(*) from public.life_learner_document_requests where person_id='${learner.person}';`);
const firstName=sql(`select name from public.life_offerings where id='${ids.offering}';`);
assert.ok(firstName.startsWith("[검증용]"));
const secondName="[검증용] B 과정 원서 연결";
sql(`begin;
insert into public.life_course_guides(id,year,sort_order,name,academy,summary,curriculum,mode,capacity,teaching_hours,period_label,time_label,location,offering_id,published,org_id)
select '${guide}',2026,(select max(sort_order)+1 from public.life_course_guides where year=2026),name,'디지털 역량','합성 과정 A 원서 연결',array['합성 검증'],mode,capacity,10,'검증용 기간','검증용 시간',location,id,true,org_id
from public.life_offerings where id='${ids.offering}' on conflict(offering_id) do nothing;
insert into public.life_offerings(id,org_id,project_year_id,course_version_id,name,mode,location,capacity,tuition,selection_method,status,apply_from,apply_until,starts_on,ends_on,enrollment_policy_id)
select '${second}',org_id,project_year_id,course_version_id,'${secondName}',mode,location,capacity,tuition,selection_method,status,apply_from,apply_until,starts_on,ends_on,enrollment_policy_id
from public.life_offerings where id='${ids.offering}';
commit;`);
const output=resolve("artifacts/course-application-document");mkdirSync(output,{recursive:true});
const base="http://127.0.0.1:3101",checks=[];
const pass=label=>{checks.push(label);console.log("PASS "+label);};
const app=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-p","3101","-H","127.0.0.1"],{
  env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:status.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:status.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY,
    AUTH_RATE_LIMIT_SECRET:randomBytes(32).toString("hex"),AUTH_TRUSTED_IP_HEADER:"",AUTH_CAPTCHA_ENABLED:"false",AUTH_SITE_ORIGIN:base,CERTIFICATE_VERIFY_ORIGIN:base,
    AUTH_PROFILE:"managed-cloud-v1",AUTH_EMAIL_ENABLED:"true",AUTH_SIGNUP_ENABLED:"true",PREVIEW_REVIEW_ONLY:"false"},stdio:["ignore","ignore","pipe"]});
app.stderr.on("data",chunk=>{if(/EADDRINUSE/.test(String(chunk))) console.error("Port3101 is occupied.");});
let browser;
async function prefilled(page,name) {
  await page.locator("select#courseName").waitFor();
  assert.ok((await page.locator("#courseName option:checked").textContent()).startsWith(name));
  assert.match(await page.locator("#courseName").inputValue(),/^[0-9a-f-]{36}$/);
  assert.equal(await page.locator("#name").inputValue(),learner.name);
  assert.equal(await page.locator("#email").inputValue(),learner.email);
  assert.equal(await page.locator("#phone").inputValue(),"010-0000-1211");
}
async function popupFrom(page) {
  const waiting=page.context().waitForEvent("page");
  await page.getByRole("link",{name:"수강신청원서 작성",exact:true}).click();
  const popup=await waiting;await popup.waitForLoadState("domcontentloaded");return popup;
}
try {
  let ready=false;
  for(let i=0;i<60;i++){try{ready=(await fetch(`${base}/api/health`)).ok;}catch{}if(ready)break;
    if(app.exitCode!==null)throw Error("Local production app exited.");await new Promise(r=>setTimeout(r,500));}
  assert.ok(ready);browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  await page.goto(`${base}/courses/${guide}`);
  assert.equal(await page.getByRole("link",{name:"수강신청원서 작성",exact:true}).getAttribute("href"),`/mypage/documents?type=application&course=${guide}`);
  const popup=await popupFrom(page);
  await popup.waitForURL(/\/auth\/login\?/);
  const next=new URL(popup.url()).searchParams.get("next");assert.equal(next,`/mypage/documents?type=application&course=${guide}`);
  pass("비로그인 A 소개 → 실제 팝업 → 로그인 URL에 과정 유지");
  await popup.locator('nav[aria-label="로그인 대상 선택"] a[href*="audience=learner"]').click();
  await popup.waitForURL(url=>url.searchParams.get("audience")==="learner");
  const toggle=popup.getByRole("button",{name:"이메일로 로그인",exact:true});await toggle.waitFor();await toggle.click();
  await popup.locator('input[name="email"]').fill(learner.email);await popup.locator('input[name="password"]').fill(password);
  await popup.getByRole("button",{name:"로그인",exact:true}).click();await popup.waitForURL(`${base}${next}`);
  await prefilled(popup,firstName);pass("실제 로그인 후 A 과정·가입 성명·이메일·휴대전화 자동 입력");
  assert.equal(await popup.locator("#birthDate").inputValue(),"");assert.equal(await popup.locator("#address").inputValue(),"");
  assert.equal(await popup.locator('input[type="radio"]:checked').count(),0);
  assert.equal(await popup.getByAltText("현재 적용 서명").count(),0);
  assert.equal(sql(`select count(*) from public.life_learner_document_requests where person_id='${learner.person}';`),beforeDocuments);
  pass("없는 가입 항목·서명·동의는 빈칸이며 팝업 열기만으로 접수되지 않음");
  await popup.getByRole("img",{name:"입력 내용이 반영된 PDF 미리보기"}).waitFor({timeout:60000});
  await popup.locator("#signature canvas").waitFor();
  await popup.setViewportSize({width:360,height:900});
  assert.ok(await popup.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await popup.screenshot({path:resolve(output,"prefill-mobile.png"),fullPage:true});
  await popup.setViewportSize({width:1440,height:1000});
  await popup.getByRole("img",{name:"입력 내용이 반영된 PDF 미리보기"}).waitFor();
  await popup.screenshot({path:resolve(output,"prefill-desktop.png"),fullPage:true});
  pass("360px 모바일·1440px 데스크톱 원서 입력 및 가로 넘침 없음");
  await popup.locator("#name").fill("수정한 합성 회원");assert.equal(await popup.locator("#name").inputValue(),"수정한 합성 회원");
  await popup.locator("#name").fill(learner.name);pass("자동 입력된 가입 정보도 직접 수정 가능");
  popup.on("dialog",dialog=>dialog.accept());await popup.close();
  await page.goto(`${base}/offerings/${second}`);const secondPopup=await popupFrom(page);await prefilled(secondPopup,secondName);await secondPopup.close();
  pass("B 모집 과정에서 다시 열면 A 대신 B 과정으로 입력");
  await page.goto(`${base}/offerings/${ids.offering}/apply`);
  assert.equal(await page.getByRole("link",{name:"이 과정의 수강신청원서 작성"}).getAttribute("href"),`/mypage/documents?type=application&course=${ids.offering}`);
  await page.goto(`${base}/mypage`);await page.getByText("신청 현황",{exact:false}).first().click();
  assert.ok(await page.locator(`a[href="/mypage/documents?type=application&course=${ids.offering}"]`).count());
  pass("기존 신청 화면과 나의 신청 현황에서도 같은 과정 원서 연결");
  await page.goto(`${base}/courses/${guide}`);await page.evaluate(()=>{window.open=()=>null;});
  await page.getByRole("link",{name:"수강신청원서 작성",exact:true}).click();
  assert.equal(await page.getByRole("link",{name:"새 탭에서 입력 화면 열기"}).getAttribute("href"),`/mypage/documents?type=application&course=${guide}`);
  pass("팝업 차단 시 같은 과정의 새 탭 대체 링크 제공");
  await page.reload();const submission=await popupFrom(page);await prefilled(submission,firstName);
  await submission.locator("#birthDate").fill("1990-02-28");await submission.locator('input[name="gender"]').first().check();
  await submission.locator("#address").fill("울산광역시 가상로 123");await submission.getByLabel("자기계발",{exact:true}).check();
  await submission.locator('input[name="privacy"][value="yes"]').check();
  for(const name of ["publicity","portrait"])await submission.locator(`input[name="${name}"][value="no"]`).check();
  const canvas=submission.locator("#signature canvas");await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();assert.ok(box);
  await submission.mouse.move(box.x+box.width*.2,box.y+box.height*.5);await submission.mouse.down();
  await submission.mouse.move(box.x+box.width*.35,box.y+box.height*.25,{steps:8});await submission.mouse.move(box.x+box.width*.55,box.y+box.height*.65,{steps:8});await submission.mouse.up();
  await submission.getByAltText("현재 적용 서명").waitFor();const submit=submission.getByRole("button",{name:"입력완료",exact:true});
  await submit.waitFor();await submit.click({timeout:60000});
  await submission.getByRole("status").filter({hasText:"입력 완료 문서를 접수했습니다"}).waitFor({timeout:60000});
  const saved=JSON.parse(sql(`select row_to_json(d) from (select r.id,r.offering_id,r.person_id,r.course_name,r.applicant_name,r.status,f.byte_size,f.pdf_sha256 from public.life_learner_document_requests r join life_private.learner_document_files f on f.request_id=r.id where r.person_id='${learner.person}' and r.offering_id='${ids.offering}' order by r.submitted_at desc limit 1)d;`));
  assert.equal(saved.offering_id,ids.offering);assert.equal(saved.course_name,firstName);assert.equal(saved.applicant_name,learner.name);assert.equal(saved.status,"RECEIVED");assert.ok(saved.byte_size>1000);
  const pdf=await context.request.get(`${base}/api/learner-documents/${saved.id}/pdf`);assert.ok(pdf.ok());const bytes=await pdf.body();
  assert.ok(bytes.subarray(0,8).toString().startsWith("%PDF-1.7"));writeFileSync(resolve(output,"submitted-application.pdf"),bytes);
  assert.equal(sql(`select count(*) from public.life_applications where offering_id='${ids.offering}' and person_id='${learner.person}';`),"1");
  pass("실제 원서 제출 → 동일 과정·회원의 DB 접수와 비공개 PDF 조회 확인");
  await submission.screenshot({path:resolve(output,"submitted-desktop.png"),fullPage:true});
  writeFileSync(resolve(output,"result.json"),JSON.stringify({verifiedAt:new Date().toISOString(),environment:{project:"uc-life-issues",api:status.API_URL,app:base,mode:"production"},guide,secondOffering:second,saved,checks,limitation:"전용 로컬 최신 DB·합성 회원 검증. 운영 회원의 원서를 제출하지 않음."},null,2)+"\n");
  console.log(`${checks.length} real application document flow checks passed; ${output}`);
} finally {await browser?.close();app.kill("SIGTERM");}
