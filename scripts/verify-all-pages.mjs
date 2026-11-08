// Real browser + Auth + database coverage. Only the disposable CLI v3 stack is accepted.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { expect } from "playwright/test";
import { seedPageRecords } from "./lib/cli-page-fixtures.mjs";

const dir = resolve(process.env.CLI_TEST_DB_DIR ?? "/tmp/u-livet-cli3-test");
const cli = resolve("node_modules/.bin/supabase");
if (process.argv.includes("--setup")) {
  if (!existsSync(dir)) {
    mkdirSync(resolve(dir, "supabase"), { recursive: true });
    const isolated = readFileSync("supabase/config.toml", "utf8").replace('project_id = "u-livet-core"', 'project_id = "u-livet-cli3-test"').replaceAll("553", "573").replaceAll("http://127.0.0.1:3100", "http://127.0.0.1:3193");
    writeFileSync(resolve(dir, "supabase/config.toml"), isolated);
    for (const name of ["migrations", "templates"]) cpSync(resolve("supabase", name), resolve(dir, "supabase", name), { recursive: true });
  }
  assert.match(readFileSync(resolve(dir, "supabase/config.toml"), "utf8"), /^project_id = "u-livet-cli3-test"$/m);
  try {
    execFileSync(cli, ["start", "--workdir", dir, "--exclude", "realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor"], { stdio: "pipe", timeout: 600000, maxBuffer: 16 * 1024 * 1024 });
  } catch {
    throw new Error("Disposable CLI test stack failed to start; inspect its local containers. CLI credentials were not logged.");
  }
}
const config = readFileSync(resolve(dir, "supabase/config.toml"), "utf8");
assert.match(config, /^project_id = "u-livet-cli3-test"$/m);
const migrations = readdirSync("supabase/migrations").filter(file => file.endsWith(".sql")).sort();
assert.deepEqual(readdirSync(resolve(dir, "supabase/migrations")).filter(file => file.endsWith(".sql")).sort(), migrations, "Recreate the disposable stack when migrations change");
for (const file of migrations) assert.equal(readFileSync(resolve(dir, "supabase/migrations", file), "utf8"), readFileSync(resolve("supabase/migrations", file), "utf8"), `Stale test migration: ${file}`);
const status = JSON.parse(execFileSync(cli, ["status", "--workdir", dir, "-o", "json"], {
  encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
}));
assert.equal(status.API_URL, "http://127.0.0.1:57321");
const container = "supabase_db_u-livet-cli3-test";
assert.equal(execFileSync("docker", ["inspect", container, "--format", '{{ index .Config.Labels "com.supabase.cli.project" }}'], { encoding: "utf8" }).trim(), "u-livet-cli3-test");
const sql = input => execFileSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qtA"], {
  input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
}).trim();
const ORG = "10000000-0000-4000-8000-000000000001";
const YEAR = "10000000-0000-4000-8000-000000000002";
const OFFERING = "20000000-0000-4000-8000-000000000023";
const PRIVACY = "20000000-0000-4000-8000-000000000011";
const POLICY = "20000000-0000-4000-8000-000000000012";
const MISSING = "00000000-0000-4000-8000-000000000000";
sql(readFileSync("scripts/local-fixtures.sql", "utf8").replaceAll("[테스트]", "[검증용]"));
const checked = response => { assert.ifError(response.error); return response.data; };
const client = key => createClient(status.API_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = client(status.SERVICE_ROLE_KEY);
const password = `Local-cli3-${randomBytes(12).toString("hex")}!`;
sql(`update life_private.signup_settings set org_id='${ORG}',policy_id='${PRIVACY}',enabled=true;`);
const users = [];
const accounts = {};
const base = "http://127.0.0.1:3193";
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: status.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY, AUTH_RATE_LIMIT_SECRET: randomBytes(32).toString("hex"),
  AUTH_CAPTCHA_ENABLED: "false", AUTH_TRUSTED_IP_HEADER: "", AUTH_SITE_ORIGIN: base, CERTIFICATE_VERIFY_ORIGIN: base,
  AUTH_PROFILE: "managed-cloud-v1", AUTH_EMAIL_ENABLED: "true", AUTH_SIGNUP_ENABLED: "true", PREVIEW_REVIEW_ONLY: "false" };
const output = resolve("ops/evidence/supabase-cli-v3");
mkdirSync(output, { recursive: true });
const results = [];
let app, browser;
try {
  for (const [role, roles] of Object.entries({ learner: [], instructor: ["INSTRUCTOR"], staff: ["SYSTEM_ADMIN", "COURSE_MANAGER", "CERTIFIER", "FINANCE", "PERFORMANCE"] })) {
    const email = `cli3-${role}-${randomBytes(6).toString("hex")}@example.invalid`;
    const user = checked(await admin.auth.admin.createUser({ email, password, email_confirm: true,
      user_metadata: { name: `[검증용] CLI3 ${role}`, privacy_policy_id: PRIVACY, privacy_accepted: true, mobile_phone: "+821000001234" },
    })).user;
    users.push(user.id);
    const db = client(status.ANON_KEY);
    const { session } = checked(await db.auth.signInWithPassword({ email, password }));
    const me = checked(await db.rpc("life_identity"));
    assert.ok(me?.id, `${role} must have a real local identity`);
    for (const assigned of roles) sql(`insert into life_role_assignments(person_id,org_id,role) values('${me.id}','${ORG}','${assigned}');`);
    accounts[role] = { db, session, person: me.id };
  }
  sql(`insert into life_private.member_entry_operators(org_id,slot,designated_name,verified_email,auth_user_id)
    values('${ORG}','OPERATIONS','LOCAL TEST','${accounts.staff.session.user.email}','${accounts.staff.session.user.id}')
    on conflict(org_id,slot) do update set verified_email=excluded.verified_email,auth_user_id=excluded.auth_user_id;`);
  sql(`insert into life_offering_instructors(offering_id,person_id) values('${OFFERING}','${accounts.instructor.person}') on conflict do nothing;
    update life_private.signup_settings set org_id='${ORG}',policy_id='${PRIVACY}',enabled=true;`);
  const application = checked(await accounts.learner.db.rpc("life_apply", { f: OFFERING, policy: POLICY }));
  assert.match(application, /^[0-9a-f-]{36}$/);
  const records = seedPageRecords(sql, { org: ORG, year: YEAR, offering: OFFERING, learner: accounts.learner.person, staff: accounts.staff.person, policy: POLICY, completion: "20000000-0000-4000-8000-000000000013" });
  const guide = sql(`select id from life_course_guides where published order by id limit 1`);
  assert.match(guide, /^[a-z0-9-]+$/);
  sql(`update life_course_guides set org_id='${ORG}' where id='${guide}';`);
  const catalog = JSON.parse(readFileSync("src/content/manuals/releases.json", "utf8"));
  const manual = JSON.parse(readFileSync(`src/content/manuals/${catalog.current}.json`, "utf8")).manuals[0].id;
  function discover(folder) {
    return readdirSync(folder, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? discover(resolve(folder, entry.name)) : entry.name === "page.tsx" ? [resolve(folder, entry.name)] : []);
  }
  const root = resolve("src/app");
  const pages = discover(root).sort().map(file => "/" + file.slice(root.length + 1).replace(/(^|\/)\([^/]+\)/g, "").replace(/\/?page\.tsx$/, ""));
  assert.equal(new Set(pages).size, pages.length, "Each discovered page needs a distinct route");
  const negative = new Set(["/badges/[id]", "/certificate/[id]", "/development/[id]", "/performance/reports/[id]", "/instructor-documents/[code]"]);
  function sample(route) {
    if (route.includes("[audience]")) return route.replace("[audience]", manual).replace("[version]", catalog.current);
    if (route.includes("[type]")) return route.replace("[type]", "application");
    if (route.includes("[code]")) return route.replace("[code]", "A".repeat(43));
    if (route.includes("[year]")) return route.replace("[year]", YEAR);
    if (route.includes("[courseId]")) return route.replace("[courseId]", OFFERING);
    if (!route.includes("[id]")) return route;
    let id = OFFERING;
    if (route === "/offerings/[id]") id = records.publicOffering;
    else if (route === "/badges/[id]") id = records.badge;
    else if (route === "/certificate/[id]") id = records.certificate;
    else if (route === "/development/[id]") id = records.proposal;
    else if (route === "/performance/reports/[id]") id = records.report;
    else if (/^\/courses\//.test(route) || route.startsWith("/admin/courses/guides/")) id = guide;
    else if (/^\/admin\/(accounts|learners)\//.test(route)) id = accounts.learner.person;
    else if (route.includes("/applications/")) id = application;
    else if (negative.has(route) || route.startsWith("/admin/messages/")) id = MISSING;
    return route.replace("[id]", id).replace("[kind]", "plan") + (route.startsWith("/admin/accounts/[id]") ? "?group=learner" : "");
  }
  let cases = pages.map(route => ({ route, path: sample(route), role: /^(\/admin|\/operation-documents|\/completion|\/credentials|\/finance|\/performance|\/development|\/quality)/.test(route) ? "staff" : /^\/instructor(\/|$)|^\/mypage\/instructor/.test(route) ? "instructor" : /^(\/mypage|\/learning|\/lms|\/badges\/\[id\]|\/certificate)|^\/offerings\/\[id\]\/apply|^\/parking$/.test(route) ? "learner" : "public", expected: 200 }));
  assert.ok(cases.every(test => !/[\[\]]/.test(test.path)), "Unmapped dynamic route: add a fixture before running");
  // Both document variants share a page module but need independent coverage.
  for (const test of [...cases].filter(test => test.route.includes("[kind]"))) cases.push({ ...test, path: test.path.replace("/plan", "/result") });
  for (const route of negative) {
    const test = cases.find(test => test.route === route);
    cases.push({ ...test, path: route.includes("[code]") ? "/instructor-documents/invalid-test-code" : route.replace("[id]", MISSING), expected: 404 });
  }
  const focused = process.argv.find(arg => arg.startsWith("--route="))?.slice(8);
  if (focused) {
    cases = cases.filter(test => test.route === focused);
    assert.ok(cases.length, "Unknown focused page route");
    cases = cases.flatMap(test => Array.from({ length: 6 }, () => ({ ...test })));
  }
  if (process.argv.includes("--build")) {
    await new Promise((done, reject) => {
      const build = spawn("npm", ["run", "build"], { env, stdio: "inherit" });
      build.once("error", reject); build.once("exit", code => code === 0 ? done() : reject(new Error("Production build failed")));
    });
  }
  // Refuse to test an unrelated app already occupying the test port.
  try { await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) }); throw new Error("TEST_PORT_OCCUPIED"); }
  catch (error) { if (error.message === "TEST_PORT_OCCUPIED") throw error; }
  app = spawn(process.execPath, ["node_modules/next/dist/bin/next", process.argv.includes("--dev") ? "dev" : "start", "-p", "3193", "-H", "127.0.0.1"], { env, stdio: ["ignore", "ignore", "pipe"] });
  const serverErrors = [];
  app.stderr.on("data", chunk => serverErrors.push(String(chunk)));
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    assert.equal(app.exitCode, null, "Test server exited");
    try { ready = (await fetch(`${base}/api/health`)).ok; } catch { /* bounded startup */ }
    if (ready) break;
    await new Promise(done => setTimeout(done, 500));
  }
  assert.ok(ready, "Test server did not become ready");
  browser = await chromium.launch({ headless: true });
  const contexts = {};
  for (const role of ["public", "learner", "instructor", "staff"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    if (accounts[role]) {
      const cookie = `base64-${Buffer.from(JSON.stringify(accounts[role].session)).toString("base64url")}`;
      const name = "sb-127-auth-token";
      const chunks = cookie.match(/.{1,3000}/g);
      await context.addCookies(chunks.map((value, index) => ({ name: chunks.length === 1 ? name : `${name}.${index}`, value, url: base, httpOnly: false, sameSite: "Lax" })));
    }
    contexts[role] = context;
  }
  const aliases = { "/admin/classrooms": "/admin", "/admin/finance": "/finance", "/admin/kpi": "/performance", "/admin/performance": "/performance", "/admin/reports": "/operation-documents/result", "/admin/scholarships": "/admin", "/instructor/syllabus": "/development", "/operation-documents": "/operation-documents/plan", "/auth/complete-signup": "/auth/login", "/auth/security": "/auth/login", "/courses/[id]/apply": "/courses", "/lms": "/mypage", "/lms/[courseId]": "/mypage", "/lms/attendance/qr": "/mypage", "/mypage/documents/[type]": "/mypage/documents", "/manuals/[audience]": `/manuals/${manual}/${catalog.current}` };
  await Promise.all([0, 1, 2].map(async worker => {
  for (const [index, test] of cases.entries()) {
    if (index % 3 !== worker) continue;
    const page = await contexts[test.role].newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error" && /hydration|hydrated|Minified React/i.test(message.text())) errors.push(message.text()); });
    try {
      const response = await page.goto(base + test.path, { waitUntil: "load", timeout: 60000 });
      const actual = response.status();
      const expectedPath = aliases[test.route] ?? new URL(base + test.path).pathname;
      if (test.expected === 200) await page.waitForURL(url => url.pathname === expectedPath, { waitUntil: "load", timeout: 60000 });
      const finalPath = new URL(page.url()).pathname;
      assert.equal(actual, test.expected, `${test.route} status`);
      if (test.expected === 200) {
        assert.equal(finalPath, expectedPath, `${test.route} redirect`);
        // Prove React hydrated instead of waiting for unrelated Link prefetches.
        // dispatchEvent also covers print routes whose CSS hides the header.
        const toggle = page.locator('button[aria-controls="mobile-menu"]');
        await expect.poll(async () => {
          if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.dispatchEvent("click");
          return toggle.getAttribute("aria-expanded");
        }, { timeout: 15000 }).toBe("true");
        await toggle.dispatchEvent("click");
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
        const text = await page.locator("body").innerText();
        assert.ok(text.trim().length > 40, `${test.route} must render content`);
        assert.doesNotMatch(text, /Application error|Internal Server Error|일시적인 오류가 발생|문제가 발생했습니다/);
        if (!process.argv.includes("--dev")) assert.equal(await page.locator("nextjs-portal").count(), 0);
      }
      assert.deepEqual(errors, [], `${test.route} browser exceptions`);
      results.push({ ...test, actual, finalPath, passed: true });
      console.log(`PASS ${test.role} ${test.path}${test.expected === 404 ? " (invalid record rejected)" : ""}`);
    } catch (error) {
      results.push({ ...test, passed: false, error: error.message });
      await page.screenshot({ path: resolve(output, `failure-${index}.png`), fullPage: true }).catch(() => {});
      console.error(`FAIL ${test.role} ${test.path}: ${error.message}`);
    } finally { await page.close(); }
  }
  }));
  // Verify representative authorization boundaries with the same live database.
  for (const path of ["/admin/accounts", "/instructor", "/mypage/documents"]) {
    const response = await contexts.public.request.get(base + path, { maxRedirects: 0 });
    assert.ok([303, 307].includes(response.status()), `Anonymous access to ${path}`);
    assert.match(response.headers().location, /^\/auth\/login\?/);
  }
  const denied = await contexts.learner.request.get(base + "/admin/accounts");
  assert.equal(denied.status(), 404, "Learner cannot enter staff accounts");
  const summary = { cliVersion: execFileSync(cli, ["--version"], { encoding: "utf8" }).trim(), pageModules: pages.length, coveredPageModules: new Set(results.map(row => row.route)).size, cases: results.length, passed: results.filter(row => row.passed).length, failed: results.filter(row => !row.passed).length, negativeRecordCases: results.filter(row => row.expected === 404).length, authorizationChecks: 4, results };
  writeFileSync(resolve(output, focused ? "pages-focused.json" : "pages.json"), JSON.stringify(summary, null, 2) + "\n");
  writeFileSync(resolve(output, "server-errors.private.log"), serverErrors.join("\n"), { mode: 0o600 });
  // Raw server errors may contain private query details; publish only the count.
  console.log(JSON.stringify({ ...summary, results: undefined, serverErrorChunks: serverErrors.length }));
  assert.ok(!serverErrors.some(chunk => /(?:^|\n).*\bError\b|digest:/.test(chunk)), "Unexpected server error; inspect the private local log");
  if (!focused) assert.equal(summary.coveredPageModules, pages.length);
  assert.equal(summary.failed, 0, "All discovered pages must pass; see ops/evidence/supabase-cli-v3/pages.json");
} finally {
  await browser?.close();
  if (app && app.exitCode === null) { app.kill("SIGTERM"); await new Promise(done => app.once("exit", done)); }
  if (users.length) sql(`update life_private.member_entry_operators set auth_user_id=null,verified_email=null where auth_user_id in (${users.map(id => `'${id}'`).join(",")});`);
  for (const user of users) checked(await admin.auth.admin.deleteUser(user));
}
