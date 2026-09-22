import { isIP } from 'node:net';
import { CLOUD_REQUIRED_CHARACTERS } from './managed-cloud.mjs';

export const REQUIRED_CHARACTERS = CLOUD_REQUIRED_CHARACTERS;
const REF = /^[a-z0-9]{20}$/;
const MAX_BYTES = 1024 * 1024;
const item = (id, pass, message) => ({ id, status: pass ? 'PASS' : 'BLOCK', message });

export function validSiteOrigin(value) {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.origin === value && !u.port && u.hostname.includes('.') &&
      !isIP(u.hostname.replace(/^\[|\]$/g, '')) && !/(^|\.)(local|localhost|internal|invalid|test|example)$/.test(u.hostname) &&
      !/(^|\.)example\.(com|net|org)$/.test(u.hostname);
  } catch { return false; }
}

export function validPreviewTarget(previewRef, productionRef, siteOrigin) {
  return typeof previewRef === 'string' && REF.test(previewRef) && typeof productionRef === 'string' &&
    REF.test(productionRef) && previewRef !== productionRef && validSiteOrigin(siteOrigin);
}

export function inspectHostedAuth(input, siteOrigin) {
  const validObject = input && typeof input === 'object' && !Array.isArray(input);
  const config = validObject ? input : {};
  const checks = [
    item('config-object', !!validObject, 'Auth 설정 JSON 객체가 필요합니다.'),
    item('site-origin', validSiteOrigin(siteOrigin) && config.site_url === siteOrigin, '지정한 Preview HTTPS origin과 Site URL이 같아야 합니다.'),
    item('password-length', config.password_min_length === 12, 'native 최소 길이는 확정된 12자여야 합니다.'),
    item('password-characters', config.password_required_characters === REQUIRED_CHARACTERS, '관리형 기본 규칙인 소문자·대문자·숫자·특수문자 각각 필수를 확인합니다.'),
    item('email-confirmation', config.external_email_enabled === true && config.mailer_autoconfirm === false, '이메일 인증 로그인과 가입 이메일 확인이 필요합니다.'),
    item('recovery-expiry', config.mailer_otp_exp === 900, '복구 증명 유효기간은 15분이어야 합니다.'),
    item('smtp-host', typeof config.smtp_host === 'string' && !!config.smtp_host.trim() && !/localhost|example|replace|placeholder/i.test(config.smtp_host), '승인 SMTP 설정이 필요합니다. 비밀값과 실제 발송은 검사하지 않습니다.'),
    item('email-cooldown', Number.isInteger(config.smtp_max_frequency) && config.smtp_max_frequency >= 60, 'native 메일 재발송 간격은 최소 60초여야 합니다.'),
    item('native-captcha', config.security_captcha_enabled === true && config.security_captcha_provider === 'turnstile', 'native Turnstile CAPTCHA 활성화가 필요합니다. 키 유효성은 별도입니다.'),
    item('totp', config.mfa_totp_enroll_enabled === true && config.mfa_totp_verify_enabled === true, 'native TOTP 등록·검증을 모두 켜야 합니다.'),
  ];
  const blocked = checks.filter(c => c.status === 'BLOCK').length;
  return {
    status: blocked ? 'CONFIG_BLOCKED' : 'CONFIG_MATCH_RUNTIME_PENDING', blocked, checks,
    pending: [
      '비밀번호 변경 후 이전 세션의 업무 접근 차단',
      'native TOTP 및 역할별 DB 접근 검증',
      '실제 native 비밀번호 허용/거부·복구·구세션 차단·MFA 우회 시험',
      '실제 SMTP/CAPTCHA 및 대상별 접근권한 검증',
    ],
    notice: '설정 비교만 수행했습니다. hosted 호환성·안전성·게시 승인을 판정하지 않습니다.',
  };
}

export async function readLiveAuthConfig({ previewRef, productionRef, siteOrigin, token }, fetchImpl = fetch) {
  if (!validPreviewTarget(previewRef, productionRef, siteOrigin) || typeof token !== 'string' ||
      !token.trim() || /\s/.test(token) || token.length > 8192) throw new Error('PREFLIGHT_INPUT');
  try {
    const response = await fetchImpl(`https://api.supabase.com/v1/projects/${previewRef}/config/auth`, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!response.ok || !response.body || Number(response.headers.get('content-length')) > MAX_BYTES) {
      await response.body?.cancel(); throw new Error('RESPONSE');
    }
    const reader = response.body.getReader();
    const chunks = []; let bytes = 0;
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > MAX_BYTES) { await reader.cancel(); throw new Error('SIZE'); }
        chunks.push(Buffer.from(part.value));
      }
    } finally { reader.releaseLock(); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { throw new Error('PREFLIGHT_READ_FAILED'); }
}
