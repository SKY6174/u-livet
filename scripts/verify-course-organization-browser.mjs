// Native local REST + production Next build. Synthetic data; no remote targets.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { createHmac, randomBytes } from 'node:crypto';
import http from 'node:http';
import { chromium } from 'playwright';

assert.equal(process.argv.length, 2);
const SOURCE = 'supabase_db_uc-life-issues';
const runId = randomBytes(6).toString('hex');
const DB = 'life_course_org_test_' + runId;
let databaseCreated = false, service, next, browser, proxy, logs = '';
const docker = (args, input) => {
  try { return execFileSync('docker', args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 }); }
  catch { throw new Error('LOCAL_DOCKER_OPERATION_FAILED'); }
};
const sql = input => docker(['exec', '-i', SOURCE, 'psql', '-XqAt', '-U', 'supabase_admin', '-d', DB, '-v', 'ON_ERROR_STOP=1'], input);
const inspect = name => JSON.parse(docker(['inspect', name]))[0];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function ready(url) {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch {} await sleep(200); }
  throw new Error('LOCAL_SERVICE_NOT_READY');
}
try {
  docker(['exec', SOURCE, 'createdb', '-U', 'supabase_admin', DB]); databaseCreated = true;
  sql(docker(['exec', SOURCE, 'pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '--schema-only']));
  sql(readFileSync('supabase/migrations/20261008131827_course_catalog_organization.sql', 'utf8'));
  sql(readFileSync('scripts/verify-public-course-introductions.sql', 'utf8'));
  assert.equal(sql('select count(*) from public.life_offerings;').trim(), '0');
  const seed = readFileSync('scripts/verify-public-course-introductions.sql', 'utf8').split('set local role anon;')[0]
    .replace('public-introduction-test', 'uc-anchor').replaceAll('2026-09-01', '2026-10-01').replaceAll('2026-09-30', '2026-12-31');
  sql(seed + seed.replace('begin;', '').replaceAll('90000000', '91000000').replace('uc-anchor', 'uc-sanhak') + 'commit;');
  const original = inspect('supabase_rest_uc-life-issues');
  const env = Object.fromEntries(original.Config.Env.map(value => { const i = value.indexOf('='); return [value.slice(0, i), value.slice(i + 1)]; }));
  const uri = new URL(env.PGRST_DB_URI); uri.pathname = '/' + DB; env.PGRST_DB_URI = uri.toString();
  // The source uses a JWK set; give this isolated anonymous-only REST its own HS256 key.
  env.PGRST_JWT_SECRET = randomBytes(48).toString('base64');
  const network = Object.keys(original.NetworkSettings.Networks)[0]; assert(network.includes('uc-life-issues'));
  service = 'course-org-test-' + runId;
  docker(['run', '-d', '--name', service, '--label', 'course-org-test=' + runId, '--network', network,
    '-p', '127.0.0.1::3000', ...Object.entries(env).flatMap(([key, value]) => ['-e', key + '=' + value]), original.Config.Image]);
  const port = inspect(service).NetworkSettings.Ports['3000/tcp'][0]; assert.equal(port.HostIp, '127.0.0.1');
  const rest = 'http://127.0.0.1:' + port.HostPort; await ready(rest);
  proxy = http.createServer(async (request, response) => {
    try {
      const headers = { ...request.headers }; delete headers.host;
      const result = await fetch(rest + request.url.replace(/^\/rest\/v1/, ''), { method: request.method, headers });
      response.writeHead(result.status, Object.fromEntries([...result.headers].filter(([key]) => !['content-encoding', 'content-length', 'transfer-encoding'].includes(key))));
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch { response.writeHead(502); response.end('LOCAL_PROXY_ERROR'); }
  });
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
  const api = 'http://127.0.0.1:' + proxy.address().port;
  const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
  const payload = Buffer.from(JSON.stringify({ role: 'anon', iss: 'supabase', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const anonKey = header + '.' + payload + '.' + createHmac('sha256', env.PGRST_JWT_SECRET).update(header + '.' + payload).digest('base64url');
  const native = await fetch(api + '/rest/v1/rpc/life_course_introductions?select=id,org_id', { headers: { Authorization: 'Bearer ' + anonKey } });
  assert.equal(native.status, 200); assert.equal((await native.json()).length, 6);
  const probe = http.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const nextPort = probe.address().port; await new Promise(resolve => probe.close(resolve));
  next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(nextPort), '-H', '127.0.0.1'], {
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: api, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  next.stdout.on('data', value => { logs += value; }); next.stderr.on('data', value => { logs += value; });
  const origin = 'http://127.0.0.1:' + nextPort; await ready(origin + '/api/version');
  browser = await chromium.launch({ headless: true }); mkdirSync('output/course-organization-filter', { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/courses', { waitUntil: 'networkidle' });
  assert.equal(await page.locator('[data-course-card]').count(), 4);
  assert.equal(await page.locator('form select').first().getAttribute('name'), 'org');
  for (const [org, prefix] of [['uc-anchor', '90000000'], ['uc-sanhak', '91000000']]) {
    await page.locator('select[name="org"]').selectOption(org);
    await Promise.all([page.waitForURL(url => url.searchParams.get('org') === org), page.getByRole('button', { name: '검색', exact: true }).click()]);
    assert.equal(await page.locator('[data-course-card]').count(), 2);
    const hrefs = await page.locator('[data-course-card] a').evaluateAll(elements => elements.map(element => element.getAttribute('href')));
    assert(hrefs.every(href => href.startsWith('/offerings/' + prefix)));
    await Promise.all([page.waitForURL(url => url.searchParams.get('view') === 'list'), page.getByRole('link', { name: '리스트형' }).click()]);
    assert.equal(new URL(page.url()).searchParams.get('org'), org);
    assert.equal(await page.locator('tbody tr').count(), 2); assert.equal(await page.locator('select[name="org"]').inputValue(), org);
    await page.locator('input[name="q"]').fill('없는 과정');
    await page.getByRole('button', { name: '검색', exact: true }).click(); await page.waitForLoadState('networkidle');
    assert(await page.getByText('조건에 맞는 교육과정이 없습니다').count()); assert.equal(await page.locator('select[name="org"]').inputValue(), org);
    await page.goto(origin + '/courses', { waitUntil: 'networkidle' });
    console.log('PASS native browser ' + org + ': GET filtering, links, view toggle, compound empty state');
  }
  await page.setViewportSize({ width: 390, height: 1100 });
  await page.goto(origin + '/courses?org=uc-sanhak', { waitUntil: 'networkidle' });
  assert.equal(await page.locator('[data-course-card]').count(), 2);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: 'output/course-organization-filter/local-mobile.png', fullPage: true });
  assert.deepEqual(errors, []); assert(!/Error:|LOCAL_PROXY_ERROR|⨯/.test(logs), 'Next runtime errors');
  console.log('PASS mobile and runtime checks');
} finally {
  if (browser) await browser.close();
  if (next && next.exitCode === null) { next.kill('SIGTERM'); await new Promise(resolve => next.once('exit', resolve)); }
  if (proxy) await new Promise(resolve => proxy.close(resolve));
  if (service) { assert.equal(inspect(service).Config.Labels['course-org-test'], runId); docker(['rm', '-f', service]); }
  if (databaseCreated) docker(['exec', SOURCE, 'dropdb', '-U', 'supabase_admin', DB]);
}
