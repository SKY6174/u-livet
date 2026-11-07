// Read-only production browser coverage. Credentials and browser state stay in memory.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "playwright/test";
import { SUPABASE_CLI } from "./lib/supabase-cli.mjs";

const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
assert.ok(process.argv.includes("--production"), "Explicit --production is required");
const revision = option("revision");
assert.match(revision ?? "", /^[a-f0-9]{40}$/, "Pass the expected deployed revision");
const base = "https://u-livet.org";
const project = "uoebygejgglgiivzgyks";
const backend = `https://${project}.supabase.co`;
const missing = "00000000-0000-4000-8000-000000000000";
const roles = (option("roles") ?? "learner,guest").split(",");
const focused = option("route");
assert.ok(roles.every(role => ["learner", "instructor", "administrator", "guest"].includes(role)));
assert.equal(new Set(roles).size, roles.length, "Duplicate role selection");
const credentials = JSON.parse(readFileSync(resolve(option("accounts") ?? "ops/evidence/production-role-pages/accounts.private.json"), "utf8"));
assert.equal(credentials.project, project);
assert.match(credentials.offering ?? "", /^[a-f0-9-]{36}$/);
for (const account of credentials.accounts) for (const field of ["user", "person", "application"]) if (account[field]) assert.match(account[field], /^[a-f0-9-]{36}$/);
const cli = args => {
  try { return JSON.parse(execFileSync(SUPABASE_CLI, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 4 * 1024 * 1024 })); }
  catch { throw new Error("Production CLI read failed; credentials and query output were not logged"); }
};
const sql = query => cli(["db", "query", `--remote=${project}`, "--read-only", "-o", "json", query]).rows;
const key = cli(["projects", "api-keys", `--remote=${project}`, "-o", "json"]).find(row => row.name === "anon")?.api_key;
assert.ok(key, "An existing public anon key is required");
const client = () => createClient(backend, key, { auth: { persistSession: false, autoRefreshToken: false } });
const publicDb = client();
const checked = response => { if (response.error) throw new Error(`Read failed: ${response.error.code ?? "AUTH"}`); return response.data; };
const setup = sql("select jsonb_build_object('guide',(select id from life_course_guides where published order by id limit 1),'year','10000000-0000-4000-8000-000000000002') data")[0].data;
const syntheticExcluded = sql(`select exists(select 1 from life_private.non_operational_offerings where offering_id='${credentials.offering}') excluded`)[0].excluded;
const introductions = checked(await publicDb.rpc("life_course_introductions", {}, { get: true }));
const publicOffering = introductions.find(row => row.org_id === "10000000-0000-4000-8000-000000000001" && !row.name?.startsWith("[검증용]") && !row.academy?.includes("검증용"))?.id;
const administratorOffering = credentials.privateFixture ? credentials.offering : publicOffering;
const release = JSON.parse(readFileSync("src/content/manuals/releases.json", "utf8"));
const manual = JSON.parse(readFileSync(`src/content/manuals/${release.current}.json`, "utf8")).manuals[0].id;
const discover = folder => readdirSync(folder, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? discover(resolve(folder, entry.name)) : entry.name === "page.tsx" ? [resolve(folder, entry.name)] : []);
const root = resolve("src/app");
const routes = discover(root).sort().map(file => "/" + file.slice(root.length + 1).replace(/(^|\/)\([^/]+\)/g, "").replace(/\/?page\.tsx$/, ""));
assert.equal(new Set(routes).size, routes.length);
if (focused) assert.ok(focused.split(",").every(route => routes.includes(route)), "Unknown focused route");
const directory = resolve("ops/evidence/production-role-pages");
mkdirSync(directory, { recursive: true });
const results = [], sessions = [], blockedMutations = new Set(), edgeReads = [];
let browser;
let interrupted = false;
const interrupt = () => { interrupted = true; void browser?.close(); };
process.once("SIGTERM", interrupt);
process.once("SIGINT", interrupt);
const sanitize = value => String(value).replace(/eyJ[A-Za-z0-9_.-]+/g, "[token]").replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[key]");

function sample(route, account) {
  if (route.includes("[audience]")) return route.replace("[audience]", manual).replace("[version]", release.current);
  if (route.includes("[type]")) return route.replace("[type]", "application");
  if (route.includes("[code]")) return route.replace("[code]", "invalid-production-test-code");
  if (route.includes("[year]")) return route.replace("[year]", setup.year);
  if (route.includes("[courseId]")) return route.replace("[courseId]", credentials.offering ?? missing);
  let id = credentials.offering ?? missing;
  if (account?.role === "administrator" && administratorOffering && (/^\/admin\/offerings\//.test(route) || route === "/completion/[id]" || route.startsWith("/operation-documents/[id]") || route === "/quality/[id]")) id = administratorOffering;
  if (/^\/courses\//.test(route) || route.startsWith("/admin/courses/guides/")) id = setup.guide;
  else if (route.startsWith("/admin/accounts/[id]") && account?.role === "administrator") id = credentials.accounts.find(row => row.role === "instructor").person;
  else if (/^\/admin\/(accounts|learners)\//.test(route)) id = credentials.accounts[0].person;
  else if (route.includes("/applications/")) id = account?.application ?? credentials.accounts[0].application ?? missing;
  else if (route === "/offerings/[id]") id = publicOffering ?? missing;
  else if (["/badges/[id]", "/certificate/[id]", "/development/[id]", "/performance/reports/[id]"].includes(route) || route.startsWith("/admin/messages/")) id = missing;
  return route.replace("[id]", id).replace("[kind]", "plan") + (route.startsWith("/admin/accounts/[id]") ? `?group=${account?.role === "administrator" ? "instructor" : "learner"}` : "");
}

function expectation(route, role, account) {
  const guest = role === "guest", office = role === "administrator", instructor = role === "instructor";
  const privateRoute = /^(\/admin|\/operation-documents|\/completion|\/credentials|\/finance|\/performance|\/development|\/quality|\/mypage|\/learning|\/lms|\/instructor(?:\/|$)|\/certificate|\/badges\/\[id\]|\/parking)/.test(route) || route.endsWith("/apply") && route.startsWith("/offerings/");
  const qr = route.endsWith("/attendance/checkin");
  if (guest && privateRoute && !qr) return { outcome: "login", expectedPath: "/auth/login" };
  if (!guest && route === "/auth/complete-signup") return { outcome: "login", expectedPath: "/auth/login", positiveDetail: false, state: "native-email-requires-login" };
  const absent = ["/badges/[id]", "/certificate/[id]", "/development/[id]", "/performance/reports/[id]", "/instructor-documents/[code]"].includes(route) || route === "/offerings/[id]" && !publicOffering;
  if (absent) return { outcome: "missing", positiveDetail: false };
  const documentBoard = ["/operation-documents", "/operation-documents/plan", "/operation-documents/result"].includes(route);
  if (documentBoard && !office) return { outcome: "render", expectedPath: route === "/operation-documents" ? "/operation-documents/plan" : route, restrictedBoard: true };
  if (/^(\/admin|\/completion|\/credentials|\/finance|\/performance)/.test(route) && !office || route.startsWith("/operation-documents/") && !office && !account?.operationResponsible) return { outcome: "denied" };
  const operationalAdminSample = office && administratorOffering && (/^\/admin\/offerings\//.test(route) || route === "/completion/[id]" || route.startsWith("/operation-documents/[id]") || route === "/quality/[id]");
  if (syntheticExcluded && !operationalAdminSample && (route === "/offerings/[id]/apply" || route.startsWith("/mypage/applications/") || route.startsWith("/instructor/offerings/") || route.startsWith("/admin/offerings/") || route.includes("/applications/[id]") || route.startsWith("/admin/learners/[id]") || route.startsWith("/operation-documents/[id]") || route === "/completion/[id]" || route === "/quality/[id]" || route.startsWith("/learning/") && !qr)) return { outcome: "denied", positiveDetail: false, state: "synthetic-record-excluded" };
  if (/^\/instructor(?:\/|$)/.test(route) && !instructor) return { outcome: "denied" };
  if (route === "/admin/accounts/new" && !account?.memberEntryOperator) return { outcome: "denied", state: "designated-registration-required" };
  if (route.startsWith("/learning/") && !qr && !account?.enrolled || route.startsWith("/quality/") && !office && !instructor) return { outcome: "denied", positiveDetail: false };
  if (route === "/learning/[id]" && !account?.enrolled) return { outcome: "denied", positiveDetail: false };
  if (route === "/mypage/profile" && role !== "learner") return { outcome: "denied" };
  if (route.startsWith("/mypage/applications/") && !account?.application) return { outcome: "denied" };
  const aliases = { "/admin/classrooms": "/admin", "/admin/finance": "/finance", "/admin/kpi": "/performance", "/admin/performance": "/performance", "/admin/reports": "/operation-documents/result", "/admin/scholarships": "/admin", "/instructor/syllabus": "/development", "/operation-documents": "/operation-documents/plan", "/courses/[id]/apply": "/courses", "/manuals/[audience]": `/manuals/${manual}/${release.current}`, "/mypage/documents/[type]": "/mypage/documents" };
  let path = aliases[route] ?? new URL(base + sample(route, account)).pathname;
  if (["/lms", "/lms/[courseId]", "/lms/attendance/qr"].includes(route)) path = guest ? "/auth/login" : instructor ? "/instructor" : "/mypage";
  if (route === "/auth/security") path = guest ? "/auth/login" : "/";
  if (route === "/auth/login") path = guest ? "/auth/login" : "/";
  if (route === "/auth/complete-signup") path = guest ? "/auth/login" : "/";
  if (route === "/mypage" && instructor) path = "/instructor";
  if (route === "/mypage/notifications" && role !== "learner") path = instructor ? "/instructor" : "/mypage";
  return { outcome: "render", expectedPath: path, ...(qr ? { positiveDetail: false, state: "invalid-qr" } : {}) };
}

try {
  browser = await chromium.launch({ headless: true });
  const version = await (await fetch(base + "/api/version")).json();
  assert.equal(version.revision, revision, "Unexpected deployed revision");
  assert.equal(version.environment, "production");
  assert.equal(version.reviewOnly, false);
  for (const role of roles) {
    const account = role === "guest" ? null : credentials.accounts.find(row => row.role === role) ?? (role === "learner" ? credentials.accounts[0] : null);
    assert.ok(role === "guest" || account, `No supplied ${role} test identity`);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const documentTokens = [];
    let roleDb;
    await context.route("**/*", async route => {
      const request = route.request();
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        const url = new URL(request.url());
        let body;
        try { body = request.postDataJSON(); } catch { /* Unknown writes remain blocked. */ }
        const documentEndpoint = url.origin === backend && url.pathname === "/functions/v1/instructor-documents";
        const ownSession = body?.action === "session" && body.person_id === account?.person && body.org_id === "10000000-0000-4000-8000-000000000001";
        const ownRead = body?.action === "advisory-intake-context" && documentTokens.includes(body.voter_token);
        if (account && documentEndpoint && request.method() === "POST" && (ownSession || ownRead)) {
          let response;
          try { response = await route.fetch({ maxRedirects: 0, timeout: 20000 }); }
          catch { edgeReads.push({ role, action: body.action, status: 0 }); return route.abort("failed"); }
          edgeReads.push({ role, action: body.action, status: response.status() });
          if (ownSession && response.ok()) {
            const json = await response.json();
            if (json?.data?.token) documentTokens.push(json.data.token);
          }
          return route.fulfill({ response });
        }
        blockedMutations.add(`${request.method()} ${new URL(request.url()).pathname}`);
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });
    if (account) {
      assert.match(account.email, /@example\.invalid$/, "Use dedicated synthetic identities");
      assert.match(account.user ?? "", /^[a-f0-9-]{36}$/);
      const db = client();
      roleDb = db;
      const { session, user } = checked(await db.auth.signInWithPassword({ email: account.email, password: account.password ?? credentials.password }));
      assert.equal(user.id, account.user);
      sessions.push(db);
      const identity = checked(await db.rpc("life_identity"));
      assert.equal(identity.id, account.person);
      const granted = identity.roles.map(row => row.role);
      if (role === "learner") assert.deepEqual(granted, [], "Learner has unexpected privileges");
      if (role === "learner") assert.deepEqual(checked(await db.rpc("life_operation_list")), [], "Learner must not read managed operation documents");
      if (role === "instructor") assert.deepEqual(granted, ["INSTRUCTOR"]);
      if (role === "administrator") for (const required of ["SYSTEM_ADMIN", "COURSE_MANAGER", "CERTIFIER", "FINANCE", "PERFORMANCE"]) assert.ok(granted.includes(required));
      const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
      const chunks = value.match(/.{1,3000}/g);
      await context.addCookies(chunks.map((chunk, index) => ({ name: `sb-${project}-auth-token` + (chunks.length === 1 ? "" : `.${index}`), value: chunk, url: base, httpOnly: false, sameSite: "Lax", secure: true })));
    }
    let cases = routes.map(route => ({ route, path: sample(route, account), ...expectation(route, role, account) }));
    for (const row of [...cases].filter(row => row.route.includes("[kind]"))) cases.push({ ...row, path: row.path.replace("/plan", "/result"), ...(row.outcome === "render" ? { expectedPath: row.path.replace("/plan", "/result").split("?")[0] } : {}) });
    if (role === "administrator") {
      for (const group of ["learner", "instructor"]) cases.push({ route: "/admin/accounts", path: `/admin/accounts?group=${group}`, outcome: "render", expectedPath: "/admin/accounts" });
      const detail = cases.find(row => row.route === "/admin/accounts/[id]");
      cases.push({ ...detail, path: detail.path + "&view=history" });
    }
    if (focused) { cases = cases.filter(row => focused.split(",").includes(row.route)); assert.ok(cases.length, "Unknown focused route"); }
    assert.ok(cases.every(row => !/[\[\]]/.test(row.path)), "Unmapped dynamic route");
    async function runCase(row) {
        const page = await context.newPage(), errors = [];
        page.on("pageerror", error => errors.push(sanitize(error.message)));
        page.on("console", message => { if (message.type() === "error" && /hydration|hydrated|Minified React/i.test(message.text())) errors.push(sanitize(message.text())); });
        const item = { role, route: row.route, path: row.path, expected: row.outcome, state: row.state, operationResponsible: !!account?.operationResponsible, positiveDetail: row.outcome === "render" && row.positiveDetail !== false };
        try {
          const response = await page.goto(base + row.path, { waitUntil: "load", timeout: 45000 });
          item.status = response.status();
          assert.ok(item.status < 500, "Server error response");
          if (row.outcome === "login" || row.outcome === "render") await page.waitForURL(url => url.pathname === row.expectedPath, { waitUntil: "load", timeout: 15000 });
          item.finalPath = new URL(page.url()).pathname;
          const toggle = page.locator('button[aria-controls="mobile-menu"]');
          await expect.poll(async () => {
            if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.dispatchEvent("click");
            return toggle.getAttribute("aria-expanded");
          }, { timeout: 15000 }).toBe("true");
          await toggle.dispatchEvent("click");
          await expect(toggle).toHaveAttribute("aria-expanded", "false");
          await page.setViewportSize({ width: 1280, height: 900 });
          await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
          if (row.route === "/mypage/instructor/documents" && role === "instructor") {
            await expect(page.getByRole("button", { name: "인증 해제", exact: true })).toBeVisible({ timeout: 20000 });
            await expect.poll(() => edgeReads.some(read => read.role === role && read.action === "advisory-intake-context" && read.status === 200), { timeout: 20000 }).toBe(true);
            await expect(page.locator('input[type="file"]').first()).toBeAttached({ timeout: 20000 });
          }
          if (credentials.privateFixture && row.route === "/learning/[id]" && row.outcome === "render") await expect(page.locator("summary").filter({ hasText: "[검증용] Private lesson" })).toBeVisible();
          const text = await page.locator("body").innerText();
          const denied = /페이지를 찾을 수 없습니다|관리 업무에 접근할 수 없습니다/.test(text);
          if (row.restrictedBoard && role === "learner") assert.equal(await page.locator('a[href^="/operation-documents/"]').evaluateAll(links => links.filter(link => /\/operation-documents\/[a-f0-9-]{36}\//.test(link.getAttribute("href"))).length), 0, "Learner must not see protected document links");
          if (["denied", "missing"].includes(row.outcome)) assert.ok(denied, "Expected access denial or missing-record view");
          else { assert.ok(!denied, "Unexpected access denial"); assert.ok(text.trim().length > 40); }
          assert.doesNotMatch(text, /Application error|Internal Server Error|문제가 발생했습니다|일시적인 오류가 발생|정보를 불러오지 못했습니다|관리 화면을 불러오지 못했습니다/);
          assert.equal(await page.getByRole("heading", { name: /불러오지 못했습니다|불러올 수 없습니다/ }).count(), 0, "Data loading error view");
          assert.deepEqual(errors, [], "Browser exceptions");
          assert.equal(await page.locator("nextjs-portal").count(), 0);
          item.passed = true;
          console.log(`PASS ${role} ${row.route} (${row.outcome})`);
        } catch (error) {
          item.passed = false; item.error = sanitize(error.message); item.browserErrors = errors;
          console.error(`FAIL ${role} ${row.route}: ${item.error.split("\n")[0]}`);
        } finally { results.push(item); await page.close(); }
    }
    // Native email accounts intentionally leave OAuth completion by signing out.
    // Keep that case after all concurrent reads so it cannot invalidate them.
    const normalCases = cases.filter(row => row.route !== "/auth/complete-signup");
    await Promise.all([0, 1].map(async worker => {
      for (const [index, row] of normalCases.entries()) { if (interrupted) break; if (index % 2 === worker) await runCase(row); }
    }));
    for (const token of documentTokens) checked(await roleDb.functions.invoke("instructor-documents", { body: { action: "logout", voter_token: token } }));
    const completion = cases.find(row => row.route === "/auth/complete-signup");
    if (!interrupted && completion) await runCase(completion);
    await context.close();
  }
} finally {
  await browser?.close();
  for (const db of sessions) await db.auth.signOut({ scope: "local" }).catch(() => {});
  const summary = { checkedAt: new Date().toISOString(), revision, origin: base, pageModules: routes.length, focusedRoute: focused, roles, cases: results.length, passed: results.filter(row => row.passed).length, failed: results.filter(row => !row.passed).length, blockedMutations: [...blockedMutations], edgeReads, results };
  writeFileSync(resolve(directory, `pages-${roles.join("-")}${focused ? "-focused" : ""}.json`), JSON.stringify(summary, null, 2) + "\n", { mode: 0o600 });
  console.log(JSON.stringify({ ...summary, results: undefined }));
}
assert.ok(results.length && results.every(row => row.passed), "Production page failures; inspect redacted evidence");
assert.ok(!interrupted, "Production page verification was interrupted");
assert.equal(blockedMutations.size, 0, "An unexpected write was attempted; inspect the action before accepting coverage");
