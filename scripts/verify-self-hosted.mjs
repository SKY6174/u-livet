import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, copyFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { AUTH_POLICY, SELF_HOSTED_CHECKS, authComposeOverride, inspectSelfHostedConfig, inspectSelfHostedBinding } from './lib/self-hosted-preflight.mjs';
import { RELEASE_CHECKS, inspectEnvironment, inspectRecord, readinessResult, releaseSnapshot } from './lib/release-readiness.mjs';

// Synthetic settings only. Does not inspect, start or change containers/databases.
const image = `supabase/gotrue:v2.196.0@sha256:${'ab'.repeat(32)}`;
const runtime = {
  schemaVersion: 1, target: 'preview', stackId: 'anchor-stage',
  backendOrigin: 'https://stage-api.uc.ac.kr', siteOrigin: 'https://stage.uc.ac.kr', authImage: image,
  settings: { ...AUTH_POLICY, API_EXTERNAL_URL: 'https://stage-api.uc.ac.kr/auth/v1',
    GOTRUE_JWT_ISSUER: 'https://stage-api.uc.ac.kr/auth/v1', GOTRUE_SITE_URL: 'https://stage.uc.ac.kr',
    GOTRUE_URI_ALLOW_LIST: 'https://stage.uc.ac.kr/auth/reset-password', GOTRUE_SMTP_HOST: 'smtp.uc.ac.kr',
    GOTRUE_SMTP_PORT: '587', GOTRUE_MAILER_TEMPLATES_RECOVERY: 'https://mail-assets.uc.ac.kr/recovery.html', GOTRUE_DISABLE_SIGNUP: 'true' },
};
const env = {
  SUPABASE_DEPLOYMENT_KIND: 'self-hosted', VERCEL_ENV: 'preview',
  NEXT_PUBLIC_SUPABASE_URL: runtime.backendOrigin, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_SyntheticPublicAbc1234567890',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_SensitiveServiceSentinel1234567890',
  AUTH_RATE_LIMIT_SECRET: 'SensitiveHmacSentinelAbC0123456789_abcdefghijkl',
  AUTH_SITE_ORIGIN: runtime.siteOrigin, CERTIFICATE_VERIFY_ORIGIN: runtime.siteOrigin,
  AUTH_CAPTCHA_ENABLED: 'true', AUTH_TURNSTILE_SITE_KEY: '0x4SyntheticSiteKey0123456789', AUTH_TRUSTED_IP_HEADER: 'x-vercel-forwarded-for',
  SELF_HOSTED_STACK_ID: runtime.stackId, SELF_HOSTED_AUTH_IMAGE: image, SELF_HOSTED_CONFIG_DIGEST: inspectSelfHostedConfig(runtime).configDigest,
  RELEASE_PRODUCTION_SITE_ORIGIN: 'https://life.uc.ac.kr', RELEASE_PRODUCTION_BACKEND_ORIGIN: 'https://api.uc.ac.kr', RELEASE_PRODUCTION_STACK_ID: 'anchor-production',
};
const snapshot = { sourceDigest: 'a'.repeat(64), migrationDigest: 'b'.repeat(64) };
const record = {
  schemaVersion: 2, deploymentKind: 'self-hosted', target: 'preview', siteOrigin: runtime.siteOrigin,
  backendOrigin: runtime.backendOrigin, stackId: runtime.stackId, authImage: image, configDigest: env.SELF_HOSTED_CONFIG_DIGEST, ...snapshot,
  checks: Object.fromEntries(Object.keys({ ...RELEASE_CHECKS, ...SELF_HOSTED_CHECKS }).map(id => [id, {
    status: 'confirmed', owner: '합성 시험 담당자', checkedAt: new Date().toISOString(), evidence: '합성 인수 기록 R-01',
  }])),
};
let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; } catch { console.error(`FAIL: ${name}`); process.exitCode = 1; }
}
const clone = value => structuredClone(value);
const config = value => readinessResult(inspectEnvironment(value, value.VERCEL_ENV), true);
const blocked = value => assert.equal(config(value).status, 'BLOCKED');
const failedRuntime = value => assert.equal(inspectSelfHostedConfig(value).status, 'CONFIG_BLOCKED');
const recordResult = value => readinessResult(inspectRecord(value, env, 'preview', snapshot));

await test('isolated self-hosted preview and runtime', () => {
  assert.equal(config(env).status, 'CONFIG_VALID');
  assert.equal(inspectSelfHostedConfig(runtime).status, 'CONFIG_MATCH_RUNTIME_PENDING');
  assert.ok(inspectSelfHostedBinding(runtime, env, 'preview').every(c => c.status === 'PASS'));
});
await test('production matches all baselines', () => assert.equal(config({ ...env, VERCEL_ENV: 'production',
  AUTH_SITE_ORIGIN: env.RELEASE_PRODUCTION_SITE_ORIGIN, CERTIFICATE_VERIFY_ORIGIN: env.RELEASE_PRODUCTION_SITE_ORIGIN,
  NEXT_PUBLIC_SUPABASE_URL: env.RELEASE_PRODUCTION_BACKEND_ORIGIN, SELF_HOSTED_STACK_ID: env.RELEASE_PRODUCTION_STACK_ID }).status, 'CONFIG_VALID'));
for (const key of ['SELF_HOSTED_STACK_ID', 'SELF_HOSTED_AUTH_IMAGE', 'SELF_HOSTED_CONFIG_DIGEST', 'RELEASE_PRODUCTION_BACKEND_ORIGIN', 'RELEASE_PRODUCTION_STACK_ID']) {
  await test(`required ${key}`, () => { const v = { ...env }; delete v[key]; blocked(v); });
}
for (const changes of [
  { SUPABASE_DEPLOYMENT_KIND: 'self-host' }, { SUPABASE_DEPLOYMENT_KIND: 'cloud' }, { SUPABASE_DEPLOYMENT_KIND: '' },
  { SUPABASE_DEPLOYMENT_KIND: undefined }, { RELEASE_PRODUCTION_SUPABASE_REF: 'abcdefghijklmnopqrst' },
  { NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co' },
  { NEXT_PUBLIC_SUPABASE_URL: env.RELEASE_PRODUCTION_BACKEND_ORIGIN },
  { SELF_HOSTED_STACK_ID: env.RELEASE_PRODUCTION_STACK_ID },
  { AUTH_SITE_ORIGIN: env.RELEASE_PRODUCTION_SITE_ORIGIN, CERTIFICATE_VERIFY_ORIGIN: env.RELEASE_PRODUCTION_SITE_ORIGIN },
  { NEXT_PUBLIC_SUPABASE_URL: env.AUTH_SITE_ORIGIN }, { SELF_HOSTED_STACK_ID: '../production' },
  { SELF_HOSTED_AUTH_IMAGE: 'supabase/gotrue:latest' }, { SELF_HOSTED_AUTH_IMAGE: image.replace('supabase/', 'untrusted/') },
  { SELF_HOSTED_CONFIG_DIGEST: 'short' }, { NEXT_PUBLIC_SensitiveName: env.SUPABASE_SERVICE_ROLE_KEY },
  { NEXT_PUBLIC_SUPABASE_ANON_KEY: env.SUPABASE_SERVICE_ROLE_KEY }, { AUTH_CAPTCHA_ENABLED: 'false' },
]) await test('mixed or unsafe deployment setting blocked', () => blocked({ ...env, ...changes }));
for (const url of ['http://stage-api.uc.ac.kr', 'https://127.0.0.1', 'https://stage-api.uc.ac.kr/auth/v1', 'https://stage-api.uc.ac.kr/', 'https://a:b@stage-api.uc.ac.kr', 'https://stage-api.uc.ac.kr:8443', 'https://db.example.com']) {
  await test('noncanonical backend origin blocked', () => blocked({ ...env, NEXT_PUBLIC_SUPABASE_URL: url }));
}
const jwt = payload => `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.unsigned`;
await test('legacy self-hosted key role issuer shape', () => assert.equal(config({ ...env,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt({ role: 'anon', iss: 'supabase' }),
  SUPABASE_SERVICE_ROLE_KEY: jwt({ role: 'service_role', iss: 'supabase' }) }).status, 'CONFIG_VALID'));
for (const payload of [{ role: 'service_role', iss: 'supabase' }, { role: 'anon', iss: 'wrong' }, { role: 'anon', iss: 'supabase', ref: 'abcdefghijklmnopqrst' }]) {
  await test('legacy Cloud key or wrong role rejected', () => blocked({ ...env, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt(payload) }));
}
await test('complete record permits review only', () => assert.equal(recordResult(record).status, 'READY_FOR_MANUAL_RELEASE_REVIEW'));
for (const field of ['deploymentKind', 'backendOrigin', 'stackId', 'authImage', 'configDigest']) {
  await test(`changed record binding ${field}`, () => assert.equal(recordResult({ ...record, [field]: 'changed' }).status, 'BLOCKED'));
}
for (const change of [{ schemaVersion: 1 }, { supabaseProjectRef: 'abcdefghijklmnopqrst' }]) {
  await test('Cloud record shape rejected', () => assert.equal(recordResult({ ...record, ...change }).status, 'BLOCKED'));
}
await test('self-hosted operations evidence required', () => {
  const r = clone(record); delete r.checks['self-hosted-operations']; assert.equal(recordResult(r).status, 'BLOCKED');
});
await test('self-hosted operations stale evidence blocked', () => {
  const r = clone(record); r.checks['self-hosted-operations'].checkedAt = '2020-01-01T00:00:00Z'; assert.equal(recordResult(r).status, 'BLOCKED');
});
for (const field of Object.keys(AUTH_POLICY)) {
  await test(`native policy cannot weaken ${field}`, () => { const r = clone(runtime); r.settings[field] = 'invalid'; failedRuntime(r); });
}
for (const field of Object.keys(runtime.settings)) {
  await test(`missing runtime setting ${field}`, () => { const r = clone(runtime); delete r.settings[field]; failedRuntime(r); });
}
for (const changes of [
  { API_EXTERNAL_URL: runtime.backendOrigin }, { GOTRUE_JWT_ISSUER: 'https://api.uc.ac.kr/auth/v1' },
  { GOTRUE_URI_ALLOW_LIST: `${runtime.siteOrigin}/**` }, { GOTRUE_SMTP_HOST: 'localhost' }, { GOTRUE_SMTP_PORT: '25' },
  { GOTRUE_MAILER_TEMPLATES_RECOVERY: 'https://secret:password@mail-assets.uc.ac.kr/recovery.html' },
  { GOTRUE_MAILER_TEMPLATES_RECOVERY: 'http://mail-assets.uc.ac.kr/recovery.html' },
  { GOTRUE_DISABLE_SIGNUP: '' }, { GOTRUE_SMTP_PASS: 'SensitiveRuntimeSentinel' },
]) await test('invalid or secret runtime field rejected', () => failedRuntime({ ...runtime, settings: { ...runtime.settings, ...changes } }));
await test('unknown top level input rejected and not echoed', () => {
  const out = inspectSelfHostedConfig({ ...runtime, SensitiveExtraField: 'SensitiveRuntimeSentinel' });
  assert.equal(out.configDigest, null); assert.ok(!JSON.stringify(out).includes('Sensitive'));
});
await test('canonical digest is order independent', () => {
  const r = Object.fromEntries(Object.entries(runtime).reverse()); r.settings = Object.fromEntries(Object.entries(runtime.settings).reverse());
  assert.equal(inspectSelfHostedConfig(r).configDigest, env.SELF_HOSTED_CONFIG_DIGEST);
});
await test('signup decision changes evidence digest and binding', () => {
  const r = clone(runtime); r.settings.GOTRUE_DISABLE_SIGNUP = 'false';
  assert.notEqual(inspectSelfHostedConfig(r).configDigest, env.SELF_HOSTED_CONFIG_DIGEST);
  assert.ok(inspectSelfHostedBinding(r, env, 'preview').some(c => c.status === 'BLOCK'));
});
await test('diagnostics never echo secrets', () => assert.ok(!JSON.stringify(config({ ...env, NEXT_PUBLIC_SensitiveField: 'SensitiveSentinel' })).includes('Sensitive')));

const root = await mkdtemp(join(tmpdir(), 'anchor-self-hosted-test-'));
const cli = resolve('scripts/check-self-hosted.mjs');
const releaseCli = resolve('scripts/check-release-readiness.mjs');
const build = resolve('scripts/build-vercel.mjs');
const run = (script, args = [], extraEnv = {}) => spawnSync(process.execPath, ['--', script, ...args], {
  cwd: root, env: { PATH: process.env.PATH, ...extraEnv }, encoding: 'utf8', timeout: 15000,
});
try {
  for (const dir of ['src', 'scripts', 'assets', 'public', 'supabase/migrations', 'supabase/templates', 'ops/self-hosted']) await mkdir(join(root, dir), { recursive: true });
  for (const file of ['package.json', 'package-lock.json', 'next.config.js', 'tsconfig.json', 'vercel.json', '.env.example']) await writeFile(join(root, file), '{}');
  await writeFile(join(root, 'supabase/migrations/001_initial.sql'), 'select 1;');
  for (const name of ['compose.auth-policy.json', 'app.env.example', 'runtime.example.json', 'release.example.json']) await copyFile(`ops/self-hosted/${name}`, join(root, `ops/self-hosted/${name}`));
  const runtimePath = join(root, 'runtime.local.json');
  await writeFile(runtimePath, JSON.stringify(runtime));
  await test('checked-in overlay matches policy', async () => assert.deepEqual(JSON.parse(await readFile('ops/self-hosted/compose.auth-policy.json', 'utf8')), authComposeOverride()));
  await test('Compose preserves literal password punctuation and signup closed by default', async () => {
    const base = join(root, 'base.json'); const emptyEnv = join(root, 'empty.env');
    await writeFile(base, JSON.stringify({ services: { auth: { image: 'supabase/gotrue:v2.196.0' } } })); await writeFile(emptyEnv, '');
    const out = spawnSync('docker', ['compose', '--project-directory', root, '--env-file', emptyEnv, '-f', base,
      '-f', join(root, 'ops/self-hosted/compose.auth-policy.json'), 'config', '--format', 'json'], {
      // Preserve HOME only for Docker's installed Compose plugin discovery; no inherited Compose variables.
      cwd: root, env: { PATH: process.env.PATH, HOME: process.env.HOME, ANCHOR_AUTH_IMAGE: image, ANCHOR_APP_ORIGIN: runtime.siteOrigin,
        ANCHOR_BACKEND_ORIGIN: runtime.backendOrigin, ANCHOR_CAPTCHA_SECRET: 'SensitiveCaptchaSentinel',
        ANCHOR_SMTP_HOST: 'smtp.uc.ac.kr', ANCHOR_SMTP_PORT: '587', ANCHOR_SMTP_USER: 'SyntheticUser',
        ANCHOR_SMTP_PASS: 'SensitiveSmtpSentinel', ANCHOR_SMTP_ADMIN_EMAIL: 'synthetic@uc.ac.kr',
        ANCHOR_RECOVERY_TEMPLATE_URL: runtime.settings.GOTRUE_MAILER_TEMPLATES_RECOVERY }, encoding: 'utf8', timeout: 15000,
    });
    assert.equal(out.status, 0);
    const auth = JSON.parse(out.stdout).services.auth;
    // Compose v2.24.5 config re-escapes every literal dollar on serialization.
    // https://github.com/docker/compose/blob/v2.24.5/cmd/compose/config.go (escapeDollarSign)
    // Compare the exported representation; the running container remains a separate acceptance check.
    for (const [key, value] of Object.entries(AUTH_POLICY)) assert.equal(auth.environment[key], value.replaceAll('$', () => '$$'));
    assert.equal(auth.image, image); assert.equal(auth.environment.GOTRUE_DISABLE_SIGNUP, 'true');
    assert.equal(auth.environment.API_EXTERNAL_URL, runtime.settings.API_EXTERNAL_URL);
  });
  await test('CLI valid runtime returns digest only and pending', () => {
    const out = run(cli, ['--config-file', runtimePath, '--format', 'json']);
    assert.equal(out.status, 0); const data = JSON.parse(out.stdout); assert.equal(data.configDigest, env.SELF_HOSTED_CONFIG_DIGEST);
    assert.equal(data.status, 'CONFIG_MATCH_RUNTIME_PENDING'); assert.ok(!out.stdout.includes(runtime.backendOrigin));
  });
  await test('runtime example is intentionally blocked', () => assert.equal(run(cli, ['--config-file', 'ops/self-hosted/runtime.example.json']).status, 1));
  await test('no automatic env or runtime loading', async () => {
    await writeFile(join(root, '.env.local'), 'SUPABASE_SERVICE_ROLE_KEY=SensitiveLocalSentinel');
    const out = run(cli); assert.equal(out.status, 1); assert.ok(!out.stdout.includes('SensitiveLocalSentinel'));
  });
  for (const content of ['{"SensitiveParseSentinel":', 'x'.repeat(131073)]) {
    await test('CLI bounded redacted failures', async () => { const p = join(root, 'bad.json'); await writeFile(p, content);
      const out = run(cli, ['--config-file', p, '--format', 'json']); assert.equal(out.status, 1); assert.ok(!/Sensitive/.test(out.stdout + out.stderr)); });
  }
  for (const args of [['--config-file', 'SensitiveMissingPath'], ['--unknown-SensitiveFlag'], ['--compose-template', '--format', 'json']]) {
    await test('CLI rejects malformed flags without echo', () => { const out = run(cli, args); assert.equal(out.status, 1); assert.ok(!/Sensitive/.test(out.stdout + out.stderr)); });
  }
  await test('CLI help and compose template', () => {
    assert.equal(run(cli, ['--help']).status, 0); assert.deepEqual(JSON.parse(run(cli, ['--compose-template']).stdout), authComposeOverride());
  });
  const originalSnapshot = await releaseSnapshot(root);
  await test('ops templates invalidate source digest', async () => {
    const p = join(root, 'ops/self-hosted/app.env.example'); const text = await readFile(p, 'utf8');
    await writeFile(p, `${text}\n# Changed\n`); assert.notEqual((await releaseSnapshot(root)).sourceDigest, originalSnapshot.sourceDigest);
    await writeFile(p, text);
  });
  await test('private evidence excluded from source digest', async () => {
    await writeFile(join(root, 'ops/self-hosted/runtime.local.json'), 'SensitiveEvidenceSentinel');
    assert.deepEqual(await releaseSnapshot(root), originalSnapshot);
  });
  await test('ops parent symlink blocked', async () => {
    const linkRoot = await mkdtemp(join(tmpdir(), 'anchor-snapshot-link-'));
    try {
      for (const name of ['src', 'scripts', 'assets', 'public', 'supabase']) await mkdir(join(linkRoot, name));
      await mkdir(join(linkRoot, 'supabase/migrations')); await mkdir(join(linkRoot, 'supabase/templates'));
      for (const file of ['package.json', 'package-lock.json', 'next.config.js', 'tsconfig.json', 'vercel.json', '.env.example']) await writeFile(join(linkRoot, file), '{}');
      await symlink(join(root, 'ops'), join(linkRoot, 'ops')); await assert.rejects(releaseSnapshot(linkRoot));
    } finally { await rm(linkRoot, { recursive: true, force: true }); }
  });
  const r = { ...record, ...originalSnapshot }; const recordPath = join(root, 'release.local.json');
  await writeFile(recordPath, JSON.stringify(r));
  const releaseArgs = ['--target', 'preview', '--record', recordPath, '--self-hosted-config', runtimePath, '--format', 'json'];
  await test('full release binds runtime record environment', () => {
    const out = run(releaseCli, releaseArgs, env); assert.equal(out.status, 0); assert.equal(JSON.parse(out.stdout).status, 'READY_FOR_MANUAL_RELEASE_REVIEW');
  });
  await test('full release requires runtime evidence', () => assert.equal(run(releaseCli, ['--target', 'preview', '--record', recordPath], env).status, 1));
  await test('changed runtime cannot reuse release approval', async () => {
    const changed = clone(runtime); changed.settings.GOTRUE_DISABLE_SIGNUP = 'false'; await writeFile(runtimePath, JSON.stringify(changed));
    assert.equal(run(releaseCli, releaseArgs, env).status, 1); await writeFile(runtimePath, JSON.stringify(runtime));
  });
  await test('explicit env file does not inherit secrets or kind', async () => {
    const p = join(root, 'explicit.env'); await writeFile(p, Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n'));
    assert.equal(run(releaseCli, [...releaseArgs, '--env-file', p], { NEXT_PUBLIC_Sensitive: 'SensitiveInheritedSentinel', SUPABASE_DEPLOYMENT_KIND: 'cloud' }).status, 0);
  });
  await mkdir(join(root, 'node_modules/next/dist/bin'), { recursive: true });
  await writeFile(join(root, 'node_modules/next/dist/bin/next'), "require('node:fs').writeFileSync('build-invoked', 'yes')");
  await test('self-hosted build blocks bundled local env', async () => {
    assert.equal(run(build, [], { ...env, VERCEL: '1' }).status, 1); await assert.rejects(readFile(join(root, 'build-invoked')));
    await rm(join(root, '.env.local'));
  });
  await test('self-hosted build blocks missing image pin', async () => {
    assert.equal(run(build, [], { ...env, VERCEL: '1', SELF_HOSTED_AUTH_IMAGE: 'supabase/gotrue:latest' }).status, 1);
    await assert.rejects(readFile(join(root, 'build-invoked')));
  });
  await test('self-hosted config gate can invoke build', () => assert.equal(run(build, [], { ...env, VERCEL: '1' }).status, 0));
} finally { await rm(root, { recursive: true, force: true }); }
console.log(`${passed} self-hosted checks passed${process.exitCode ? '; failures above' : ''}. Synthetic inputs and Compose parsing only.`);
