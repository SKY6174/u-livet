// Real local Auth and pages; run test:application-flow first to create private fixtures.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const dbDir = process.env.APPLICATION_TEST_DB_DIR;
assert.ok(dbDir, "Set APPLICATION_TEST_DB_DIR to the dedicated uc-life-issues project.");
assert.match(readFileSync(resolve(dbDir, "supabase/config.toml"), "utf8"), /^project_id = "uc-life-issues"$/m);
const status = JSON.parse(execFileSync("supabase", ["status", "--workdir", dbDir, "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
assert.equal(status.API_URL, "http://127.0.0.1:56321");
const fixture = JSON.parse(readFileSync("/tmp/u-livet-issues-browser-fixtures.json", "utf8"));
const base = "http://127.0.0.1:3100";
assert.equal(fixture.base, base);
const output = resolve(process.env.DESIGN_TEST_OUTPUT ?? "artifacts/design-refresh");
mkdirSync(output, { recursive: true });
const checks = [], measurements = [], screenshots = [];
const pass = label => { checks.push(label); console.log(`PASS ${label}`); };
const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3100", "-H", "127.0.0.1"], {
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: status.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY, AUTH_RATE_LIMIT_SECRET: randomBytes(32).toString("hex"),
    AUTH_TRUSTED_IP_HEADER: "", AUTH_CAPTCHA_ENABLED: "false", AUTH_SITE_ORIGIN: base, CERTIFICATE_VERIFY_ORIGIN: base,
    AUTH_PROFILE: "managed-cloud-v1", AUTH_EMAIL_ENABLED: "true", AUTH_SIGNUP_ENABLED: "true", PREVIEW_REVIEW_ONLY: "false" },
  stdio: ["ignore", "ignore", "pipe"],
});
app.stderr.on("data", chunk => { if (/EADDRINUSE/.test(String(chunk))) console.error("Port 3100 occupied."); });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { ready = (await fetch(`${base}/api/health`)).ok; } catch { /* Starting. */ }
    if (ready) break;
    if (app.exitCode != null) throw new Error("Local app exited.");
    await new Promise(r => setTimeout(r, 500));
  }
  assert.ok(ready);
  browser = await chromium.launch({ headless: true });
  const contexts = {};
  async function contextFor(role) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    if (role !== "anonymous") {
      await page.goto(`${base}/auth/login?audience=learner&next=%2Fcourses`);
      const toggle = page.getByRole("button", { name: "이메일로 로그인", exact: true });
      if (await toggle.count()) await toggle.click();
      await page.locator('input[name="email"]').waitFor({ state: "visible" });
      await page.locator('input[name="email"]').fill(fixture[role].email);
      await page.locator('input[name="password"]').fill(fixture.password);
      await page.getByRole("button", { name: "로그인", exact: true }).click();
      await page.waitForURL(`${base}/courses`);
    }
    contexts[role] = { context, page };
    return page;
  }
  async function visit(page, path, width, textZoom = false) {
    await page.setViewportSize({ width, height: 1000 });
    const response = await page.goto(`${base}${path}`);
    assert.ok(response.ok(), `${path}: ${response.status()}`);
    if (textZoom) await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  }
  async function layout(page, label) {
    const metrics = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
      bodyFont: parseFloat(getComputedStyle(document.body).fontSize),
      titleFont: document.querySelector(".page-title") ? parseFloat(getComputedStyle(document.querySelector(".page-title")).fontSize) : null,
      searchWidth: document.querySelector('main input[name="q"]')?.getBoundingClientRect().width ?? null,
      titleWidth: document.querySelector('main .page-title')?.getBoundingClientRect().width ?? null,
      smallControls: [...document.querySelectorAll('main button, main input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), main select, main a.btn-primary, main a.btn-secondary')]
        .filter(e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height < 47.9)
        .map(e => e.tagName + ":" + e.textContent.trim().slice(0, 40)),
    }));
    measurements.push({ label, ...metrics });
    assert.ok(metrics.scroll <= metrics.width + 1, `${label}: overflow ${metrics.scroll}/${metrics.width}`);
    assert.deepEqual(metrics.smallControls, [], `${label}: controls below 48px`);
    assert.ok(metrics.bodyFont >= 18, label);
    if (metrics.titleFont !== null) assert.equal(metrics.titleFont, (metrics.width >= 768 ? 40 : 30) * (metrics.bodyFont / 18), `${label}: title size`);
    if (metrics.width === 360 && metrics.bodyFont === 18) {
      if (metrics.searchWidth !== null) assert.ok(metrics.searchWidth >= 250, `${label}: usable search width`);
      if (metrics.titleWidth !== null) assert.ok(metrics.titleWidth >= 250, `${label}: usable title width`);
    }
    pass(`layout ${label}`);
  }
  async function screenshot(page, name) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: resolve(output, name), fullPage: !name.includes("menu") });
    screenshots.push(name);
  }
  async function mobileMenu(page, role) {
    const toggle = page.locator('button[aria-controls="mobile-menu"]');
    await toggle.focus(); await page.keyboard.press("Enter");
    const menu = page.getByRole("navigation", { name: "모바일 메뉴", exact: true });
    await menu.waitFor({ state: "visible" });
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    await page.keyboard.press("Tab");
    assert.ok(await menu.evaluate(e => e.contains(document.activeElement)));
    const hrefs = await menu.locator("a").evaluateAll(links => links.map(e => e.getAttribute("href")));
    assert.ok(hrefs.includes("/courses"));
    assert.equal(hrefs.includes("/admin"), role === "manager");
    assert.equal(hrefs.includes("/instructor"), role === "instructor");
    assert.equal(hrefs.includes("/mypage"), role === "learner" || role === "manager");
    assert.ok(await menu.locator('a[href="/courses"][aria-current="page"]').count());
    const fonts = await menu.locator('a[href="/courses"]').evaluate(e => ({ font: parseFloat(getComputedStyle(e).fontSize), height: e.getBoundingClientRect().height }));
    assert.ok(fonts.font >= 20 && fonts.height >= 48);
    await screenshot(page, `mobile-menu-${role}-360.png`);
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("navigation", { name: "모바일 메뉴" }).count(), 0);
    assert.ok(await toggle.evaluate(e => e === document.activeElement));
    const focusOutline = await toggle.evaluate(e => getComputedStyle(e).outlineWidth);
    assert.equal(focusOutline, "3px");
    pass(`mobile keyboard, role links, current position, focus: ${role}`);
  }
  const anonymous = await contextFor("anonymous");
  const offering = `/offerings/${fixture.ids.offering}`;
  for (const width of [360, 768, 1440, 720]) {
    for (const [label, path] of [["home", "/"], ["courses", "/courses"], ["offering", offering], ["list", "/courses?view=list"], ["about", "/about"], ["terms", "/terms"], ["procedure", "/operation-procedure"]]) {
      await visit(anonymous, path, width); await layout(anonymous, `anonymous ${label} ${width}`);
      if ([360, 1440].includes(width) && ["home", "courses", "offering"].includes(label)) await screenshot(anonymous, `after-${label}-${width}.png`);
    }
  }
  await visit(anonymous, "/courses", 360); await mobileMenu(anonymous, "anonymous");
  await visit(anonymous, "/", 1440);
  await anonymous.locator('input[name="q"]').fill("__no_such_course_issue122__");
  await anonymous.getByRole("button", { name: "교육과정 검색", exact: true }).click();
  await anonymous.waitForURL(/\/courses\?q=/);
  assert.ok((await anonymous.locator("main").innerText()).includes("조건에 맞는 교육과정이 없습니다"));
  pass("home search uses existing query and displays real empty state");
  const paths = { learner: ["/mypage", `${offering}/apply`], manager: [`/admin/offerings/${fixture.ids.offering}/manage`, "/admin"], instructor: ["/instructor"] };
  for (const role of ["learner", "manager", "instructor"]) {
    const page = await contextFor(role);
    for (const width of [360, 768, 1440, 720]) for (const path of paths[role]) {
      await visit(page, path, width); await layout(page, `${role} ${path.replace(fixture.ids.offering, "fixture")} ${width}`);
      if ([360, 1440].includes(width) && path === paths[role][0]) await screenshot(page, `${role}-${width}.png`);
    }
    await visit(page, "/courses", 360); await mobileMenu(page, role);
    for (const path of ["/courses", ...paths[role]]) {
      await visit(page, path, 1440, true); await layout(page, `${role} 200% text ${path.replace(fixture.ids.offering, "fixture")}`);
    }
    if (role === "learner") {
      await visit(page, `${offering}/apply`, 360);
      const toggle = page.getByRole("button", { name: "전체메뉴 열기", exact: true }); await toggle.click();
      assert.equal(await page.getByRole("navigation", { name: "모바일 메뉴" }).locator('a[href="/courses"]').getAttribute("aria-current"), "page");
      await page.keyboard.press("Escape");
      const submit = page.getByRole("button", { name: "신청서 제출", exact: true });
      await submit.focus(); assert.ok(await submit.evaluate(e => e === document.activeElement));
      pass("application path highlights courses and submit receives keyboard focus");
    }
  }
  const manager = contexts.manager.page;
  for (const textZoom of [false, true]) {
    await visit(manager, "/courses", 1440, textZoom);
    const toggle = manager.getByRole("button", { name: "사업단 관리 하위 메뉴", exact: true });
    const primaryAdmin = manager.getByRole("navigation", { name: "주 메뉴", exact: true }).getByRole("link", { name: "사업단 관리", exact: true });
    await primaryAdmin.hover();
    const submenu = manager.locator("#desktop-admin-submenu"); await submenu.waitFor({ state: "visible" });
    const firstLink = await submenu.locator("a").first().boundingBox();
    const primaryBounds = await primaryAdmin.boundingBox();
    await manager.mouse.move(primaryBounds.x + primaryBounds.width / 2, firstLink.y + 8, { steps: 12 });
    await manager.mouse.move(firstLink.x + firstLink.width / 2, firstLink.y + firstLink.height / 2, { steps: 12 });
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    await toggle.focus();
    if (await toggle.getAttribute("aria-expanded") !== "true") await manager.keyboard.press("Enter");
    await submenu.waitFor({ state: "visible" });
    const bounds = await submenu.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 1441);
    await manager.keyboard.press("Tab"); assert.ok(await submenu.evaluate(e => e.contains(document.activeElement)));
    await screenshot(manager, `desktop-admin-menu${textZoom ? "-text200" : ""}.png`);
    await manager.keyboard.press("Escape"); assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    assert.ok(await toggle.evaluate(e => e === document.activeElement));
    assert.equal(await submenu.getAttribute("inert"), "");
    pass(`desktop submenu hover, keyboard, bounds, Escape, inert${textZoom ? " 200% text" : ""}`);
  }
  await visit(anonymous, "/", 1440, true); await layout(anonymous, "anonymous home 200% text");
  await visit(anonymous, "/courses", 360, true); await layout(anonymous, "anonymous courses 360 200% text");
  writeFileSync(resolve(output, "result.json"), JSON.stringify({ verifiedAt: new Date().toISOString(), environment: "dedicated local Supabase + production Next build + Chromium", checks, measurements, screenshots,
    zoom: "720 CSS px for 1440px at 200% page zoom, plus 200% root font size", limitation: "Synthetic local fixtures only; no hosted applicant personal data." }, null, 2) + "\n");
  console.log(`${checks.length} checks passed; evidence: ${output}`);
} finally {
  await browser?.close(); app.kill("SIGTERM");
}
