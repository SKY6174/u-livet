import "server-only";

export function authEmailEnabled() {
  return process.env.AUTH_PROFILE !== "managed-cloud-v1" || process.env.AUTH_EMAIL_ENABLED === "true";
}

export const AUTH_EMAIL_PENDING =
  "현재 이메일 인증을 이용할 수 없어 이메일 회원가입과 비밀번호 재설정을 진행할 수 없습니다. 계정 이용은 사업단에 문의해 주세요.";
