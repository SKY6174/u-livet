// Bounded benchmark against existing synthetic LOCAL fixtures only.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServerClient } from '@supabase/ssr';
import { ensureLocalMfa } from './local-mfa.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const API = 'http://127.0.0.1:55321';
const PASSWORD = 'Local-Only-2026!';
const require = createRequire(import.meta.url);
const { encodeReply } = require('next/dist/compiled/react-server-dom-webpack/client.node');
const roles = [
  { role: 'learner', account: 'learner', path: '/mypage', title: '님의 나의 공간', expectedRole: null },
  { role: 'instructor', account: 'instructor', path: '/instructor', title: '님의 강사 공간', expectedRole: 'INSTRUCTOR' },
  { role: 'manager', account: 'operator', path: '/admin', title: '사업단 과정 관리', expectedRole: 'COURSE_MANAGER' },
];
const report = { checkedAt: new Date().toISOString(), environment: 'local-synthetic', login: [], actions: [], load: [], checks: [] };
const sessions = [];
let snapshot, server, child, stage = 'preflight', origin;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function checked(result) { if (result.error) throw new Error('SUPABASE_OPERATION_FAILED'); return result.data; }
function session(status, jar = new Map()) {
  const client = createServerClient(API, status.ANON_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: values => { for (const { name, value } of values) value ? jar.set(name, value) : jar.delete(name); },
    },
    global: { fetch: (url, init) => {
      assert.equal(new URL(url).origin, API);
      return fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(10000) });
    } },
  });
  const result = { client, jar, cookie: () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ') };
  sessions.push(result); return result;
}
function summary(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return { samples: 0, p50_ms: null, p95_ms: null, max_ms: null };
  return { samples: sorted.length, p50_ms: Math.round((sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2),
    p95_ms: Math.round(sorted[Math.ceil(sorted.length * 0.95) - 1]), max_ms: Math.round(sorted.at(-1)) };
}
async function command(args, env) {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, args, { cwd: snapshot, env, stdio: ['ignore', 'pipe', 'pipe'] });
    // Build output is deliberately not printed: only the final exit status is needed.
    child.stdout.resume(); child.stderr.resume();
    child.once('error', () => reject(new Error('BUILD_START_FAILED')));
    child.once('exit', code => { child = null; code === 0 ? resolve() : reject(new Error('BUILD_FAILED')); });
  });
}
async function request(path, auth, title) {
  const start = performance.now();
  const response = await fetch(origin + path, { headers: auth ? { Cookie: auth.cookie() } : {},
    redirect: 'manual', signal: AbortSignal.timeout(15000) });
  const body = await response.text();
  assert.equal(response.status, 200, 'Expected an authenticated page, not a redirect/error');
  assert(body.includes(title), 'Expected page content missing');
  assert(!body.includes('불러오지 못했습니다'), 'Database read failed inside an HTTP 200 page');
  return { elapsed: performance.now() - start, body };
}
async function batch(total, concurrency, task) {
  let cursor = 0;
  const times = [], errors = [];
  const start = performance.now();
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < total) {
      const index = cursor++;
      try { times.push((await task(index)).elapsed); } catch { errors.push(index); }
    }
  }));
  return { ...summary(times), concurrency, requests: total, errors: errors.length,
    requests_per_second: Math.round(total / ((performance.now() - start) / 1000) * 10) / 10 };
}
async function stop(childProcess) {
  if (!childProcess || childProcess.exitCode !== null || childProcess.signalCode !== null) return;
  await new Promise(resolve => {
    const timer = setTimeout(() => childProcess.kill('SIGKILL'), 5000);
    childProcess.once('exit', () => { clearTimeout(timer); resolve(); });
    childProcess.kill('SIGTERM');
  });
}

try {
  assert.equal(process.argv.length, 2, 'No alternate target or load is accepted');
  const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  assert.equal(status.API_URL, API, 'Dedicated local Supabase is required');
  report.revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  for (const role of roles) {
    stage = `login-${role.role}`;
    const times = [];
    for (let i = 0; i < 3; i++) {
      const auth = session(status);
      const start = performance.now();
      const user = checked(await auth.client.auth.signInWithPassword({ email: `${role.account}@example.invalid`, password: PASSWORD })).user;
      assert.equal(user.email, `${role.account}@example.invalid`);
      times.push(performance.now() - start);
      if (i < 2) checked(await auth.client.auth.signOut({ scope: 'local' }));
      else role.auth = auth;
    }
    const before = checked(await role.auth.client.rpc('life_security_status'));
    role.requiresMfa = before.mfa_required;
    const mfaStart = performance.now();
    await ensureLocalMfa(role.auth.client);
    role.identity = checked(await role.auth.client.rpc('life_identity'));
    assert(role.identity?.id);
    if (role.expectedRole) assert(role.identity.roles.some(r => r.role === role.expectedRole));
    else assert.equal(role.identity.roles.length, 0);
    report.login.push({ role: role.role, ...summary(times), mfa_ms: Math.round(performance.now() - mfaStart) });
  }
  const catalog = checked(await roles[0].auth.client.from('life_catalog').select('id'));
  assert(catalog.length > 0, 'Run npm run test:core to prepare synthetic courses');
  report.visible_courses = catalog.length;
  console.log(JSON.stringify({ stage: 'local-login-verified', roles: roles.length, visible_courses: catalog.length }));

  stage = 'isolated-build';
  snapshot = mkdtempSync(join(tmpdir(), 'uc-life-auth-load-'));
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const file of tracked) {
    if (file.split('/').some(part => part.startsWith('.env')) || !existsSync(join(ROOT, file))) continue;
    const target = join(snapshot, file); mkdirSync(dirname(target), { recursive: true }); copyFileSync(join(ROOT, file), target);
  }
  symlinkSync(join(ROOT, 'node_modules'), join(snapshot, 'node_modules'), 'dir');
  const port = await new Promise((resolve, reject) => {
    const probe = createServer(); probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)); });
  });
  origin = `http://127.0.0.1:${port}`;
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: API, NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY, AUTH_RATE_LIMIT_SECRET: randomBytes(32).toString('hex'),
    AUTH_SITE_ORIGIN: origin, CERTIFICATE_VERIFY_ORIGIN: origin, PREVIEW_REVIEW_ONLY: 'false',
    AUTH_CAPTCHA_ENABLED: 'false', AUTH_TURNSTILE_SITE_KEY: '', AUTH_LOCAL_CAPTCHA_TEST: '',
    AUTH_TRUSTED_IP_HEADER: '', AUTH_EMAIL_ENABLED: 'false', PUBLIC_SIGNUP_ENABLED: 'false' };
  await command([join(ROOT, 'node_modules/next/dist/bin/next'), 'build'], env);
  console.log('PASS isolated production build');
  stage = 'local-server';
  server = spawn(process.execPath, [join(ROOT, 'node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(port)],
    { cwd: snapshot, env, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.resume(); server.stderr.resume();
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try { const r = await fetch(origin + '/api/health', { signal: AbortSignal.timeout(1000) }); ready = r.ok && (await r.json()).status === 'healthy'; } catch { /* bounded startup */ }
    if (ready) break; await delay(250);
  }
  assert(ready, 'Local server failed to become healthy');

  stage = 'login-actions';
  const manifest = JSON.parse(readFileSync(join(snapshot, '.next/server/server-reference-manifest.json'), 'utf8'));
  const actionId = Object.entries(manifest.node).find(([, value]) => value.exportedName === 'authenticate')?.[0];
  assert(actionId);
  for (const role of roles) {
    const fields = new FormData(); fields.set('email', `${role.account}@example.invalid`); fields.set('password', PASSWORD);
    const start = performance.now();
    const response = await fetch(origin + '/auth/login', { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(15000),
      headers: { 'Next-Action': actionId, Accept: 'text/x-component', Origin: origin }, body: await encodeReply([{}, fields]) });
    await response.text();
    const jar = new Map(response.headers.getSetCookie().map(header => {
      const pair = header.split(';')[0], p = pair.indexOf('='); return [pair.slice(0, p), decodeURIComponent(pair.slice(p + 1))];
    }).filter(([, value]) => value));
    const actionSession = session(status, jar);
    const redirect = response.headers.get('x-action-redirect');
    assert(redirect?.startsWith(role.requiresMfa ? '/auth/security' : '/mypage'), 'Login action did not reach expected route');
    assert.equal(checked(await actionSession.client.auth.getUser()).user.email, `${role.account}@example.invalid`);
    report.actions.push({ role: role.role, elapsed_ms: Math.round(performance.now() - start), mfa_required: role.requiresMfa });
    checked(await actionSession.client.auth.signOut({ scope: 'local' }));
  }
  report.checks.push('three real login Server Actions');

  stage = 'authorization';
  for (const path of ['/admin', '/instructor']) {
    const response = await fetch(origin + path, { headers: { Cookie: roles[0].auth.cookie() }, redirect: 'manual', signal: AbortSignal.timeout(15000) });
    const body = await response.text();
    const denied = { path, status: response.status, not_found: body.includes('페이지를 찾을 수 없습니다'),
      private_content: body.includes(path === '/admin' ? '새 과정·기수 초안 등록' : '님의 강사 공간'),
      redirected: response.headers.has('location') };
    report.authorization ??= []; report.authorization.push(denied);
    console.log(JSON.stringify({ stage: 'authorization', ...denied }));
    assert.equal(response.status, 404, 'Learner must receive a denied staff route');
    assert(denied.not_found && !denied.private_content);
  }
  report.checks.push('learner staff routes denied');
  stage = 'concurrent-pages';
  for (const role of roles) {
    await request(role.path, role.auth, role.title);
    for (const concurrency of [1, 4, 8]) {
      const result = await batch(24, concurrency, () => request(role.path, role.auth, role.title));
      report.load.push({ role: role.role, path: role.path, ...result });
      console.log(JSON.stringify(report.load.at(-1)));
      assert.equal(result.errors, 0, 'Authenticated page load failed');
    }
  }
  stage = 'session-isolation';
  const isolation = await batch(24, 8, async i => {
    const role = roles[i % roles.length];
    const result = await request('/mypage', role.auth, `${role.identity.name} 님의 나의 공간`);
    for (const other of roles.filter(r => r !== role)) assert(!result.body.includes(`${other.identity.name} 님의 나의 공간`));
    return result;
  });
  assert.equal(isolation.errors, 0, 'User session isolation failed');
  report.checks.push('24 interleaved user pages preserve identity');
  report.completed = true;
} catch {
  report.completed = false; report.failed_stage = stage; process.exitCode = 1;
  console.error(`AUTH_LOAD_FAILED: ${stage}. Check local fixtures and local server configuration.`);
} finally {
  const cleanup = await Promise.allSettled(sessions.map(s => s.client.auth.signOut({ scope: 'local' })));
  report.sessions_cleaned = cleanup.every(r => r.status === 'fulfilled' && !r.value.error);
  await stop(child); await stop(server);
  if (snapshot) rmSync(snapshot, { recursive: true, force: true });
  report.temporary_build_removed = !snapshot || !existsSync(snapshot);
  if (!report.sessions_cleaned) process.exitCode = 1;
  mkdirSync(join(ROOT, 'ops/evidence'), { recursive: true });
  writeFileSync(join(ROOT, 'ops/evidence/auth-load-result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ completed: report.completed, sessions_cleaned: report.sessions_cleaned, temporary_build_removed: report.temporary_build_removed }));
}
