import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { join } from 'node:path';
import { SELF_HOSTED_CHECKS, validAuthImage, validBackendOrigin, validConfigDigest, validStackId } from './self-hosted-preflight.mjs';

export const RELEASE_CHECKS = Object.freeze({
  'environment-isolation': 'Vercel 도메인·Preview/Production 분리',
  'native-password-policy': '확정 비밀번호 규칙의 native Auth 강제',
  'hosted-auth-compatibility': '운영 Supabase의 Auth schema·감사 이벤트 호환성',
  'smtp-recovery': '승인 SMTP·메일 인증·15분 복구 링크',
  'native-captcha': '운영 CAPTCHA 키와 직접 API 검증',
  'mfa-access-recovery': 'MFA·권한 위임·분실 복구 담당자',
  'database-security': 'Migration·RLS·이관·직접 API 권한',
  'privacy-consent': '승인 개인정보 문안·동의·보유기간',
  'unconfirmed-policies': '환불·감면·강사 심사 미확정 기능 제한',
  'proxy-rate-limits': '신뢰 프록시·WAF·공개 API 한도',
  'retention-jobs': '인증 제한 기록 정리·실패 감시',
  'backup-restore': '백업·별도 파일·실제 복원·RPO/RTO',
  'release-smoke': '대상 런타임·브라우저·접근성·PDF·의존성 검사',
  'monitoring-costs': '상태·실패율·비용·담당자 알림',
  'release-rollback': '운영 게시 승인·이전 build와 현재 DB 호환성',
});

const PUBLIC_NAMES = new Set(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']);
// Vercel injects these public metadata names during hosted builds. No prefix wildcard.
const REVIEW_PUBLIC_NAMES = new Set([...PUBLIC_NAMES, ...[
  'ENV', 'TARGET_ENV', 'URL', 'BRANCH_URL', 'PROJECT_PRODUCTION_URL', 'HASH_SALT',
  'REGION', 'DEPLOYMENT_ID', 'PROJECT_ID',
  'GIT_PROVIDER', 'GIT_PREVIOUS_SHA', 'GIT_REPO_SLUG', 'GIT_REPO_OWNER', 'GIT_REPO_ID', 'GIT_COMMIT_REF',
  'GIT_COMMIT_SHA', 'GIT_COMMIT_MESSAGE', 'GIT_COMMIT_AUTHOR_LOGIN', 'GIT_COMMIT_AUTHOR_NAME',
  'GIT_PULL_REQUEST_ID', 'OBSERVABILITY_CLIENT_CONFIG',
].map(name => `NEXT_PUBLIC_VERCEL_${name}`)]);
const REF = /^[a-z0-9]{20}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const row = (id, pass, message) => ({ id, status: pass ? 'PASS' : 'BLOCK', message });
const placeholder = value => typeof value !== 'string' || !value.trim() ||
  /your[-_ ]|replace|changeme|placeholder|todo|미정|입력하세요|example\.(com|org|net|invalid)/i.test(value);

function publicOrigin(value) {
  if (placeholder(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.origin !== value || url.port || url.username || url.password ||
        isIP(url.hostname.replace(/^\[|\]$/g, '')) || !url.hostname.includes('.') ||
        /(^|\.)(localhost|local|internal|invalid|test|example)$/.test(url.hostname) ||
        /(^|\.)example\.(com|net|org)$/.test(url.hostname)) return null;
    return url;
  } catch { return null; }
}

function projectRef(value) {
  return publicOrigin(value)?.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/)?.[1];
}

function keyShape(value, role, ref, selfHosted = false) {
  if ((!selfHosted && !ref) || placeholder(value) || value.length > 8192) return false;
  const prefix = role === 'anon' ? 'publishable' : 'secret';
  if (new RegExp(`^sb_${prefix}_[A-Za-z0-9_-]{20,}$`).test(value)) return true;
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return false;
  try {
    // Shape and claims only. This does NOT verify a JWT signature or a live API key.
    const payload = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString());
    return payload?.role === role && (selfHosted ? payload?.iss === 'supabase' && !Object.hasOwn(payload, 'ref') : payload?.ref === ref);
  } catch { return false; }
}

export function inspectEnvironment(env, target) {
  const managed = env.AUTH_PROFILE === 'managed-cloud-v1';
  const kind = env.SUPABASE_DEPLOYMENT_KIND ?? 'cloud';
  const selfHosted = kind === 'self-hosted';
  const ref = projectRef(env.NEXT_PUBLIC_SUPABASE_URL);
  const site = publicOrigin(env.AUTH_SITE_ORIGIN);
  const baseline = publicOrigin(env.RELEASE_PRODUCTION_SITE_ORIGIN);
  const productionRef = env.RELEASE_PRODUCTION_SUPABASE_REF;
  const publicValues = Object.entries(env).filter(([name]) => name.startsWith('NEXT_PUBLIC_'));
  const secret = env.AUTH_RATE_LIMIT_SECRET;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const captcha = env.AUTH_TURNSTILE_SITE_KEY;
  const validTarget = ['preview', 'production'].includes(target);
  const backend = validBackendOrigin(env.NEXT_PUBLIC_SUPABASE_URL);
  const productionBackend = validBackendOrigin(env.RELEASE_PRODUCTION_BACKEND_ORIGIN);
  const selfHostedNames = ['SELF_HOSTED_STACK_ID', 'SELF_HOSTED_AUTH_IMAGE', 'SELF_HOSTED_CONFIG_DIGEST',
    'RELEASE_PRODUCTION_BACKEND_ORIGIN', 'RELEASE_PRODUCTION_STACK_ID'];
  if (env.PREVIEW_REVIEW_ONLY === 'true') return [
    row('review-preview-only', target === 'preview' && env.VERCEL_ENV === 'preview' && env.VERCEL === '1', '검토 전용 모드는 Vercel Preview에서만 빌드할 수 있습니다.'),
    row('review-cloud-only', kind === 'cloud' && selfHostedNames.every(name => !env[name]), '검토 전용 모드는 분리된 Cloud Preview 공개 API만 사용합니다.'),
    row('review-environment-isolation', !!ref && REF.test(productionRef ?? '') && ref !== productionRef &&
      !!site && !!baseline && site.origin !== baseline.origin && env.CERTIFICATE_VERIFY_ORIGIN === site.origin,
      '검토 DB·사이트는 운영 기준과 달라야 하며 HTTPS origin을 사용해야 합니다.'),
    row('review-public-key', keyShape(env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'anon', ref), 'Preview 공개 키의 형식·역할을 확인합니다. 실제 연결은 별도로 검증합니다.'),
    row('review-public-allowlist', publicValues.every(([name]) => REVIEW_PUBLIC_NAMES.has(name)),
      `허용한 앱·Vercel 공개 변수만 사용할 수 있습니다. 미등록 이름: ${publicValues.filter(([name]) => !REVIEW_PUBLIC_NAMES.has(name)).map(([name]) => name).join(', ') || '없음'}`),
    row('review-no-privileged-auth', !serviceKey && !secret && !env.AUTH_CAPTCHA_ENABLED && !captcha &&
      !env.AUTH_LOCAL_CAPTCHA_TEST && !env.SUPABASE_SECRET_KEY && !env.SUPABASE_JWT_SECRET &&
      !env.POSTGRES_URL && !env.DATABASE_URL, '검토 배포에는 서버 키·DB 비밀·인증 실행 설정을 넣지 않습니다.'),
  ];
  return [
    row('review-mode-value', !env.PREVIEW_REVIEW_ONLY || env.PREVIEW_REVIEW_ONLY === 'false', '검토 모드 설정은 true 또는 false만 허용합니다.'),
    row('deployment-kind', ['cloud', 'self-hosted'].includes(kind), 'Cloud 또는 self-hosted 배포 종류를 지정해야 합니다.'),
    row('deployment-config-separation', selfHosted ? !env.RELEASE_PRODUCTION_SUPABASE_REF :
      selfHostedNames.every(name => !env[name]), 'Cloud ref와 자체 운영 스택 설정을 혼용할 수 없습니다.'),
    row('target', validTarget && (!env.VERCEL_ENV || env.VERCEL_ENV === target), 'Preview/Production 대상과 Vercel 환경이 일치해야 합니다.'),
    row('database-origin', selfHosted ? backend && env.NEXT_PUBLIC_SUPABASE_URL !== env.AUTH_SITE_ORIGIN : !!ref,
      'Cloud는 기본 프로젝트 HTTPS URL, 자체 운영은 앱과 다른 공개 HTTPS 백엔드 origin이 필요합니다.'),
    row('site-origin', !!site, 'AUTH_SITE_ORIGIN은 경로 없는 공개 HTTPS origin이어야 합니다.'),
    row('certificate-origin', !!site && env.CERTIFICATE_VERIFY_ORIGIN === env.AUTH_SITE_ORIGIN, '증명 검증 origin은 이 환경의 사이트 origin과 같아야 합니다.'),
    row('production-baseline', !!baseline && (selfHosted ? productionBackend && validStackId(env.RELEASE_PRODUCTION_STACK_ID) &&
      env.RELEASE_PRODUCTION_BACKEND_ORIGIN !== env.RELEASE_PRODUCTION_SITE_ORIGIN : typeof productionRef === 'string' && REF.test(productionRef)),
      'Production 사이트 및 배포 종류에 맞는 DB/스택 기준값이 필요합니다.'),
    row('environment-isolation', validTarget && !!site && !!baseline && (selfHosted ?
      backend && productionBackend && validStackId(env.SELF_HOSTED_STACK_ID) && validStackId(env.RELEASE_PRODUCTION_STACK_ID) &&
        (target === 'production' ? env.NEXT_PUBLIC_SUPABASE_URL === env.RELEASE_PRODUCTION_BACKEND_ORIGIN &&
          env.SELF_HOSTED_STACK_ID === env.RELEASE_PRODUCTION_STACK_ID && site.origin === baseline.origin :
          env.NEXT_PUBLIC_SUPABASE_URL !== env.RELEASE_PRODUCTION_BACKEND_ORIGIN &&
          env.SELF_HOSTED_STACK_ID !== env.RELEASE_PRODUCTION_STACK_ID && site.origin !== baseline.origin) :
      !!ref && REF.test(productionRef ?? '') && (target === 'production'
        ? ref === productionRef && site.origin === baseline.origin
        : ref !== productionRef && site.origin !== baseline.origin)), 'Production은 기준값과 같고 Preview는 DB·사이트·스택이 분리되어야 합니다.'),
    ...(selfHosted ? [row('self-hosted-artifacts', validStackId(env.SELF_HOSTED_STACK_ID) && validAuthImage(env.SELF_HOSTED_AUTH_IMAGE) &&
      validConfigDigest(env.SELF_HOSTED_CONFIG_DIGEST), '고정 스택 ID·Auth 이미지 버전/digest·비밀 없는 설정 지문이 필요합니다.')] : []),
    row('public-key-shape', keyShape(env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'anon', ref, selfHosted), '공개 키의 형식/역할/배포 종류를 확인합니다. 실제 키 유효성·서명·귀속 검증은 별도입니다.'),
    row('server-key-shape', keyShape(serviceKey, 'service_role', ref, selfHosted) && serviceKey !== env.NEXT_PUBLIC_SUPABASE_ANON_KEY, '서버 키의 형식/역할/배포 종류를 확인합니다. 실제 키 유효성·서명·귀속 검증은 별도입니다.'),
    row('public-allowlist', publicValues.every(([name]) => (managed ? REVIEW_PUBLIC_NAMES : PUBLIC_NAMES).has(name)), '검토된 공개 변수만 허용합니다. 새 공개 변수는 설계 검토가 필요합니다.'),
    row('secret-exposure', [serviceKey, secret].filter(v => typeof v === 'string' && v.length > 0)
      .every(value => publicValues.every(([, publicValue]) => !String(publicValue).includes(value))), '서버 키와 요청 제한 비밀값은 공개 변수에 포함할 수 없습니다.'),
    row('rate-secret', !placeholder(secret) && secret.length >= 32 && secret.length <= 256 &&
      !/\s/.test(secret) && new Set(secret).size >= 12 && secret !== serviceKey && secret !== env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    '독립적으로 생성한 32자 이상 HMAC 비밀값이 필요합니다. 형식 검사는 임의성을 보장하지 않습니다.'),
    row('captcha', (env.AUTH_CAPTCHA_ENABLED === 'true' && typeof captcha === 'string' &&
      /^[A-Za-z0-9_-]{20,100}$/.test(captcha) && !/^[123]x0{8}/.test(captcha) && !placeholder(captcha)) ||
      (managed && kind === 'cloud' && env.AUTH_ABUSE_MODE === 'native-rate-limits' && env.AUTH_CAPTCHA_ENABLED === 'false' && !captcha),
      '실제 CAPTCHA 또는 관리형 native·앱 요청 제한을 명시해야 합니다.'),
    ...(managed ? [row('managed-profile', kind === 'cloud' && ['true','false'].includes(env.AUTH_EMAIL_ENABLED) &&
      env.PREVIEW_REVIEW_ONLY === 'false' && env.VERCEL === '1', '관리형 배포는 Cloud·메일 상태·정상 업무 모드를 명시해야 합니다.')] : []),
    row('local-test-disabled', !env.AUTH_LOCAL_CAPTCHA_TEST, '로컬 CAPTCHA 시험 변수가 없어야 합니다.'),
    row('trusted-proxy', env.AUTH_TRUSTED_IP_HEADER === 'x-vercel-forwarded-for' &&
      (!env.TRUST_PROXY_IP || env.TRUST_PROXY_IP === 'false'), 'Vercel 신뢰 IP 헤더를 지정하고 legacy TRUST_PROXY_IP를 사용하지 않아야 합니다.'),
  ];
}

export function inspectRecord(record, env, target, snapshot, now = Date.now()) {
  const valid = record && typeof record === 'object' && !Array.isArray(record);
  const r = valid ? record : {};
  const textField = (value, max) => !placeholder(value) && value.length <= max;
  const selfHosted = env.SUPABASE_DEPLOYMENT_KIND === 'self-hosted';
  const checks = { ...RELEASE_CHECKS, ...(selfHosted ? SELF_HOSTED_CHECKS : {}) };
  return [
    row('review-not-a-release', env.PREVIEW_REVIEW_ONLY !== 'true', '검토 전용 배포는 운영 인수 승인 대상이 아닙니다.'),
    row('record-schema', valid && (selfHosted ? r.schemaVersion === 2 && r.deploymentKind === 'self-hosted' && !r.supabaseProjectRef :
      r.schemaVersion === 1 && (!r.deploymentKind || r.deploymentKind === 'cloud') && !r.stackId && !r.backendOrigin && !r.authImage && !r.configDigest),
      'Cloud는 기록 버전 1, 자체 운영은 배포 종류가 명시된 버전 2가 필요합니다. 혼용은 거부합니다.'),
    row('record-environment', r.target === target && !!publicOrigin(r.siteOrigin) && r.siteOrigin === env.AUTH_SITE_ORIGIN &&
      (selfHosted ? validBackendOrigin(r.backendOrigin) && r.backendOrigin === env.NEXT_PUBLIC_SUPABASE_URL &&
        validStackId(r.stackId) && r.stackId === env.SELF_HOSTED_STACK_ID && validAuthImage(r.authImage) && r.authImage === env.SELF_HOSTED_AUTH_IMAGE &&
        validConfigDigest(r.configDigest) && r.configDigest === env.SELF_HOSTED_CONFIG_DIGEST :
        !!projectRef(env.NEXT_PUBLIC_SUPABASE_URL) && r.supabaseProjectRef === projectRef(env.NEXT_PUBLIC_SUPABASE_URL)),
      '기록의 대상·사이트·DB/스택·Auth 이미지·설정 지문은 검사 환경과 같아야 합니다.'),
    row('record-source', DIGEST.test(r.sourceDigest ?? '') && r.sourceDigest === snapshot.sourceDigest, '점검한 소스 지문이 현재 배포 후보와 같아야 합니다.'),
    row('record-migrations', DIGEST.test(r.migrationDigest ?? '') && r.migrationDigest === snapshot.migrationDigest, '점검한 migration 지문이 현재 배포 후보와 같아야 합니다.'),
    ...Object.entries(checks).map(([id, label]) => {
      const check = r.checks?.[id];
      const time = typeof check?.checkedAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(check.checkedAt)
        ? Date.parse(check.checkedAt) : NaN;
      const dateValid = Number.isFinite(time) && new Date(time).toISOString().replace('.000Z', 'Z') === check.checkedAt?.replace('.000Z', 'Z');
      return row(`evidence-${id}`, check?.status === 'confirmed' && textField(check.owner, 120) && textField(check.evidence, 1000) &&
        dateValid && time <= now + 60_000 && now - time <= 30 * 86_400_000, `${label}: 30일 이내 담당자 확인과 증거 참조가 필요합니다.`);
    }),
  ];
}

export function readinessResult(checks, configOnly = false) {
  const blocked = checks.filter(check => check.status !== 'PASS').length;
  return {
    status: blocked ? 'BLOCKED' : configOnly ? 'CONFIG_VALID' : 'READY_FOR_MANUAL_RELEASE_REVIEW',
    blocked,
    notice: '오프라인 설정·기록 완결성 검사입니다. 실제 키/원격 정책/증거의 진위/게시 승인은 검증하지 않습니다.',
    checks,
  };
}

export async function releaseSnapshot(root) {
  const files = [];
  async function collect(relative, required = true) {
    const path = join(root, relative);
    let info;
    try { info = await lstat(path); } catch (error) {
      if (!required && error.code === 'ENOENT') return;
      throw new Error('SNAPSHOT_INPUT');
    }
    if (info.isSymbolicLink()) throw new Error('SNAPSHOT_SYMLINK');
    if (info.isDirectory()) {
      for (const name of (await readdir(path)).sort()) {
        if (!name.startsWith('.')) await collect(`${relative}/${name}`);
      }
    } else if (info.isFile()) files.push(relative);
    else throw new Error('SNAPSHOT_FILE_TYPE');
  }
  // Check the parent before descending: a linked supabase directory must not be followed.
  if ((await lstat(join(root, 'supabase'))).isSymbolicLink()) throw new Error('SNAPSHOT_SYMLINK');
  for (const folder of ['src', 'scripts', 'assets', 'public', 'supabase/migrations', 'supabase/templates']) await collect(folder);
  for (const file of ['package.json', 'package-lock.json', 'next.config.js', 'tsconfig.json', 'vercel.json', '.env.example']) await collect(file);
  // Only fixed non-secret templates, never real ops evidence/configuration files.
  for (const parent of ['ops', 'ops/self-hosted']) {
    try { if ((await lstat(join(root, parent))).isSymbolicLink()) throw new Error('SNAPSHOT_SYMLINK'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const file of ['compose.auth-policy.json', 'app.env.example', 'runtime.example.json', 'release.example.json']) {
    await collect(`ops/self-hosted/${file}`, false);
  }
  for (const file of (await readdir(root)).sort()) {
    if (/^(tailwind|postcss)\.config\.[a-z]+$/.test(file)) await collect(file);
  }
  const sourceHash = createHash('sha256');
  const migrationHash = createHash('sha256');
  const versions = new Set();
  let migrationCount = 0;
  for (const file of files.sort()) {
    const bytes = await readFile(join(root, file));
    const frame = `${file}\0${bytes.length}\0`;
    sourceHash.update(frame).update(bytes);
    if (file.startsWith('supabase/migrations/') && file.endsWith('.sql')) {
      const version = file.split('/').at(-1).match(/^(\d+)_/)?.[1];
      if (!version || versions.has(version)) throw new Error('MIGRATION_VERSION');
      versions.add(version);
      migrationCount += 1;
      migrationHash.update(frame).update(bytes);
    }
  }
  if (!migrationCount) throw new Error('MIGRATIONS_MISSING');
  return { sourceDigest: sourceHash.digest('hex'), migrationDigest: migrationHash.digest('hex'), fileCount: files.length, migrationCount };
}
