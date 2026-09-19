import "server-only";

export function publicSignupEnabled() {
  return process.env.AUTH_SIGNUP_ENABLED === "true";
}

export const PUBLIC_SIGNUP_PENDING =
  "현재 일반 회원가입을 준비하고 있습니다. 초대 메일을 받으셨다면 메일의 계정 설정 링크를 이용해 주세요.";
