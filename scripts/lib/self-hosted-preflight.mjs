import { createHash } from 'node:crypto';
import { REQUIRED_CHARACTERS, validSiteOrigin } from './hosted-auth-preflight.mjs';

export const AUTH_POLICY = Object.freeze({
  GOTRUE_PASSWORD_MIN_LENGTH: '12',
  GOTRUE_PASSWORD_REQUIRED_CHARACTERS: REQUIRED_CHARACTERS,
  GOTRUE_AUDIT_LOG_DISABLE_POSTGRES: 'false',
  GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true',
  GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED: 'false',
  GOTRUE_MAILER_AUTOCONFIRM: 'false',
  GOTRUE_MAILER_OTP_EXP: '900',
  GOTRUE_SMTP_MAX_FREQUENCY: '60s',
  GOTRUE_SECURITY_CAPTCHA_ENABLED: 'true',
  GOTRUE_SECURITY_CAPTCHA_PROVIDER: 'turnstile',
  GOTRUE_MFA_TOTP_ENROLL_ENABLED: 'true',
  GOTRUE_MFA_TOTP_VERIFY_ENABLED: 'true',
});
export const SELF_HOSTED_CHECKS = Object.freeze({
  'self-hosted-operations': '고정 이미지·TLS/사설 포트·패치/키 관리·운영 담당자 인수',
});
export const validStackId = value => typeof value === 'string' && /^[a-z][a-z0-9-]{1,61}[a-z0-9]$/.test(value) &&
  !/placeholder|replace|changeme|example|todo/.test(value);
export const validAuthImage = value => typeof value === 'string' && /^supabase\/gotrue:v\d+\.\d+\.\d+@sha256:[a-f0-9]{64}$/.test(value);
export const validConfigDigest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const validBackendOrigin = value => validSiteOrigin(value) &&
  !/(^|\.)supabase\.(co|in)$/.test(new URL(value).hostname);
const item = (id, pass, message) => ({ id, status: pass ? 'PASS' : 'BLOCK', message });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const FIELDS = ['schemaVersion', 'target', 'stackId', 'backendOrigin', 'siteOrigin', 'authImage', 'settings'];
const EXTRA_SETTINGS = ['API_EXTERNAL_URL', 'GOTRUE_SITE_URL', 'GOTRUE_URI_ALLOW_LIST', 'GOTRUE_JWT_ISSUER',
  'GOTRUE_SMTP_HOST', 'GOTRUE_SMTP_PORT', 'GOTRUE_MAILER_TEMPLATES_RECOVERY', 'GOTRUE_DISABLE_SIGNUP'];
const SETTINGS = [...Object.keys(AUTH_POLICY), ...EXTRA_SETTINGS];

function templateUrl(value) {
  try {
    const u = new URL(value);
    return validSiteOrigin(u.origin) && !u.username && !u.password && !u.search && !u.hash && u.pathname !== '/';
  } catch { return false; }
}

function canonical(value) {
  return object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
}

export function inspectSelfHostedConfig(input) {
  const c = object(input) ? input : {};
  const s = object(c.settings) ? c.settings : {};
  const checks = [
    item('self-hosted-schema', object(input) && c.schemaVersion === 1 && Object.keys(c).length === FIELDS.length &&
      Object.keys(c).every(key => FIELDS.includes(key)) && object(c.settings) &&
      Object.keys(s).length === SETTINGS.length && Object.keys(s).every(key => SETTINGS.includes(key)),
    '허용된 비밀 없는 설정 필드만 기록합니다. 키/암호/전체 환경 덤프는 입력하지 마세요.'),
    item('self-hosted-target', ['preview', 'production'].includes(c.target), 'Preview/Production 대상을 명시해야 합니다.'),
    item('self-hosted-stack', validStackId(c.stackId), '고정된 환경별 스택 ID가 필요합니다.'),
    item('self-hosted-origins', validBackendOrigin(c.backendOrigin) && validSiteOrigin(c.siteOrigin) && c.backendOrigin !== c.siteOrigin,
      '서로 다른 앱/백엔드 공개 HTTPS origin이 필요합니다. Cloud 기본 URL은 사용할 수 없습니다.'),
    item('self-hosted-image', validAuthImage(c.authImage), '공식 Auth 이미지의 버전과 SHA-256 digest를 함께 고정해야 합니다.'),
    ...Object.entries(AUTH_POLICY).map(([key, value], index) => item(`self-hosted-policy-${index + 1}`, s[key] === value, `${key}: 승인된 native 정책 값과 같아야 합니다.`)),
    item('self-hosted-auth-url', validBackendOrigin(c.backendOrigin) && s.API_EXTERNAL_URL === `${c.backendOrigin}/auth/v1` &&
      s.GOTRUE_JWT_ISSUER === s.API_EXTERNAL_URL, 'Auth 외부 URL과 issuer는 백엔드 origin + /auth/v1이어야 합니다.'),
    item('self-hosted-redirect', validSiteOrigin(c.siteOrigin) && s.GOTRUE_SITE_URL === c.siteOrigin &&
      s.GOTRUE_URI_ALLOW_LIST === `${c.siteOrigin}/auth/reset-password`, 'Site URL 및 현재 복구 경로 하나만 허용해야 합니다.'),
    item('self-hosted-smtp', typeof s.GOTRUE_SMTP_HOST === 'string' && validSiteOrigin(`https://${s.GOTRUE_SMTP_HOST}`) &&
      ['465', '587'].includes(s.GOTRUE_SMTP_PORT), '승인 SMTP 호스트와 TLS용 포트가 필요합니다. 실제 TLS/인증/수신은 별도 인수합니다.'),
    item('self-hosted-template', templateUrl(s.GOTRUE_MAILER_TEMPLATES_RECOVERY), '한국어 복구 템플릿의 HTTPS 파일 URL이 필요합니다. 실제 내용과 수신은 별도 확인합니다.'),
    item('self-hosted-signup', ['true', 'false'].includes(s.GOTRUE_DISABLE_SIGNUP), '가입 개방 여부를 명시합니다. false 전환에는 정책·인증 인수가 필요합니다.'),
  ];
  const blocked = checks.filter(check => check.status === 'BLOCK').length;
  return {
    status: blocked ? 'CONFIG_BLOCKED' : 'CONFIG_MATCH_RUNTIME_PENDING', blocked, checks,
    configDigest: blocked ? null : createHash('sha256').update(JSON.stringify(canonical(c))).digest('hex'),
    notice: '제공된 비밀 없는 설정만 비교합니다. 실제 서버 설정·키·메일·CAPTCHA·DB 감사·MFA·게시 승인은 검증하지 않습니다.',
  };
}

export function inspectSelfHostedBinding(input, env, target) {
  const result = inspectSelfHostedConfig(input);
  return [...result.checks, item('self-hosted-binding', !result.blocked && env.SUPABASE_DEPLOYMENT_KIND === 'self-hosted' &&
    input.target === target && input.stackId === env.SELF_HOSTED_STACK_ID && input.backendOrigin === env.NEXT_PUBLIC_SUPABASE_URL &&
    input.siteOrigin === env.AUTH_SITE_ORIGIN && input.authImage === env.SELF_HOSTED_AUTH_IMAGE &&
    result.configDigest === env.SELF_HOSTED_CONFIG_DIGEST, '설정 증거의 대상·주소·스택·이미지·지문이 앱 환경과 같아야 합니다.')];
}

// Non-secret overlay only. Apply LAST to an independently reviewed official stack.
export function authComposeOverride() {
  return { services: { auth: {
    image: '${ANCHOR_AUTH_IMAGE:?pin the reviewed Auth image and digest}',
    environment: {
      ...Object.fromEntries(Object.entries(AUTH_POLICY).map(([key, value]) => [key, value.replaceAll('$', '$$$$')])),
      API_EXTERNAL_URL: '${ANCHOR_BACKEND_ORIGIN:?set backend HTTPS origin}/auth/v1',
      GOTRUE_JWT_ISSUER: '${ANCHOR_BACKEND_ORIGIN:?set backend HTTPS origin}/auth/v1',
      GOTRUE_SITE_URL: '${ANCHOR_APP_ORIGIN:?set app HTTPS origin}',
      GOTRUE_URI_ALLOW_LIST: '${ANCHOR_APP_ORIGIN:?set app HTTPS origin}/auth/reset-password',
      GOTRUE_DISABLE_SIGNUP: '${ANCHOR_DISABLE_SIGNUP:-true}',
      GOTRUE_SECURITY_CAPTCHA_SECRET: '${ANCHOR_CAPTCHA_SECRET:?inject native Turnstile secret}',
      GOTRUE_SMTP_HOST: '${ANCHOR_SMTP_HOST:?set approved SMTP host}',
      GOTRUE_SMTP_PORT: '${ANCHOR_SMTP_PORT:?set approved SMTP port}',
      GOTRUE_SMTP_USER: '${ANCHOR_SMTP_USER:?inject SMTP user}',
      GOTRUE_SMTP_PASS: '${ANCHOR_SMTP_PASS:?inject SMTP password}',
      GOTRUE_SMTP_ADMIN_EMAIL: '${ANCHOR_SMTP_ADMIN_EMAIL:?set approved sender email}',
      GOTRUE_SMTP_SENDER_NAME: '앵커사업단',
      GOTRUE_MAILER_TEMPLATES_RECOVERY: '${ANCHOR_RECOVERY_TEMPLATE_URL:?set reviewed recovery template URL}',
    },
  } } };
}
