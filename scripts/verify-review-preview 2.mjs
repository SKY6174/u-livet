import assert from 'node:assert/strict';
import { inspectEnvironment, inspectRecord, readinessResult } from './lib/release-readiness.mjs';

// Synthetic configuration only; never loads env files or performs remote writes.
const env = {
  PREVIEW_REVIEW_ONLY: 'true', VERCEL: '1', VERCEL_ENV: 'preview',
  SUPABASE_DEPLOYMENT_KIND: 'cloud',
  NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_SyntheticPublicAbc1234567890',
  AUTH_SITE_ORIGIN: 'https://review.uc.ac.kr', CERTIFICATE_VERIFY_ORIGIN: 'https://review.uc.ac.kr',
  RELEASE_PRODUCTION_SITE_ORIGIN: 'https://life.uc.ac.kr', RELEASE_PRODUCTION_SUPABASE_REF: 'tsrqponmlkjihgfedcba',
};
const valid = (input, target = 'preview') => readinessResult(inspectEnvironment(input, target), true).blocked === 0;
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
test('isolated review Preview configuration passes', () => assert.ok(valid(env)));
test('Vercel injected public metadata does not block a hosted Preview', () => assert.ok(valid({
  ...env, NEXT_PUBLIC_VERCEL_ENV: 'preview', NEXT_PUBLIC_VERCEL_URL: 'review-uc.vercel.app',
  NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40), NEXT_PUBLIC_VERCEL_OBSERVABILITY_CLIENT_CONFIG: '{}',
  NEXT_PUBLIC_VERCEL_REGION: 'cle1', NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID: 'dpl_synthetic',
  NEXT_PUBLIC_VERCEL_PROJECT_ID: 'prj_synthetic', NEXT_PUBLIC_VERCEL_GIT_PREVIOUS_SHA: 'b'.repeat(40),
})));
test('unreviewed Vercel-prefixed variables remain blocked', () => assert.equal(valid({
  ...env, NEXT_PUBLIC_VERCEL_SECRET: 'synthetic-sensitive-value',
}), false));
test('review metadata exception does not change normal release policy', () => assert.equal(
  inspectEnvironment({ ...env, PREVIEW_REVIEW_ONLY: 'false', NEXT_PUBLIC_VERCEL_OBSERVABILITY_CLIENT_CONFIG: '{}' }, 'preview')
    .find(check => check.id === 'public-allowlist').status, 'BLOCK'));
test('production target cannot use review mode', () => assert.equal(valid({ ...env, VERCEL_ENV: 'production' }, 'production'), false));
for (const key of ['VERCEL', 'VERCEL_ENV', 'AUTH_SITE_ORIGIN', 'CERTIFICATE_VERIFY_ORIGIN', 'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'RELEASE_PRODUCTION_SITE_ORIGIN', 'RELEASE_PRODUCTION_SUPABASE_REF']) {
  test(`missing ${key} blocks review deployment`, () => { const input = { ...env }; delete input[key]; assert.equal(valid(input), false); });
}
test('production database cannot be reused', () => assert.equal(valid({ ...env, NEXT_PUBLIC_SUPABASE_URL: `https://${env.RELEASE_PRODUCTION_SUPABASE_REF}.supabase.co` }), false));
test('production site cannot be reused', () => assert.equal(valid({ ...env, AUTH_SITE_ORIGIN: env.RELEASE_PRODUCTION_SITE_ORIGIN, CERTIFICATE_VERIFY_ORIGIN: env.RELEASE_PRODUCTION_SITE_ORIGIN }), false));
for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'AUTH_RATE_LIMIT_SECRET', 'AUTH_CAPTCHA_ENABLED', 'AUTH_TURNSTILE_SITE_KEY',
  'AUTH_LOCAL_CAPTCHA_TEST', 'SUPABASE_SECRET_KEY', 'SUPABASE_JWT_SECRET', 'POSTGRES_URL', 'DATABASE_URL', 'NEXT_PUBLIC_UNREVIEWED', 'SELF_HOSTED_STACK_ID']) {
  test(`${key} cannot be inherited into review environment`, () => assert.equal(valid({ ...env, [key]: 'synthetic-not-a-real-secret' }), false));
}
test('review configuration cannot substitute full release acceptance', () => {
  const checks = inspectRecord({}, env, 'preview', { sourceDigest: 'a'.repeat(64), migrationDigest: 'b'.repeat(64) });
  assert.equal(checks.find(check => check.id === 'review-not-a-release').status, 'BLOCK');
});
test('unknown review flag fails closed', () => assert.equal(valid({ ...env, PREVIEW_REVIEW_ONLY: 'TRUE' }), false));
test('self-hosted mode cannot masquerade as Cloud review', () => assert.equal(valid({ ...env, SUPABASE_DEPLOYMENT_KIND: 'self-hosted' }), false));
console.log(`${passed} review deployment configuration checks passed.`);
