import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { REQUIRED_CHARACTERS, validPreviewTarget, inspectHostedAuth, readLiveAuthConfig } from './lib/hosted-auth-preflight.mjs';

const site = 'https://stage.uc.ac.kr';
const config = {
  site_url: site, password_min_length: 12, password_required_characters: REQUIRED_CHARACTERS,
  external_email_enabled: true, mailer_autoconfirm: false, mailer_otp_exp: 900,
  smtp_host: 'smtp.provider.invalid', smtp_max_frequency: 60,
  security_captcha_enabled: true, security_captcha_provider: 'turnstile',
  mfa_totp_enroll_enabled: true, mfa_totp_verify_enabled: true,
};
const request = { previewRef: 'abcdefghijklmnopqrst', productionRef: 'tsrqponmlkjihgfedcba', siteOrigin: site, token: 'SyntheticSensitiveToken' };
let passed = 0;
async function test(name, run) {
  try { await run(); passed++; } catch { console.error(`FAIL ${name}`); process.exitCode = 1; }
}
const blocked = c => assert.equal(inspectHostedAuth(c, site).status, 'CONFIG_BLOCKED');
await test('matching config still runtime pending', () => {
  const result = inspectHostedAuth(config, site);
  assert.equal(result.status, 'CONFIG_MATCH_RUNTIME_PENDING'); assert.equal(result.pending.length, 4);
});
for (const key of Object.keys(config)) await test(`missing ${key}`, () => { const c = { ...config }; delete c[key]; blocked(c); });
for (const value of [null, [], 7, 'SensitiveInput']) await test('nonobject blocked', () => blocked(value));
for (const value of [6, 11, 13, '12']) await test('wrong minimum rejected', () => blocked({ ...config, password_min_length: value }));
for (const value of ['', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789', 'abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789']) {
  await test('weaker presets rejected', () => blocked({ ...config, password_required_characters: value }));
}
await test('managed native preset uses separate upper and lowercase groups', () => {
  assert.ok(REQUIRED_CHARACTERS.startsWith('abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789:'));
});
for (const change of [{ mailer_autoconfirm: true }, { mailer_otp_exp: 3600 }, { smtp_max_frequency: 59 }, { smtp_max_frequency: '60' }, { smtp_host: 'localhost' }, { security_captcha_enabled: false }, { security_captcha_provider: 'hcaptcha' }, { mfa_totp_enroll_enabled: false }, { mfa_totp_verify_enabled: false }]) {
  await test('unsafe or mismatched setting rejected', () => blocked({ ...config, ...change }));
}
await test('opaque extra secrets never printed', () => {
  const result = JSON.stringify(inspectHostedAuth({ ...config, smtp_pass: 'SensitivePassword', security_captcha_secret: 'SensitiveCaptcha', strange: { access_token: 'SensitiveAccess' } }, site));
  assert.ok(!result.includes('Sensitive')); assert.ok(!result.includes(site));
});
for (const value of ['http://stage.uc.ac.kr', 'https://127.0.0.1', 'https://[::1]', 'https://stage.local', 'https://stage.example.com', 'https://stage.uc.ac.kr/', 'https://user:pass@stage.uc.ac.kr', 'https://stage.uc.ac.kr?x=1']) {
  await test('invalid origin no network', async () => {
    let calls = 0; await assert.rejects(readLiveAuthConfig({ ...request, siteOrigin: value }, async () => { calls++; })); assert.equal(calls, 0);
  });
}
for (const change of [{ previewRef: request.productionRef }, { previewRef: 'bad/../../' }, { productionRef: '' }, { token: '' }, { token: 'bad\r\nHeader' }]) {
  await test('invalid target or token no network', async () => {
    let calls = 0; await assert.rejects(readLiveAuthConfig({ ...request, ...change }, async () => { calls++; })); assert.equal(calls, 0);
  });
}
await test('one fixed GET with no redirect and timeout', async () => {
  let calls = 0;
  const result = await readLiveAuthConfig(request, async (url, options) => {
    calls++; assert.equal(url, `https://api.supabase.com/v1/projects/${request.previewRef}/config/auth`);
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error'); assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers.Authorization, `Bearer ${request.token}`);
    return new Response(JSON.stringify(config));
  });
  assert.equal(calls, 1); assert.deepEqual(result, config);
});
for (const status of [301, 401, 403, 429, 500]) await test('remote failure safe and no retry', async () => {
  let calls = 0;
  await assert.rejects(readLiveAuthConfig(request, async () => { calls++; return new Response('SensitiveRemoteBody', { status }); }), { message: 'PREFLIGHT_READ_FAILED' });
  assert.equal(calls, 1);
});
await test('network errors redacted', async () => {
  await assert.rejects(readLiveAuthConfig(request, async () => { throw new Error('SensitiveNetworkError'); }), { message: 'PREFLIGHT_READ_FAILED' });
});
await test('malformed remote JSON redacted', async () => {
  await assert.rejects(readLiveAuthConfig(request, async () => new Response('SensitiveMalformedJson')), { message: 'PREFLIGHT_READ_FAILED' });
});
await test('large content-length rejected', async () => {
  await assert.rejects(readLiveAuthConfig(request, async () => new Response('{}', { headers: { 'content-length': '1048577' } })));
});
await test('large streamed response rejected', async () => {
  await assert.rejects(readLiveAuthConfig(request, async () => new Response('x'.repeat(1048577))));
});
const root = await mkdtemp(join(tmpdir(), 'hosted-auth-test-'));
const cli = resolve('scripts/check-hosted-auth.mjs');
const run = args => spawnSync(process.execPath, ['--', cli, ...args], { cwd: root, env: { PATH: process.env.PATH }, encoding: 'utf8', timeout: 15000 });
try {
  const file = join(root, 'config.json');
  await writeFile(file, JSON.stringify(config));
  await test('offline CLI succeeds with runtime pending', () => {
    const r = run(['--config-file', file, '--site-origin', site]); assert.equal(r.status, 0);
    assert.equal(JSON.parse(r.stdout).mode, 'OFFLINE'); assert.equal(JSON.parse(r.stdout).status, 'CONFIG_MATCH_RUNTIME_PENDING');
  });
  await test('no implicit env loading', async () => {
    await writeFile(join(root, '.env.local'), 'SUPABASE_ACCESS_TOKEN=SensitiveMustNotLoad');
    const r = run(['--live', '--preview-ref', request.previewRef, '--production-ref', request.productionRef, '--site-origin', site]);
    assert.equal(r.status, 1); assert.ok(!r.stdout.includes('Sensitive'));
  });
  for (const args of [[], ['--unknown-SensitiveArgument'], ['--config-file', 'SensitiveMissingFile', '--site-origin', site], ['--live', '--config-file', file, '--site-origin', site], ['--config-file', file, '--site-origin', site, '--production-ref', request.productionRef]]) {
    await test('CLI safe invalid input', () => { const r = run(args); assert.equal(r.status, 1); assert.ok(!/Sensitive/.test(r.stdout + r.stderr)); });
  }
  await test('malformed file safe', async () => {
    await writeFile(file, '{"SensitiveFileParse":'); const r = run(['--config-file', file, '--site-origin', site]);
    assert.equal(r.status, 1); assert.ok(!/Sensitive/.test(r.stdout + r.stderr));
  });
  await test('oversized file rejected', async () => {
    await writeFile(file, 'x'.repeat(1048577)); assert.equal(run(['--config-file', file, '--site-origin', site]).status, 1);
  });
  await test('help is offline', () => assert.equal(run(['--help']).status, 0));
} finally { await rm(root, { recursive: true, force: true }); }
await test('target guard distinguishes production', () => assert.equal(validPreviewTarget(request.productionRef, request.productionRef, site), false));
console.log(`${passed} hosted-auth preflight checks passed${process.exitCode ? '; failures above' : ''}. No live services used.`);
