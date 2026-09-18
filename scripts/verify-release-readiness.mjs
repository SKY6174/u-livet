import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { RELEASE_CHECKS, inspectEnvironment, inspectRecord, readinessResult, releaseSnapshot } from './lib/release-readiness.mjs';

// Only synthetic values and disposable directories. No real env files or services.
const env = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_SyntheticPublicAbc1234567890',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_SensitiveSentinelXYZ1234567890',
  AUTH_RATE_LIMIT_SECRET: 'SensitiveHmacSentinelAbC0123456789_abcdefghijkl',
  AUTH_SITE_ORIGIN: 'https://life.uc.ac.kr', CERTIFICATE_VERIFY_ORIGIN: 'https://life.uc.ac.kr',
  AUTH_CAPTCHA_ENABLED: 'true', AUTH_TURNSTILE_SITE_KEY: '0x4SyntheticSiteKey0123456789',
  AUTH_TRUSTED_IP_HEADER: 'x-vercel-forwarded-for',
  RELEASE_PRODUCTION_SUPABASE_REF: 'abcdefghijklmnopqrst', RELEASE_PRODUCTION_SITE_ORIGIN: 'https://life.uc.ac.kr',
};
const target = 'production';
const now = Date.UTC(2026, 8, 19, 0, 0, 0);
const snapshot = { sourceDigest: 'a'.repeat(64), migrationDigest: 'b'.repeat(64) };
const record = {
  schemaVersion: 1, target, siteOrigin: env.AUTH_SITE_ORIGIN, supabaseProjectRef: env.RELEASE_PRODUCTION_SUPABASE_REF,
  ...snapshot, checks: Object.fromEntries(Object.keys(RELEASE_CHECKS).map(id => [id, {
    status: 'confirmed', owner: '담당 검토자', checkedAt: new Date(now).toISOString(), evidence: '내부 검증 문서 R-2026-0919',
  }])),
};
let passed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; } catch {
    console.error(`FAIL: ${name}`); process.exitCode = 1;
  }
}
const config = value => readinessResult(inspectEnvironment(value, target), true);
const blocked = value => assert.equal(config(value).status, 'BLOCKED');
const full = value => readinessResult([...inspectEnvironment(env, target), ...inspectRecord(value, env, target, snapshot, now)]);
const clone = value => structuredClone(value);
const jwt = (role, ref) => `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ role, ref })).toString('base64url')}.unsigned`;

await test('production config shape passes', () => assert.equal(config(env).status, 'CONFIG_VALID'));
const preview = { ...env, VERCEL_ENV: 'preview', AUTH_SITE_ORIGIN: 'https://stage.uc.ac.kr', CERTIFICATE_VERIFY_ORIGIN: 'https://stage.uc.ac.kr', NEXT_PUBLIC_SUPABASE_URL: 'https://tsrqponmlkjihgfedcba.supabase.co' };
await test('isolated preview passes', () => assert.equal(readinessResult(inspectEnvironment(preview, 'preview'), true).status, 'CONFIG_VALID'));
for (const key of Object.keys(env)) await test(`missing ${key}`, () => { const value = { ...env }; delete value[key]; blocked(value); });
for (const url of ['http://life.uc.ac.kr', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'https://life.local', 'https://life.example.com', 'https://life.test', 'https://life.uc.ac.kr/', 'https://life.uc.ac.kr/a', 'https://a:b@life.uc.ac.kr', 'https://life.uc.ac.kr?x=1', 'https://life.uc.ac.kr#x', 'https://life.uc.ac.kr:8443']) {
  await test('nonpublic or noncanonical origin', () => blocked({ ...env, AUTH_SITE_ORIGIN: url, CERTIFICATE_VERIFY_ORIGIN: url, RELEASE_PRODUCTION_SITE_ORIGIN: url }));
}
await test('nonhosted DB blocked', () => blocked({ ...env, NEXT_PUBLIC_SUPABASE_URL: 'https://db.uc.ac.kr' }));
await test('production DB mismatch', () => blocked({ ...env, NEXT_PUBLIC_SUPABASE_URL: preview.NEXT_PUBLIC_SUPABASE_URL }));
await test('production site mismatch', () => blocked({ ...env, AUTH_SITE_ORIGIN: preview.AUTH_SITE_ORIGIN, CERTIFICATE_VERIFY_ORIGIN: preview.AUTH_SITE_ORIGIN }));
await test('preview cannot use production DB', () => assert.equal(readinessResult(inspectEnvironment({ ...preview, NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL }, 'preview')).status, 'BLOCKED'));
await test('preview cannot use production site', () => assert.equal(readinessResult(inspectEnvironment({ ...preview, AUTH_SITE_ORIGIN: env.AUTH_SITE_ORIGIN, CERTIFICATE_VERIFY_ORIGIN: env.AUTH_SITE_ORIGIN }, 'preview')).status, 'BLOCKED'));
await test('target conflicts with Vercel', () => blocked({ ...env, VERCEL_ENV: 'preview' }));
await test('unknown target blocked', () => assert.equal(readinessResult(inspectEnvironment(env, 'development')).status, 'BLOCKED'));
await test('legacy JWT role/ref shape only', () => assert.equal(config({ ...env, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('anon', env.RELEASE_PRODUCTION_SUPABASE_REF), SUPABASE_SERVICE_ROLE_KEY: jwt('service_role', env.RELEASE_PRODUCTION_SUPABASE_REF) }).status, 'CONFIG_VALID'));
await test('wrong JWT role blocked', () => blocked({ ...env, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('service_role', env.RELEASE_PRODUCTION_SUPABASE_REF) }));
await test('wrong JWT ref blocked', () => blocked({ ...env, SUPABASE_SERVICE_ROLE_KEY: jwt('service_role', 'tsrqponmlkjihgfedcba') }));
await test('malformed JWT blocked', () => blocked({ ...env, SUPABASE_SERVICE_ROLE_KEY: 'a.b.c' }));
await test('public/server keys swapped', () => blocked({ ...env, NEXT_PUBLIC_SUPABASE_ANON_KEY: env.SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SERVICE_ROLE_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY }));
await test('public/server key reuse', () => blocked({ ...env, SUPABASE_SERVICE_ROLE_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY }));
await test('unknown public variable', () => blocked({ ...env, NEXT_PUBLIC_NEW_SETTING: 'anything' }));
await test('embedded public secret', () => blocked({ ...env, NEXT_PUBLIC_CONFIG: `prefix:${env.SUPABASE_SERVICE_ROLE_KEY}` }));
for (const secret of ['short', 'a'.repeat(64), 'your-secret-placeholder-Abcd1234567890', env.SUPABASE_SERVICE_ROLE_KEY, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'aB0123456789 someWhitespace' + 'x'.repeat(25), 'aB0123456789'.repeat(30)]) {
  await test('invalid or reused HMAC', () => blocked({ ...env, AUTH_RATE_LIMIT_SECRET: secret }));
}
await test('CAPTCHA disabled', () => blocked({ ...env, AUTH_CAPTCHA_ENABLED: 'false' }));
for (const key of ['1x00000000000000000000AA', '2x00000000000000000000AB', '3x00000000000000000000FF']) {
  await test('CAPTCHA dummy key', () => blocked({ ...env, AUTH_TURNSTILE_SITE_KEY: key }));
}
await test('local test flag even false string', () => blocked({ ...env, AUTH_LOCAL_CAPTCHA_TEST: 'false' }));
await test('untrusted raw header', () => blocked({ ...env, AUTH_TRUSTED_IP_HEADER: 'x-forwarded-for' }));
await test('legacy proxy trust', () => blocked({ ...env, TRUST_PROXY_IP: 'true' }));
await test('legacy trust explicitly false', () => assert.equal(config({ ...env, TRUST_PROXY_IP: 'false' }).status, 'CONFIG_VALID'));
await test('diagnostics never contain values or input names', () => {
  const output = JSON.stringify(config({ ...env, NEXT_PUBLIC_SensitiveVariableName: env.SUPABASE_SERVICE_ROLE_KEY }));
  for (const value of [env.SUPABASE_SERVICE_ROLE_KEY, env.AUTH_RATE_LIMIT_SECRET, env.AUTH_SITE_ORIGIN, 'SensitiveVariableName']) assert.ok(!output.includes(value));
});
await test('confirmed complete record permits manual review only', () => assert.equal(full(record).status, 'READY_FOR_MANUAL_RELEASE_REVIEW'));
for (const bad of [null, [], {}, { schemaVersion: 2 }, { ...record, target: 'preview' }, { ...record, siteOrigin: 'https://wrong.uc.ac.kr' }, { ...record, supabaseProjectRef: 'tsrqponmlkjihgfedcba' }, { ...record, sourceDigest: 'c'.repeat(64) }, { ...record, migrationDigest: 'c'.repeat(64) }]) {
  await test('record mismatch or malformed', () => assert.equal(full(bad).status, 'BLOCKED'));
}
for (const id of Object.keys(RELEASE_CHECKS)) await test(`missing evidence ${id}`, () => {
  const r = clone(record); delete r.checks[id]; assert.equal(full(r).status, 'BLOCKED');
});
for (const change of [
  { status: 'pending' }, { owner: '' }, { owner: 'TODO' }, { evidence: '' }, { evidence: 'x'.repeat(1001) },
  { checkedAt: new Date(now - 31 * 86400000).toISOString() }, { checkedAt: new Date(now + 120000).toISOString() },
  { checkedAt: '2026-02-31T00:00:00Z' }, { checkedAt: 'invalid' }, { checkedAt: now },
]) await test('unconfirmed stale or malformed evidence', () => {
  const r = clone(record); Object.assign(r.checks['native-password-policy'], change); assert.equal(full(r).status, 'BLOCKED');
});

const root = await mkdtemp(join(tmpdir(), 'anchor-release-test-'));
const cli = resolve('scripts/check-release-readiness.mjs');
const build = resolve('scripts/build-vercel.mjs');
const run = (script, args = [], extraEnv = {}) => spawnSync(process.execPath, ['--', script, ...args], {
  cwd: root, env: { PATH: process.env.PATH, ...extraEnv }, encoding: 'utf8', timeout: 15000,
});
try {
  for (const dir of ['src', 'scripts', 'assets', 'public', 'supabase/migrations', 'supabase/templates', 'ops']) await mkdir(join(root, dir), { recursive: true });
  for (const file of ['package.json', 'package-lock.json', 'next.config.js', 'tsconfig.json', 'vercel.json', '.env.example']) await writeFile(join(root, file), '{}');
  await writeFile(join(root, 'src/app.ts'), 'const value = 1;');
  await writeFile(join(root, 'supabase/migrations/202609190001_initial.sql'), 'select 1;');
  const first = await releaseSnapshot(root);
  await test('snapshot deterministic', async () => assert.deepEqual(await releaseSnapshot(root), first));
  await test('source edits invalidate record digest', async () => {
    await writeFile(join(root, 'src/app.ts'), 'const value = 2;');
    const changed = await releaseSnapshot(root); assert.notEqual(changed.sourceDigest, first.sourceDigest); assert.equal(changed.migrationDigest, first.migrationDigest);
  });
  await test('migration edits invalidate migration digest', async () => {
    await writeFile(join(root, 'supabase/migrations/202609190001_initial.sql'), 'select 2;');
    assert.notEqual((await releaseSnapshot(root)).migrationDigest, first.migrationDigest);
  });
  await test('duplicate migration versions rejected', async () => {
    const file = join(root, 'supabase/migrations/202609190001_duplicate.sql');
    await writeFile(file, 'select 3;'); try { await assert.rejects(releaseSnapshot(root)); } finally { await rm(file); }
  });
  await test('source symlink rejected', async () => {
    const file = join(root, 'src/link.ts'); await symlink(join(root, 'src/app.ts'), file);
    try { await assert.rejects(releaseSnapshot(root)); } finally { await rm(file); }
  });
  await test('public assets covered by source digest', async () => {
    const before = await releaseSnapshot(root);
    await writeFile(join(root, 'public/robots.txt'), 'User-agent: *');
    assert.notEqual((await releaseSnapshot(root)).sourceDigest, before.sourceDigest);
  });
  const current = await releaseSnapshot(root);
  await test('actual env file excluded from snapshot', async () => {
    await writeFile(join(root, '.env.local'), 'SUPABASE_SERVICE_ROLE_KEY=SensitiveFileSentinel');
    assert.deepEqual(await releaseSnapshot(root), current);
  });
  const recordFile = join(root, 'ops/release.example.json');
  await writeFile(recordFile, JSON.stringify({ ...record, ...current, checks: {} }));
  await test('CLI no automatic env loading', () => {
    const out = run(cli, ['--config-only', '--target', target, '--format', 'json']);
    assert.equal(out.status, 1); assert.equal(JSON.parse(out.stdout).status, 'BLOCKED'); assert.ok(!out.stdout.includes('SensitiveFileSentinel'));
  });
  await test('CLI config valid distinguished from full pending', () => {
    assert.equal(run(cli, ['--config-only', '--target', target], env).status, 0);
    const out = run(cli, ['--target', target, '--format', 'json'], env);
    assert.equal(out.status, 1); assert.equal(JSON.parse(out.stdout).blocked, 15);
  });
  await test('CLI full valid record', async () => {
    const live = { ...record, ...current, checks: clone(record.checks) };
    for (const check of Object.values(live.checks)) check.checkedAt = new Date().toISOString();
    await writeFile(recordFile, JSON.stringify(live));
    const out = run(cli, ['--target', target, '--format', 'json'], env);
    assert.equal(out.status, 0); assert.equal(JSON.parse(out.stdout).status, 'READY_FOR_MANUAL_RELEASE_REVIEW');
  });
  await test('explicit env file replaces inherited environment', async () => {
    const file = join(root, 'explicit.env');
    await writeFile(file, Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n'));
    assert.equal(run(cli, ['--target', target, '--config-only', '--env-file', file], { NEXT_PUBLIC_BAD: 'SensitiveInheritedSentinel', VERCEL_ENV: 'preview' }).status, 0);
    await writeFile(file, 'AUTH_SITE_ORIGIN=https://life.uc.ac.kr');
    assert.equal(run(cli, ['--target', target, '--config-only', '--env-file', file], env).status, 1);
  });
  await test('CLI secret-safe failures', async () => {
    await writeFile(recordFile, '{"SensitiveParseSentinel":');
    for (const args of [['--unknown-SensitiveArgSentinel'], ['--record', recordFile], ['--env-file', 'SensitiveMissingPath'], ['--format', 'xml'], ['--snapshot', '--target', target]]) {
      const out = run(cli, args, env); assert.equal(out.status, 1); assert.ok(!/Sensitive/.test(out.stdout + out.stderr));
    }
  });
  await test('CLI bounded files', async () => {
    await writeFile(recordFile, 'x'.repeat(131073)); assert.equal(run(cli, ['--record', recordFile], env).status, 1);
  });
  await test('CLI help and snapshot', () => {
    assert.equal(run(cli, ['--help']).status, 0);
    const out = run(cli, ['--snapshot']); assert.equal(out.status, 0); assert.equal(JSON.parse(out.stdout).migrationCount, 1);
  });
  await mkdir(join(root, 'node_modules/next/dist/bin'), { recursive: true });
  await writeFile(join(root, 'node_modules/next/dist/bin/next'), "require('node:fs').writeFileSync('build-invoked', 'yes')");
  const buildEnv = { ...env, VERCEL: '1', VERCEL_ENV: target };
  await test('build rejects hidden local env before running Next', async () => {
    assert.equal(run(build, [], buildEnv).status, 1); await assert.rejects(readFile(join(root, 'build-invoked')));
    await rm(join(root, '.env.local'));
  });
  await test('build refuses missing Vercel identity', () => assert.equal(run(build, [], env).status, 1));
  await test('build refuses invalid config before Next', async () => {
    assert.equal(run(build, [], { ...buildEnv, AUTH_CAPTCHA_ENABLED: 'false' }).status, 1);
    await assert.rejects(readFile(join(root, 'build-invoked')));
  });
  await test('build invokes Next only after config gate passes', async () => {
    assert.equal(run(build, [], buildEnv).status, 0); assert.equal(await readFile(join(root, 'build-invoked'), 'utf8'), 'yes');
  });
  await test('build forwards failing Next exit', async () => {
    await writeFile(join(root, 'node_modules/next/dist/bin/next'), 'process.exit(7)');
    assert.equal(run(build, [], buildEnv).status, 7);
  });
} finally { await rm(root, { recursive: true, force: true }); }
console.log(`${passed} release-readiness checks passed${process.exitCode ? '; failures above' : ''}. Synthetic inputs only.`);
