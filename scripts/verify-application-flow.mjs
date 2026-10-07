// Real Auth + browser server action + database + manager UI. Local fixtures only.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const dbDir = process.env.APPLICATION_TEST_DB_DIR;
assert.ok(dbDir, "Set APPLICATION_TEST_DB_DIR to the dedicated uc-life-issues project.");
assert.match(readFileSync(resolve(dbDir, "supabase/config.toml"), "utf8"), /^project_id = "uc-life-issues"$/m);
const status = JSON.parse(execFileSync("supabase", ["status", "--workdir", dbDir, "-o", "json"], {
  encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
}));
assert.equal(status.API_URL, "http://127.0.0.1:56321", "Never run against a hosted or existing local project.");
const container = "supabase_db_uc-life-issues";
const inspected = JSON.parse(execFileSync("docker", ["inspect", container], { encoding: "utf8" }))[0];
assert.equal(inspected.Config.Labels["com.supabase.cli.project"], "uc-life-issues");
const sql = query => execFileSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"], {
  input: query, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
}).trim();
const checked = response => { assert.ifError(response.error); return response.data; };
const client = key => createClient(status.API_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = client(status.SERVICE_ROLE_KEY);
const password = `Local-test-${randomBytes(12).toString("hex")}!`;
const runId = randomUUID();
const ids = Object.fromEntries(["org", "otherOrg", "year", "privacy", "enrollment", "completion", "course", "version", "offering", "approver"].map(k => [k, randomUUID()]));
const output = resolve(process.env.APPLICATION_TEST_OUTPUT ?? "artifacts/application-flow");
mkdirSync(output, { recursive: true });
const checks = [];
function pass(label) { checks.push(label); console.log(`PASS ${label}`); }

sql(`begin;
insert into public.life_organizations(id,slug,name) values
 ('${ids.org}','issue-121-${runId}','[검증용] 신청 연결 조직'),
 ('${ids.otherOrg}','issue-121-other-${runId}','[검증용] 비담당 조직');
insert into public.life_project_years(id,org_id,label,starts_on,ends_on)
 values('${ids.year}','${ids.org}','[검증용] 2026','2026-01-01','2027-12-31');
insert into public.life_people(id,name) values('${ids.approver}','[검증용] 정책 승인자');
insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at,effective_from) values
 ('${ids.privacy}','${ids.org}','ACCOUNT_PRIVACY','test-v1','[검증용] 가입 안내','로컬 합성 계정 검증 전용. 실제 개인정보를 입력하지 않습니다.','APPROVED','${ids.approver}',now(),now()-interval '1 day'),
 ('${ids.enrollment}','${ids.org}','ENROLLMENT','test-v1','[검증용] 신청 안내','로컬 테스트 신청이며 실제 모집과 수료가 아닙니다. 가상 이름과 신청 기록은 검증 종료 시 삭제합니다.','APPROVED','${ids.approver}',now(),now()-interval '1 day'),
 ('${ids.completion}','${ids.org}','COMPLETION','test-v1','[검증용] 수료 제외','테스트 과정은 수료 및 증명서를 발급하지 않습니다.','APPROVED','${ids.approver}',now(),now()-interval '1 day');
update life_private.signup_settings set org_id='${ids.org}',policy_id='${ids.privacy}',enabled=true;
insert into public.life_courses(id,org_id,title,academy) values('${ids.course}','${ids.org}','[검증용] 수강신청 DB 연결','디지털 역량');
insert into public.life_course_versions(id,org_id,course_id,summary,curriculum,status,completion_policy_id,approved_by)
 values('${ids.version}','${ids.org}','${ids.course}','신청과 관리자 조회 연결 검증','로컬 검증 전용 교육내용','APPROVED','${ids.completion}','${ids.approver}');
insert into public.life_offerings(id,org_id,project_year_id,course_version_id,name,mode,location,capacity,tuition,selection_method,status,apply_from,apply_until,starts_on,ends_on,enrollment_policy_id)
 values('${ids.offering}','${ids.org}','${ids.year}','${ids.version}','[검증용] 수강신청 DB 연결 · 1기','ONLINE','로컬 테스트 강의실',20,0,'REVIEW','PUBLISHED',now()-interval '1 day',now()+interval '7 days',current_date+8,current_date+30,'${ids.enrollment}');
commit;`);

async function account(label, index, role, org = ids.org) {
  const email = `issue121-${index}-${runId}@example.invalid`;
  const user = checked(await admin.auth.admin.createUser({ email, password, email_confirm: true,
    user_metadata: { name: `[검증용] ${label}`, privacy_policy_id: ids.privacy, privacy_accepted: true, mobile_phone: `+82100000${String(index).padStart(4,"0")}` },
  })).user;
  const db = client(status.ANON_KEY);
  checked(await db.auth.signInWithPassword({ email, password }));
  const me = checked(await db.rpc("life_identity"));
  assert.ok(me?.id);
  if (role) sql(`insert into public.life_role_assignments(person_id,org_id,role) values('${me.id}','${org}','${role}');`);
  return { email, db, person: me.id, user: user.id, name: `[검증용] ${label}` };
}
const learner = await account("수강생", 1211);
const manager = await account("담당자", 1212, "COURSE_MANAGER");
const outsider = await account("비담당자", 1213, "COURSE_MANAGER", ids.otherOrg);
const instructor = await account("강사", 1214, "INSTRUCTOR");
sql(`insert into public.life_offering_instructors(offering_id,person_id) values('${ids.offering}','${instructor.person}');`);
const base = "http://127.0.0.1:3100";
const applyPath = `/offerings/${ids.offering}/apply`;
const managePath = `/admin/offerings/${ids.offering}/manage`;
let app;
if (!process.env.APPLICATION_TEST_APP_RUNNING) {
  app = spawn(process.execPath, ["node_modules/next/dist/bin/next", process.argv.includes("--production") ? "start" : "dev", "-p", "3100", "-H", "127.0.0.1"], {
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: status.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY, AUTH_RATE_LIMIT_SECRET: randomBytes(32).toString("hex"),
      AUTH_TRUSTED_IP_HEADER: "", AUTH_CAPTCHA_ENABLED: "false", AUTH_SITE_ORIGIN: base, CERTIFICATE_VERIFY_ORIGIN: base,
      AUTH_PROFILE: "managed-cloud-v1", AUTH_EMAIL_ENABLED: "true", AUTH_SIGNUP_ENABLED: "true", PREVIEW_REVIEW_ONLY: "false" },
    stdio: ["ignore", "ignore", "pipe"],
  });
  app.stderr.on("data", chunk => { if (/EADDRINUSE/.test(String(chunk))) console.error("Port 3100 is occupied; use a free dedicated application instance."); });
}
let browser;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { ready = (await fetch(`${base}/api/health`)).ok; } catch { /* Starting local app. */ }
    if (ready) break;
    if (app?.exitCode != null) throw new Error("Local app exited before readiness.");
    await new Promise(r => setTimeout(r, 500));
  }
  assert.ok(ready, "Local app is ready.");
  browser = await chromium.launch({ headless: true });
  async function login(person, path) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    await page.goto(`${base}/auth/login?audience=learner&next=${encodeURIComponent(path)}`);
    const email = page.locator('input[name="email"]');
    const emailToggle = page.getByRole("button", { name: "이메일로 로그인", exact: true });
    if (await emailToggle.count()) await emailToggle.click();
    try { await email.waitFor({ state: "visible" }); } catch {
      throw new Error(`Login form missing: ${(await page.locator("body").innerText()).slice(0,1200)}`);
    }
    await email.fill(person.email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    try { await page.waitForURL(`${base}${path}`, { timeout: 30000 }); }
    catch { throw new Error(`Login failed: ${(await page.locator("[role=alert]").allTextContents()).join(" ")}`); }
    return { context, page };
  }
  assert.equal(sql(`select count(*) from public.life_applications where offering_id='${ids.offering}' and person_id='${learner.person}';`), "0");
  pass("신청 전 DB 행 0건");
  const student = await login(learner, applyPath);
  await student.page.locator('input[name="consent"]').check();
  await student.page.getByRole("button", { name: "신청서 제출", exact: true }).click();
  await student.page.getByRole("status").filter({ hasText: "신청이 접수되었습니다" }).waitFor({ timeout: 60000 });
  pass("실제 수강생 로그인·신청 서버 액션 완료");
  const application = JSON.parse(sql(`select row_to_json(a) from (select id,offering_id,person_id,status,submitted_at from public.life_applications where offering_id='${ids.offering}' and person_id='${learner.person}') a;`));
  assert.equal(application.status, "SUBMITTED");
  assert.ok(Date.now() - Date.parse(application.submitted_at) < 120000);
  pass("DB에 동일 과정·수강생·신청시각·심사 대기 저장");
  const row = checked(await manager.db.rpc("life_roster", { f: ids.offering })).find(r => r.application_id === application.id);
  assert.equal(row.person_id, application.person_id);
  assert.equal(row.name, learner.name);
  assert.equal(row.status, application.status);
  assert.equal(Date.parse(row.submitted_at), Date.parse(application.submitted_at));
  pass("담당자 life_roster의 신청 ID·수강생·상태·시각 일치");
  const displayTime = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(application.submitted_at));
  const staff = await login(manager, managePath);
  await staff.page.getByRole("heading", { name: learner.name, exact: true }).waitFor();
  assert.ok((await staff.page.locator("main").innerText()).includes(displayTime));
  assert.ok((await staff.page.locator("main").innerText()).includes("심사 대기"));
  await staff.page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await staff.page.waitForTimeout(100);
  await staff.page.screenshot({ path: resolve(output, "admin-roster.png"), fullPage: true });
  pass("관리자 화면 과정·신청자·한국시간·상태 및 캡처");
  await staff.context.close();
  const reopened = await login(manager, managePath);
  await reopened.page.getByRole("heading", { name: learner.name, exact: true }).waitFor();
  assert.deepEqual(JSON.parse(sql(`select row_to_json(a) from (select id,offering_id,person_id,status,submitted_at from public.life_applications where id='${application.id}') a;`)), application);
  pass("새 브라우저 context 로그인 후 동일 신청 유지");
  await student.page.goto(`${base}/mypage`);
  await student.page.getByText("[검증용] 수강신청 DB 연결 · 1기", { exact: true }).first().waitFor();
  pass("수강생 나의 학습에서도 동일 과정 확인");
  assert.equal(checked(await learner.db.rpc("life_apply", { f: ids.offering, policy: ids.enrollment })), application.id);
  assert.equal(sql(`select count(*) from public.life_applications where offering_id='${ids.offering}' and person_id='${learner.person}';`), "1");
  assert.equal(sql(`select count(*) from public.life_consent_events where person_id='${learner.person}' and policy_id='${ids.enrollment}' and source='APPLICATION';`), "1");
  pass("중복 제출 동일 ID·신청 1건·동의 1건");
  for (const [who, db] of [["수강생", learner.db], ["비담당 관리자", outsider.db], ["비로그인", client(status.ANON_KEY)]]) {
    assert.ok((await db.rpc("life_roster", { f: ids.offering })).error);
    pass(`${who} 신청자 명단 접근 차단`);
  }
  assert.equal(checked(await outsider.db.from("life_applications").select("id").eq("id", application.id)).length, 0);
  pass("비담당 관리자 직접 테이블 조회 RLS 차단");
  assert.ok((await instructor.db.rpc("life_apply", { f: ids.offering, policy: ids.completion })).error);
  pass("잘못된 모집 정책 신청 거부");
  sql(`update public.life_offerings set apply_until=now()-interval '1 hour' where id='${ids.offering}';`);
  const closed = await instructor.db.rpc("life_apply", { f: ids.offering, policy: ids.enrollment });
  assert.equal(closed.error?.message, "APPLICATION_CLOSED");
  sql(`update public.life_offerings set apply_until=now()+interval '7 days' where id='${ids.offering}';`);
  pass("접수 마감 신청 거부");
  assert.equal(sql(`select count(*) from public.life_applications where offering_id='${ids.offering}' and person_id='${instructor.person}';`), "0");
  pass("실패한 신청은 DB에 저장되지 않음");
  const before = await browser.newContext();
  const beforePage = await before.newPage();
  const designOutput = resolve("../design-evidence");
  mkdirSync(designOutput, { recursive: true });
  for (const width of [360, 1440]) {
    await beforePage.setViewportSize({ width, height: 1000 });
    for (const [label, path] of [["home", "/"], ["courses", "/courses"], ["offering", `/offerings/${ids.offering}`]]) {
      await beforePage.goto(`${base}${path}`);
      await beforePage.screenshot({ path: resolve(designOutput, `before-${label}-${width}.png`), fullPage: true });
    }
  }
  await before.close();
  const evidence = { verifiedAt: new Date().toISOString(), environment: { project: "uc-life-issues", api: status.API_URL, app: base },
    application, roster: row, displayTime, managePath, checks, screenshots: ["admin-roster.png"],
    limitation: "전용 로컬 최신 스키마에서 검증. 운영 DB의 실제 신청 건 검증 결과가 아님." };
  writeFileSync(resolve(output, "result.json"), JSON.stringify(evidence, null, 2) + "\n");
  // Private reusable synthetic fixtures for subsequent design checks. Never commit sessions/passwords.
  writeFileSync("/tmp/u-livet-issues-browser-fixtures.json", JSON.stringify({ base, ids, password, learner, manager, instructor }, (key, value) => key === "db" ? undefined : value), { mode: 0o600 });
  console.log(`${checks.length} checks passed; evidence: ${output}`);
} finally {
  await browser?.close();
  app?.kill("SIGTERM");
}
