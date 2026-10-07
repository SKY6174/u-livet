// Native Auth and real guide RPC in a dedicated local DB; synthetic guide only.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const dbDir = process.env.APPLICATION_TEST_DB_DIR;
assert.ok(dbDir, 'Dedicated APPLICATION_TEST_DB_DIR is required.');
assert.match(readFileSync(resolve(dbDir, 'supabase/config.toml'), 'utf8'), /^project_id = "uc-life-issues"$/m);
const status = JSON.parse(execFileSync('supabase', ['status', '--workdir', dbDir, '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
assert.equal(status.API_URL, 'http://127.0.0.1:56321');
const container = 'supabase_db_uc-life-issues';
assert.equal(JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8' }))[0].Config.Labels['com.supabase.cli.project'], 'uc-life-issues');
const sql = query => execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qtA'], { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const { ids, manager, learner, password } = JSON.parse(readFileSync('/tmp/u-livet-issues-browser-fixtures.json', 'utf8'));
assert.match(ids.org, /^[0-9a-f-]{36}$/);
const guide = `schedule-test-${randomUUID()}`;
const beforeCount = sql('select count(*) from public.life_course_guides;');
sql(`insert into public.life_course_guides(id,year,sort_order,name,academy,summary,curriculum,mode,capacity,teaching_hours,period_label,time_label,location,certificate,published,org_id)
 select '${guide}',year,(select max(sort_order)+1 from public.life_course_guides where year=2026),'[검증용] 날짜 시간 안내',academy,summary,curriculum,mode,capacity,teaching_hours,period_label,time_label,location,certificate,true,'${ids.org}'
 from public.life_course_guides where id='2026-obstetric-pilates';`);
const base = 'http://127.0.0.1:3112', editPath = `/admin/courses/guides/${guide}`;
const output = resolve('tmp/release-validation/course-guide-date-time-fields');
mkdirSync(output, { recursive: true });
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3112', '-H', '127.0.0.1'], {
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: status.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    AUTH_RATE_LIMIT_SECRET: randomBytes(32).toString('hex'), AUTH_TRUSTED_IP_HEADER: '', AUTH_CAPTCHA_ENABLED: 'false', AUTH_SITE_ORIGIN: base, CERTIFICATE_VERIFY_ORIGIN: base,
    AUTH_PROFILE: 'managed-cloud-v1', AUTH_EMAIL_ENABLED: 'true', AUTH_SIGNUP_ENABLED: 'true', PREVIEW_REVIEW_ONLY: 'false' }, stdio: ['ignore', 'ignore', 'pipe']
});
app.stderr.on('data', chunk => { if (/EADDRINUSE/.test(String(chunk))) console.error('Test port3112 is occupied.'); });
let browser, checks = 0;
const pass = name => { checks++; console.log(`PASS ${name}`); };
const savedGuide = () => JSON.parse(sql(`select row_to_json(c) from public.life_course_guides c where id='${guide}';`));
async function save(page) {
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '과정 안내를 저장했습니다.' }).waitFor();
}
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { ready = (await fetch(`${base}/api/health`)).ok; } catch {}
    if (ready) break;
    if (app.exitCode !== null) throw Error('Local production app exited.');
    await new Promise(r => setTimeout(r, 500));
  }
  assert.ok(ready);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/auth/login?audience=learner&next=${encodeURIComponent(editPath)}`);
  await page.getByRole('button', { name: '이메일로 로그인', exact: true }).click();
  await page.locator('input[name="email"]').fill(manager.email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.waitForURL(`${base}${editPath}`);
  assert.equal(await page.locator('[name="start_date"]').inputValue(), '2026-10-10');
  assert.equal(await page.locator('[name="end_date"]').inputValue(), '2026-12-05');
  assert.equal(await page.getByLabel('요일 1', { exact: true }).inputValue(), '토');
  assert.equal(await page.getByLabel('종료시간 1', { exact: true }).inputValue(), '20:00');
  pass('native login and legacy dates/times prefilled without changing values');
  await page.getByLabel('종료시간 1', { exact: true }).fill('18:00');
  await page.getByRole('button', { name: '요일·시간 추가', exact: true }).click();
  await page.getByLabel('요일 2', { exact: true }).selectOption('일');
  await page.getByLabel('시작시간 2', { exact: true }).fill('15:00');
  await page.getByLabel('종료시간 2', { exact: true }).fill('19:00');
  await save(page);
  const saved = savedGuide();
  assert.equal(saved.period_label, '2026. 10. 10. - 12. 5.');
  assert.equal(saved.time_label, '토 14:00 - 18:00\n일 15:00 - 19:00');
  assert.equal(saved.revision, 2);
  await page.reload();
  assert.equal(await page.getByLabel('요일 2', { exact: true }).inputValue(), '일');
  assert.equal(await page.getByLabel('종료시간 1', { exact: true }).inputValue(), '18:00');
  pass('edit to separate Saturday/Sunday hours, real RPC persistence and reopening');
  await page.screenshot({ path: resolve(output, 'edit-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 360, height: 900 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: resolve(output, 'edit-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: '시간표 2 삭제', exact: true }).click();
  assert.equal(await page.locator('select[name^="weekday_"]').count(), 1);
  assert.equal(await page.getByLabel('종료시간 1', { exact: true }).inputValue(), '18:00');
  pass('360px layout and row deletion preserve the remaining time');
  await page.reload();
  await page.getByLabel('종료시간 1', { exact: true }).fill('13:00');
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '종료시간은 시작시간보다 늦어야' }).waitFor();
  assert.equal(savedGuide().revision, 2);
  await page.reload();
  await page.locator('[name="end_date"]').fill('2026-10-09');
  assert.equal(await page.locator('[name="end_date"]').evaluate(input => input.validity.rangeUnderflow), true);
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  assert.equal(savedGuide().revision, 2);
  pass('reversed time/date blocked before DB write');
  await page.goto(`${base}/courses/${guide}`);
  const date = page.locator('aside dd').first(), time = page.locator('aside dd').nth(1);
  assert.equal(await date.textContent(), saved.period_label);
  assert.equal(await time.textContent(), saved.time_label);
  assert.equal(await time.evaluate(el => getComputedStyle(el).whiteSpace), 'pre-line');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: resolve(output, 'detail-mobile.png'), fullPage: true });
  pass('public detail shows exact date format and one weekday per line');
  sql(`update public.life_course_guides set period_label='2026년 12월 예정',time_label='일정 협의',revision=revision+1 where id='${guide}';`);
  await page.goto(`${base}${editPath}`);
  assert.equal(await page.locator('[name="start_date"]').inputValue(), '');
  assert.ok((await page.locator('main').innerText()).includes('기존 교육기간 안내: 2026년 12월 예정'));
  await page.locator('[name="name"]').fill('[검증용] 미확정 안내 보존');
  await save(page);
  assert.equal(savedGuide().period_label, '2026년 12월 예정');
  assert.equal(savedGuide().time_label, '일정 협의');
  pass('unknown date/time preserved when saving unrelated fields');
  const payload = Object.fromEntries(['name', 'academy', 'summary', 'curriculum', 'mode', 'capacity', 'teaching_hours', 'period_label', 'schedule_history', 'time_label', 'location', 'certificate', 'card_image_url'].map(key => [key, savedGuide()[key]]));
  const anon = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false } });
  assert.ok((await anon.rpc('life_save_course_guide', { g: guide, payload, expected_revision: 4 })).error);
  const signed = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false } });
  assert.equal((await signed.auth.signInWithPassword({ email: learner.email, password })).error, null);
  assert.match((await signed.rpc('life_save_course_guide', { g: guide, payload, expected_revision: 4 })).error.message, /FORBIDDEN/);
  assert.equal(savedGuide().revision, 4);
  assert.deepEqual(errors, []);
  pass('anon/learner cannot save and browser has no JS errors');
  console.log(`${checks} real course guide schedule flow checks passed.`);
} finally {
  await browser?.close(); app.kill('SIGTERM');
  sql(`begin; delete from public.life_audit_events where details->>'guide_id'='${guide}'; delete from public.life_course_guides where id='${guide}'; commit;`);
  assert.equal(sql('select count(*) from public.life_course_guides;'), beforeCount);
}
