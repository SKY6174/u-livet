// Local native Auth + REST + production Next build. Never accepts a remote target.
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import http from 'node:http';
import { createServerClient } from '@supabase/ssr';
import { chromium } from 'playwright';

assert.equal(process.argv.length, 2);
const DB = 'life_account_profile_test_20261008';
const SOURCE = 'supabase_db_uc-life-issues';
const runId = randomBytes(8).toString('hex');
const owned = [], contexts = [];
let next, browser, proxy;
let logs = '';
const docker = (args, input) => {
  try { return execFileSync('docker', args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 }); }
  catch (error) { throw new Error('LOCAL_DOCKER_OPERATION_FAILED: ' + (error.stderr?.toString().match(/ERROR:([^\n]+)/)?.[1] ?? 'command failed')); }
};
const sql = input => docker(['exec', '-i', SOURCE, 'psql', '-XqAt', '-U', 'supabase_admin', '-d', DB, '-v', 'ON_ERROR_STOP=1'], input);
const quote = value => `'${value.replaceAll("'", "''")}'`;
const inspect = name => JSON.parse(docker(['inspect', name]))[0];
const envOf = item => Object.fromEntries(item.Config.Env.map(entry => { const p = entry.indexOf('='); return [entry.slice(0, p), entry.slice(p + 1)]; }));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function diagnostics(service) {
  const result = spawnSync('docker', ['logs', '--tail', '6', service], { encoding: 'utf8' });
  console.error((result.stdout + result.stderr).replace(/postgres(?:ql)?:\/\/\S+/g, '[local database]'));
}
async function ready(url, service) {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch {} await sleep(200); }
  if (service) {
    diagnostics(service);
  }
  throw new Error('LOCAL_SERVICE_NOT_READY');
}
function startClone(name, port) {
  const source = inspect(name), env = envOf(source);
  const uriKey = name.includes('_auth_') ? 'GOTRUE_DB_DATABASE_URL' : 'PGRST_DB_URI';
  const uri = new URL(env[uriKey]); uri.pathname = '/' + DB; env[uriKey] = uri.toString();
  const network = Object.keys(source.NetworkSettings.Networks)[0];
  assert(network.includes('uc-life-issues'));
  const clone = 'account-profile-' + runId + '-' + port;
  docker(['run', '-d', '--name', clone, '--label', 'account-profile-test=' + runId, '--network', network,
    '-p', `127.0.0.1::${port}`, ...Object.entries(env).flatMap(([key, value]) => ['-e', `${key}=${value}`]), source.Config.Image]);
  owned.push(clone);
  const published = inspect(clone).NetworkSettings.Ports[port + '/tcp']?.[0];
  if (!published) { diagnostics(clone); throw new Error('LOCAL_CONTAINER_EXITED'); }
  assert.equal(published.HostIp, '127.0.0.1');
  return { url: 'http://127.0.0.1:' + published.HostPort, env, name: clone };
}
try {
  assert.equal(sql('select count(*) from public.life_people;').trim(), '0', 'Fresh isolated schema snapshot required');
  const versions = docker(['exec', SOURCE, 'pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '--data-only', '--table=auth.schema_migrations', '--no-owner']);
  sql(versions);
  sql(readFileSync('scripts/verify-account-profile.sql', 'utf8').replace('\\set ON_ERROR_STOP on', '').replace(/rollback;\s*$/i, 'commit;'));
  const password = 'LocalOnly-' + randomBytes(18).toString('hex') + '1!';
  sql(`grant usage,create on schema auth to supabase_auth_admin;
    grant all on all tables in schema auth to supabase_auth_admin;
    grant all on all sequences in schema auth to supabase_auth_admin;
    update auth.users set instance_id='00000000-0000-0000-0000-000000000000',aud='authenticated',role='authenticated',
      confirmation_token='',recovery_token='',email_change_token_new='',email_change='',
      email_change_token_current='',phone_change='',phone_change_token='',reauthentication_token='',email_change_confirm_status=0,
      raw_app_meta_data='{"provider":"email","providers":["email"]}',
      raw_user_meta_data='{}',encrypted_password=extensions.crypt(${quote(password)},extensions.gen_salt('bf'));
    update life_private.credential_state set policy_version=1,changed_at=now()-interval '1 hour';
    delete from auth.mfa_amr_claims;
    delete from auth.sessions;
    delete from auth.mfa_factors;
    insert into auth.identities(user_id,provider_id,provider,identity_data,created_at,updated_at,last_sign_in_at)
      select id,id::text,'email',jsonb_build_object('sub',id,'email',email),now(),now(),now() from auth.users;`);
  const auth = startClone('supabase_auth_uc-life-issues', 9999);
  const rest = startClone('supabase_rest_uc-life-issues', 3000);
  await ready(auth.url + '/health', auth.name);
  sql(docker(['exec', SOURCE, 'psql', '-XqAt', '-U', 'supabase_admin', '-d', 'postgres', '-c', "select pg_get_functiondef(oid)||';' from pg_proc where pronamespace='auth'::regnamespace and proname in ('uid','jwt','role');"]));
  proxy = http.createServer(async (request, response) => {
    try {
      const isAuth = request.url.startsWith('/auth/v1/');
      const base = isAuth ? auth.url : rest.url;
      const path = request.url.replace(isAuth ? /^\/auth\/v1/ : /^\/rest\/v1/, '');
      const body = []; for await (const chunk of request) body.push(chunk);
      const headers = { ...request.headers }; delete headers.host;
      const result = await fetch(base + path, { method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : Buffer.concat(body), redirect: 'manual' });
      response.writeHead(result.status, Object.fromEntries([...result.headers].filter(([key]) => !['content-encoding', 'content-length', 'transfer-encoding'].includes(key))));
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch { response.writeHead(502); response.end('LOCAL_PROXY_ERROR'); }
  });
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
  const api = 'http://127.0.0.1:' + proxy.address().port;
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ role: 'anon', iss: 'supabase', exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url');
  const anonKey = `${header}.${payload}.${createHmac('sha256', auth.env.GOTRUE_JWT_SECRET).update(`${header}.${payload}`).digest('base64url')}`;
  // Bind an available local port before handing it to Next.
  const probe = http.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const origin = 'http://127.0.0.1:' + port;
  next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port), '-H', '127.0.0.1'], {
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: api, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  next.stdout.on('data', value => { logs += value.toString(); }); next.stderr.on('data', value => { logs += value.toString(); });
  await ready(origin + '/api/version');
  browser = await chromium.launch({ headless: true });
  mkdirSync('output/account-profile', { recursive: true });
  for (const [index, kind] of [[1, 'office'], [2, 'internal'], [3, 'external']]) {
    let cookies = [];
    const client = createServerClient(api, anonKey, { cookies: { getAll: () => cookies, setAll: values => { cookies = values; } } });
    const signed = await client.auth.signInWithPassword({ email: `profile-${index}@uc.ac.kr`, password });
    if (signed.error) diagnostics(auth.name);
    assert.equal(signed.error, null, 'Native local password login');
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } }); contexts.push(context);
    await context.addCookies(cookies.map(cookie => ({ name: cookie.name, value: cookie.value, url: origin })));
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const route = kind === 'office' ? '/mypage' : '/instructor';
    await page.goto(origin + route, { waitUntil: 'networkidle' });
    assert.equal(new URL(page.url()).pathname, route, kind + ' account entry');
    assert.equal(await page.locator('a[href="/mypage/notifications"]').count(), 0);
    await page.getByText('내 정보 수정', { exact: true }).click();
    const fields = { mobile_phone: `010-1234-567${index}`, office_phone: '052-230-0000', school_email: `saved${index}@uc.ac.kr`, personal_email: `saved${index}@example.invalid`, affiliation: '브라우저 검증 학과', job_title: '검증 직책' };
    for (const [name, value] of Object.entries(fields)) await page.locator(`[name="${name}"]`).fill(value);
    await page.getByRole('button', { name: '변경사항 저장' }).click();
    await page.getByRole('status').filter({ hasText: '내 정보가 저장됐습니다.' }).waitFor();
    await page.reload({ waitUntil: 'networkidle' });
    for (const value of Object.values(fields)) assert((await page.locator('dl').first().textContent()).includes(value));
    await page.getByText('내 정보 수정', { exact: true }).click();
    await page.locator('[name="affiliation"]').fill('수정 후 저장');
    await page.locator('[name="personal_email"]').fill('');
    await page.getByRole('button', { name: '변경사항 저장' }).click();
    await page.getByRole('status').filter({ hasText: '내 정보가 저장됐습니다.' }).waitFor();
    await page.reload({ waitUntil: 'networkidle' });
    assert((await page.locator('dl').first().textContent()).includes('수정 후 저장'));
    await page.screenshot({ path: `output/account-profile/${kind}-desktop.png`, fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByText('내 정보 수정', { exact: true }).click();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `output/account-profile/${kind}-mobile.png`, fullPage: true });
    await page.goto(origin + '/mypage/notifications', { waitUntil: 'networkidle' });
    assert.equal(new URL(page.url()).pathname, route);
    assert.deepEqual(errors, []);
    await client.auth.signOut();
    console.log(`PASS ${kind}: native login, six fields, save, reload, edit, clear, mobile layout, settings redirect`);
  }
  assert(!/Error:|TypeError:/.test(logs), 'Next runtime has no errors');
  console.log('3 browser account flows passed; only isolated synthetic data used');
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  await browser?.close().catch(() => {});
  if (next && next.exitCode === null) { next.kill('SIGTERM'); await new Promise(resolve => next.once('exit', resolve)); }
  await new Promise(resolve => proxy ? proxy.close(resolve) : resolve());
  for (const name of owned.reverse()) { assert.equal(inspect(name).Config.Labels['account-profile-test'], runId); docker(['rm', '-f', name]); }
  // The guarded, newly created test DB contains only our fixtures.
  docker(['exec', SOURCE, 'dropdb', '-U', 'supabase_admin', DB]);
}
