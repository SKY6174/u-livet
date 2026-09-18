import "server-only";

export function authEmailEnabled() {
  return process.env.AUTH_PROFILE !== "managed-cloud-v1" || process.env.AUTH_EMAIL_ENABLED === "true";
}

export const AUTH_EMAIL_PENDING =
  "이메일 인증 서비스 준비 중으로 회원가입과 비밀번호 재설정은 아직 이용할 수 없습니다. 계정 이용은 사업단에 문의해 주세요.";
