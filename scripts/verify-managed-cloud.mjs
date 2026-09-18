import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { inspectEnvironment } from './lib/release-readiness.mjs';
import { CLOUD_REQUIRED_CHARACTERS } from './lib/managed-cloud.mjs';

function loadTs(path) {
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function('exports', 'require', js)(exports, name => { if (name === 'node:crypto') return {}; if (name === 'node:net') return {}; throw new Error(name); });
  return exports;
}
const { isValidPassword, getPasswordChecks } = loadTs('src/lib/auth/password-policy.ts');
const { botProtectionConfig } = loadTs('src/lib/auth/abuse-policy.ts');
let passed = 0;
function test(label, fn) { fn(); passed++; console.log(`PASS ${label}`); }
for (const value of ['Abcdefghij1!', 'LongPassword123:']) test('mixed-case native-compatible password accepted', () => assert.ok(isValidPassword(value)));
for (const value of ['abcdefghij1!', 'ABCDEFGHIJ1!', 'Abcdefghijk!', 'Abcdefghij12', 'Abcdefghi1!', 'A'.repeat(129)+'a1!']) test('missing character or invalid length rejected', () => assert.equal(isValidPassword(value), false));
test('accessible checklist has separate upper and lower case', () => assert.equal(getPasswordChecks('').length, 5));
test('managed policy has separate letter groups', () => assert.ok(CLOUD_REQUIRED_CHARACTERS.startsWith('abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789:')));
const env = {
  VERCEL:'1', VERCEL_ENV:'preview', AUTH_PROFILE:'managed-cloud-v1', SUPABASE_DEPLOYMENT_KIND:'cloud',
  PREVIEW_REVIEW_ONLY:'false', AUTH_EMAIL_ENABLED:'false', AUTH_ABUSE_MODE:'native-rate-limits', AUTH_CAPTCHA_ENABLED:'false',
  AUTH_TRUSTED_IP_HEADER:'x-vercel-forwarded-for',
  NEXT_PUBLIC_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY:'sb_publishable_SyntheticPublicKey123456789',
  SUPABASE_SERVICE_ROLE_KEY:'sb_secret_SyntheticPrivateKey123456789',
  AUTH_RATE_LIMIT_SECRET:'Synthetic-Acceptance-Rate-Secret-0123456789-Only',
  AUTH_SITE_ORIGIN:'https://review.uc.ac.kr', CERTIFICATE_VERIFY_ORIGIN:'https://review.uc.ac.kr',
  RELEASE_PRODUCTION_SITE_ORIGIN:'https://life.uc.ac.kr', RELEASE_PRODUCTION_SUPABASE_REF:'tsrqponmlkjihgfedcba',
  NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID:'dpl_synthetic',
};
const valid = (e,target='preview') => inspectEnvironment(e,target).every(c=>c.status==='PASS');
test('explicit managed profile can deploy while email is pending', () => assert.ok(valid(env)));
test('production uses its own DB and site', () => assert.ok(valid({...env,VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:`https://${env.RELEASE_PRODUCTION_SUPABASE_REF}.supabase.co`,AUTH_SITE_ORIGIN:env.RELEASE_PRODUCTION_SITE_ORIGIN,CERTIFICATE_VERIFY_ORIGIN:env.RELEASE_PRODUCTION_SITE_ORIGIN},'production')));
for (const change of [{AUTH_EMAIL_ENABLED:undefined},{PREVIEW_REVIEW_ONLY:'true'},{AUTH_ABUSE_MODE:undefined},{AUTH_RATE_LIMIT_SECRET:''},{SUPABASE_SERVICE_ROLE_KEY:''},{NEXT_PUBLIC_UNKNOWN_SECRET:env.SUPABASE_SERVICE_ROLE_KEY},{AUTH_LOCAL_CAPTCHA_TEST:'true'},{SUPABASE_DEPLOYMENT_KIND:'self-hosted'}]) test('misconfigured managed deployment blocked', () => assert.equal(valid({...env,...change}),false));
test('explicit managed native rate limits permit login guard', () => assert.equal(botProtectionConfig(env).unavailable,false));
test('arbitrary remote CAPTCHA disable still fails closed', () => assert.equal(botProtectionConfig({...env,AUTH_PROFILE:undefined}).unavailable,true));
test('leftover CAPTCHA site key is not silently ignored', () => assert.equal(botProtectionConfig({...env,AUTH_TURNSTILE_SITE_KEY:'synthetic-key'}).unavailable,true));
console.log(`${passed} managed Cloud checks passed.`);
