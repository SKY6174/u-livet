// Dedicated local Auth -> browser/server actions -> RPC -> DB acceptance checks.
// Run verify-application-flow.mjs --production first to provision reusable local fixtures.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const dir = process.env.APPLICATION_TEST_DB_DIR;
assert.ok(dir);
assert.match(readFileSync(resolve(dir, "supabase/config.toml"), "utf8"), /^project_id = "uc-life-issues"$/m);
const config = JSON.parse(execFileSync("supabase", ["status", "--workdir", dir, "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
assert.equal(config.API_URL, "http://127.0.0.1:56321");
const fixture = JSON.parse(readFileSync("/tmp/u-livet-issues-browser-fixtures.json", "utf8"));
const { ids, password, manager, instructor } = fixture;
const sql = q => execFileSync("docker", ["exec", "-i", "supabase_db_uc-life-issues", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qtA"], { input: q, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const client = key => createClient(config.API_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
const ok = r => { assert.ifError(r.error); return r.data; };
const admin = client(config.SERVICE_ROLE_KEY);
const staff = client(config.ANON_KEY);
ok(await staff.auth.signInWithPassword({ email: manager.email, password }));
const checks = [];
const pass = label => { checks.push(label); console.log("PASS " + label); };
const output = resolve("artifacts/management-flow"); mkdirSync(output, { recursive: true });
const run = randomUUID();
const today = new Date();
const date = days => new Date(today.getTime() + days * 86400000).toISOString().slice(0, 10);
const createArgs = {
  o: ids.org, y: ids.year, title: "[검증용] Issue124 관리 과정", academy: "검증", summary: "관리 흐름 검증", curriculum: "합성 계정 검증 전용",
  mode: "ONLINE", location: "검증 강의실", capacity: 10, selection_method: "REVIEW",
  apply_from: date(-1) + "T00:00:00+09:00", apply_until: date(7) + "T23:00:00+09:00", starts_on: date(9), ends_on: date(30),
};
const offering = ok(await staff.rpc("life_create_offering", createArgs));
assert.equal(sql(`select status from public.life_offerings where id='${offering}'`), "DRAFT");
ok(await staff.rpc("life_publish", { f: offering, enrollment_policy: ids.enrollment, completion_policy: ids.completion }));
pass("실제 담당자 RPC 과정 등록·승인 정책으로 모집 공개");
const snapshot = () => JSON.parse(sql(`select row_to_json(x) from (select o.*,v.summary,v.curriculum from public.life_offerings o join public.life_course_versions v on v.id=o.course_version_id where o.id='${offering}')x`));
const fields = () => { const o = snapshot(); return Object.fromEntries(["name", "location", "mode", "capacity", "selection_method", "status", "apply_from", "apply_until", "starts_on", "ends_on", "summary", "curriculum"].map(k => [k, o[k]])); };
const dummy = [];
for (let i = 0; i < 10; i++) {
  const name = `dummy-${String(i).padStart(2, "0")}`;
  const email = `${name}-${run}@example.invalid`;
  const user = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name, privacy_accepted: true, privacy_policy_id: ids.privacy, mobile_phone: `+8210000012${String(i).padStart(2,"0")}` } })).user;
  const db = client(config.ANON_KEY); ok(await db.auth.signInWithPassword({ email, password }));
  const person = ok(await db.rpc("life_identity")).id;
  const application = ok(await db.rpc("life_apply", { f: offering, policy: ids.enrollment }));
  dummy.push({ name, email, user: user.id, person, application, db });
}
assert.equal(ok(await staff.rpc("life_management_applications", { f: offering })).count, 10);
assert.equal(ok(await staff.rpc("life_management_learners", { f: offering })).count, 10);
pass("dummy-00~09 실제 Auth·life_apply 신청 10건이 두 관리 목록에 표시");
assert.equal(ok(await dummy[0].db.rpc("life_apply", { f: offering, policy: ids.enrollment })), dummy[0].application);
assert.equal(ok(await staff.rpc("life_management_applications", { f: offering, q: "dummy-03", s: "SUBMITTED" })).count, 1);
pass("중복 신청 동일 ID와 과정·상태·이름 검색");
const outsider = client(config.ANON_KEY);
const other = ok(await admin.auth.admin.createUser({ email: `outsider124-${run}@example.invalid`, password, email_confirm: true, user_metadata: { name: "비담당 연구원", privacy_accepted: true, privacy_policy_id: ids.privacy, mobile_phone: "+821000009999" } })).user;
ok(await outsider.auth.signInWithPassword({ email: other.email, password }));
const outsiderPerson = ok(await outsider.rpc("life_identity")).id;
sql(`insert into public.life_role_assignments(person_id,org_id,role) values('${outsiderPerson}','${ids.otherOrg}','COURSE_MANAGER');
insert into life_private.account_classifications(person_id,office_position) values('${outsiderPerson}','RESEARCHER'),('${manager.person}','RESEARCHER') on conflict(person_id) do update set office_position='RESEARCHER';`);
for (const db of [outsider, dummy[0].db, client(config.ANON_KEY)]) {
  assert.ok((await db.rpc("life_management_applications", { f: offering })).error);
  assert.ok((await db.rpc("life_management_learners", { f: offering })).error);
  assert.ok((await db.rpc("life_management_learner", { p: dummy[1].person })).error);
  assert.ok((await db.rpc("life_application_detail", { a: dummy[1].application })).error);
  assert.ok((await db.rpc("life_review_application", { a: dummy[1].application, decision: "ACCEPTED", reason: "", expected_status: "SUBMITTED" })).error);
  assert.ok((await db.rpc("life_update_offering", { f: offering, expected_revision: snapshot().academic_revision, fields: fields() })).error);
}
assert.equal(ok(await outsider.rpc("life_management_applications", {})).count, 0);
assert.ok((await staff.rpc("life_management_applications", { q: "a".repeat(101) })).error);
pass("수강생·비담당 연구원·비로그인 목록/상세/변경 RPC 차단, 입력 검증");
assert.equal((await staff.rpc("life_decide", { a: dummy[0].application, decision: "REJECTED" })).error?.message, "REASON_REQUIRED");
pass("기존 API 직접 호출로 반려 사유 검증 우회 불가");
const original = snapshot();
const sibling = randomUUID();
sql(`insert into public.life_offerings(id,org_id,project_year_id,course_version_id,name,mode,location,capacity,selection_method,status,apply_from,apply_until,starts_on,ends_on,enrollment_policy_id)
 select '${sibling}',org_id,project_year_id,course_version_id,'[검증용] 공유 버전',mode,location,capacity,selection_method,status,apply_from,apply_until,starts_on,ends_on,enrollment_policy_id from public.life_offerings where id='${offering}';`);
const revision = snapshot().academic_revision;
ok(await staff.rpc("life_update_offering", { f: offering, expected_revision: revision, fields: { ...fields(), summary: "수정된 검증 소개" } }));
assert.equal(snapshot().summary, "수정된 검증 소개");
assert.notEqual(snapshot().course_version_id, original.course_version_id);
assert.equal(sql(`select summary from public.life_course_versions where id='${original.course_version_id}'`), original.summary);
assert.equal((await staff.rpc("life_update_offering", { f: offering, expected_revision: revision, fields: fields() })).error?.message, "REVISION_CHANGED");
assert.equal((await staff.rpc("life_update_offering", { f: offering, expected_revision: snapshot().academic_revision, fields: { ...fields(), selection_method: "FIRST_COME" } })).error?.message, "SELECTION_LOCKED");
pass("과정 수정은 공유 버전 보존·오래된 버전/선발방식 변경 차단");
const poolPayload = { name: `[검증용] 관리 강사 ${run.slice(0,8)}`, kind: "EXTERNAL", teaching_role: "LECTURER", affiliation: "검증 기관", department: "교육", position: "강사", specialty: "검증", phone: "01000000000", email: "", notes: "합성 자료", documents_required: false, status: "ACTIVE" };
const poolPerson = ok(await staff.rpc("life_instructor_pool_save", { o: ids.org, p: null, expected_revision: 0, request_key: randomUUID(), payload: poolPayload }));
ok(await staff.rpc("life_instructor_pool_save", { o: ids.org, p: poolPerson, expected_revision: 1, request_key: randomUUID(), payload: { ...poolPayload, specialty: "수정된 전문분야" } }));
assert.equal(ok(await staff.rpc("life_instructor_pool_board", { o: ids.org, q: poolPayload.name })).items[0].specialty, "수정된 전문분야");
ok(await staff.rpc("life_assign_instructor", { f: offering, p: instructor.person, enabled: true }));
assert.ok(ok(await staff.rpc("life_instructors", { f: offering })).some(x => x.person_id === instructor.person && x.assigned));
sql(`insert into public.life_offering_instructors(offering_id,person_id) values('${offering}','${poolPerson}');`);
ok(await staff.rpc("life_instructor_pool_remove", { o: ids.org, p: poolPerson, expected_revision: 2 }));
assert.equal(sql(`select count(*) from public.life_offering_instructors where offering_id='${offering}' and person_id='${poolPerson}'`), "1");
ok(await staff.rpc("life_assign_instructor", { f: offering, p: instructor.person, enabled: false }));
assert.equal(sql(`select count(*) from public.life_offering_instructors where offering_id='${offering}' and person_id='${instructor.person}' and valid_until is not null`), "1");
pass("기존 강사 등록/수정/검색·담당 강사 배정/해제와 삭제 후 배정 이력 보존");

const base = "http://127.0.0.1:3100";
const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3100", "-H", "127.0.0.1"], { env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: config.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: config.ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: config.SERVICE_ROLE_KEY, AUTH_RATE_LIMIT_SECRET: randomBytes(32).toString("hex"), AUTH_TRUSTED_IP_HEADER: "", AUTH_CAPTCHA_ENABLED: "false", AUTH_SITE_ORIGIN: base, CERTIFICATE_VERIFY_ORIGIN: base, AUTH_PROFILE: "managed-cloud-v1", AUTH_EMAIL_ENABLED: "true", AUTH_SIGNUP_ENABLED: "true", PREVIEW_REVIEW_ONLY: "false" }, stdio: "ignore" });
let browser;
try {
  let ready = false;
  for (let i=0;i<60;i++) { try { ready = (await fetch(base + "/api/health")).ok; } catch {} if (ready) break; await new Promise(r=>setTimeout(r,500)); }
  assert.ok(ready);
  browser = await chromium.launch({ headless: true });
  async function login(account, path) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); const page = await context.newPage();
    await page.goto(`${base}/auth/login?audience=learner&next=${encodeURIComponent(path)}`);
    const toggle = page.getByRole("button", { name: "이메일로 로그인", exact: true }); if (await toggle.count()) await toggle.click();
    await page.locator('input[name="email"]').fill(account.email); await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: "로그인", exact: true }).click(); await page.waitForURL(base + path, { timeout: 30000 });
    return { page, context };
  }
  const staffUI = await login(manager, `/admin/applications?course=${offering}`);
  await staffUI.page.getByRole("heading", { name: "신청내역 관리", exact: true }).waitFor();
  assert.equal(await staffUI.page.locator("main article").count(), 10);
  await staffUI.page.screenshot({ path: resolve(output, "applications.png"), fullPage: true });
  await staffUI.page.goto(`${base}/admin/applications/${dummy[0].application}`);
  await staffUI.page.locator('select[name="decision"]').selectOption("REJECTED");
  await staffUI.page.locator('textarea[name="reason"]').fill("[검증용] 신청 요건 확인이 필요합니다.");
  await staffUI.page.getByRole("button", { name: "심사 결과 저장", exact: true }).click();
  await staffUI.page.getByText("[검증용] 신청 요건 확인이 필요합니다.", { exact: true }).waitFor();
  assert.equal(ok(await staff.rpc("life_application_detail", { a: dummy[0].application })).history.at(-1).reason, "[검증용] 신청 요건 확인이 필요합니다.");
  await staffUI.page.reload();
  await staffUI.page.getByText("[검증용] 신청 요건 확인이 필요합니다.", { exact: true }).waitFor();
  await staffUI.page.screenshot({ path: resolve(output, "rejection-history.png"), fullPage: true });
  pass("실제 관리자 화면 반려 서버 액션·DB 사유·새로고침 후 처리 이력");
  const ownUI = await login(dummy[0], `/mypage/applications/${dummy[0].application}`);
  await ownUI.page.getByText("[검증용] 신청 요건 확인이 필요합니다.", { exact: true }).waitFor();
  pass("실제 수강생 로그인에서 본인 반려 사유·이력 확인");
  await staffUI.page.goto(`${base}/admin/offerings/${offering}/manage`);
  await staffUI.page.getByText("과정 기본 정보 수정", { exact: true }).click();
  await staffUI.page.locator('input[name="location"]').fill("브라우저 수정 강의실");
  await staffUI.page.getByRole("button", { name: "과정 정보 저장", exact: true }).click();
  await staffUI.page.getByRole("status").filter({ hasText: "저장되었습니다" }).waitFor();
  assert.equal(snapshot().location, "브라우저 수정 강의실");
  await staffUI.page.screenshot({ path: resolve(output, "course-edit.png"), fullPage: true });
  pass("실제 과정 수정 폼 서버 액션과 DB 변경");
  await staffUI.page.goto(`${base}/admin/learners/${dummy[1].person}`);
  assert.ok((await staffUI.page.locator("main").innerText()).includes(dummy[1].email));
  await staffUI.page.screenshot({ path: resolve(output, "learner-history.png"), fullPage: true });
  await staffUI.page.setViewportSize({ width: 390, height: 844 });
  await staffUI.page.goto(`${base}/admin/learners?course=${offering}`);
  await staffUI.page.screenshot({ path: resolve(output, "learners-mobile.png"), fullPage: true });
  assert.ok(await staffUI.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  pass("수강생 연락처·신청 이력과 모바일 명단 표시");
  for (const account of [dummy[1], { email: other.email }]) {
    const denied = await login(account, "/mypage");
    for (const path of [`/admin/applications?course=${offering}`, `/admin/applications/${dummy[0].application}`, `/admin/learners/${dummy[0].person}`, `/admin/offerings/${offering}/manage`]) {
      assert.equal((await denied.page.goto(base + path)).status(), 404);
    }
    await denied.context.close();
  }
  pass("수강생/비담당 연구원 URL 직접 접근 차단");
  for (const c of [staffUI.context, ownUI.context]) await c.close();
} finally { await browser?.close(); app.kill("SIGTERM"); }

assert.equal((await staff.rpc("life_review_application", { a: dummy[0].application, decision: "ACCEPTED", reason: "", expected_status: "SUBMITTED" })).error?.message, "STATUS_CHANGED");
assert.equal((await staff.rpc("life_review_application", { a: dummy[0].application, decision: "ACCEPTED", reason: "", expected_status: "REJECTED" })).error?.message, "INVALID_TRANSITION");
ok(await staff.rpc("life_update_offering", { f: offering, expected_revision: snapshot().academic_revision, fields: { ...fields(), capacity: 1 } }));
const decisions = await Promise.all(dummy.slice(1,3).map(d => staff.rpc("life_review_application", { a: d.application, decision: "ACCEPTED", reason: "동시 승인 검증", expected_status: "SUBMITTED" })));
assert.equal(decisions.filter(r=>!r.error).length, 1);
assert.equal(decisions.filter(r=>r.error?.message === "CAPACITY_FULL").length, 1);
assert.equal(sql(`select count(*) from public.life_enrollments where offering_id='${offering}' and status='ACTIVE'`), "1");
const accepted = dummy.slice(1,3)[decisions.findIndex(r=>!r.error)];
assert.equal(ok(await staff.rpc("life_management_learner", { p: accepted.person })).applications[0].enrollment_status, "ACTIVE");
assert.equal((await staff.rpc("life_update_offering", { f: offering, expected_revision: snapshot().academic_revision, fields: { ...fields(), capacity: 0 } })).error?.message, "INVALID_DATES_OR_CAPACITY");
pass("오래된 심사·잘못된 전환 거부·동시 승인 정원 1명 보장·수강 이력 연결");
ok(await staff.rpc("life_update_offering", { f: offering, expected_revision: snapshot().academic_revision, fields: { ...fields(), status: "CLOSED" } }));
assert.equal(snapshot().status, "CLOSED");
sql(`update public.life_offerings set academic_sealed=true where id='${offering}';`);
assert.equal((await staff.rpc("life_update_offering", { f: offering, expected_revision: snapshot().academic_revision, fields: fields() })).error?.message, "COURSE_READ_ONLY");
sql(`update public.life_offerings set academic_sealed=false where id='${offering}'; insert into public.life_role_assignments(person_id,org_id,role) values('${manager.person}','${ids.org}','SYSTEM_ADMIN');`);
ok(await staff.rpc("life_delete_member", { p_person: dummy[9].person, p_revision: 0 }));
assert.equal(sql(`select active from public.life_people where id='${dummy[9].person}'`), "f");
assert.equal(sql(`select count(*) from public.life_applications where id='${dummy[9].application}'`), "1");
assert.ok(!ok(await dummy[9].db.rpc("life_identity")));
pass("모집 종료·마감 수정 차단·기존 관리자 계정 삭제 후 신청 이력 보존/접근 중지");
const refund = randomUUID();
sql(`insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at)
 values('${refund}','${ids.org}','REFUND','${run}','[검증용] 환불 규정','실제 입금·환불을 진행하지 않는 로컬 검증','APPROVED','${manager.person}',now());
 insert into public.life_refund_rules(policy_id,label,basis,numerator,denominator) values('${refund}','전액','TUITION',1,1);`);
const paid = ok(await staff.rpc("life_create_offering", { ...createArgs, title: "[검증용] 유료 심사", capacity: 2 }));
ok(await staff.rpc("life_configure_finance", { f: paid, tuition: 2000, policy: refund, hours: 24, instructions: "실제 납부 금지 · 합성 검증" }));
ok(await staff.rpc("life_publish", { f: paid, enrollment_policy: ids.enrollment, completion_policy: ids.completion }));
const paidApps = [];
for (const learner of dummy.slice(4,7)) paidApps.push(ok(await learner.db.rpc("life_apply", { f: paid, policy: ids.enrollment })));
for (const a of paidApps.slice(0,2)) {
  ok(await staff.rpc("life_review_application", { a, decision: "ACCEPTED", reason: "납부 대기 검증", expected_status: "SUBMITTED" }));
  assert.equal(ok(await staff.rpc("life_application_detail", { a })).history.at(-1).next_status, "PENDING_PAYMENT");
}
assert.equal(sql(`select count(*) from public.life_invoices where offering_id='${paid}' and amount=2000`), "2");
assert.equal((await staff.rpc("life_review_application", { a: paidApps[2], decision: "ACCEPTED", reason: "", expected_status: "SUBMITTED" })).error?.message, "CAPACITY_FULL");
const paidRevision = Number(sql(`select academic_revision from public.life_offerings where id='${paid}'`));
assert.equal((await staff.rpc("life_update_offering", { f: paid, expected_revision: paidRevision, fields: { ...fields(), name: "[검증용] 유료 심사", status: "PUBLISHED", capacity: 1 } })).error?.message, "CAPACITY_FULL");
ok(await dummy[4].db.rpc("life_decide", { a: paidApps[0], decision: "CANCELLED" }));
assert.equal(ok(await dummy[4].db.rpc("life_application_detail", { a: paidApps[0] })).history.at(-1).next_status, "CANCELLED");
pass("유료 승인 납부 대기/청구서·정원 예약·정원 축소 거부·기존 미납 취소/이력 유지");
writeFileSync(resolve(output, "result.json"), JSON.stringify({ verifiedAt: new Date().toISOString(), environment: "dedicated local production build", offering, dummyNames: dummy.map(d=>d.name), checks, screenshots: ["applications.png", "rejection-history.png", "course-edit.png", "learner-history.png", "learners-mobile.png"] }, null, 2) + "\n");
console.log(`${checks.length} management acceptance checks passed.`);
