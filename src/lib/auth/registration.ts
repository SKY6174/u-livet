/** Display formatting only: invalid or oversized input stays available for validation. */
export function formatMobilePhone(value: string): string {
  const compact = value.trim().replace(/[\s()-]/g, "");
  const digits = compact.startsWith("+82") ? `0${compact.slice(3).replace(/^0/, "")}` : compact;
  if (!/^\d{0,11}$/.test(digits)) return value;
  if (digits.length <= 3) return digits;

  const middleLength = digits.startsWith("010") || digits.length === 11 ? 4 : 3;
  const middleEnd = 3 + middleLength;
  return [digits.slice(0, 3), digits.slice(3, middleEnd), digits.slice(middleEnd)].filter(Boolean).join("-");
}

/** Normalization is formatting only: it does not verify ownership of a number. */
export function normalizeMobilePhone(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 30) return null;
  const compact = value.trim().replace(/[\s-]/g, "");
  const normalized = compact.startsWith("0") ? `+82${compact.slice(1)}` : compact;
  return /^\+82(10[0-9]{8}|1[16789][0-9]{7,8})$/.test(normalized) ? normalized : null;
}

export const MOBILE_GUIDANCE = "휴대폰 번호를 확인해 주세요. 예: 010-1234-5678";
export const MOBILE_NOTICE = "현재 휴대폰 인증은 진행하지 않습니다. 입력한 번호는 미인증 연락처로 저장됩니다.";
export type RegistrationState = "SIGNED_OUT" | "EMAIL_LOGIN_REQUIRED" | "UNAVAILABLE" | "COMPLETE" | "CLOSED" | "PENDING";

export function socialReturnTo(value: unknown): string {
  if (typeof value !== "string" || !/^\/(?!\/)[a-zA-Z0-9/_?=&%.-]*$/.test(value)) return "/mypage";
  // Decode only the path to reject encoded slash/backslash and dot-segment redirects.
  try {
    const path = decodeURIComponent(value.split("?")[0]);
    if (path.startsWith("//") || path.includes("\\") || /[\r\n\u0000]/.test(path) || path.split("/").some(p => p === "." || p === "..") || /^\/auth(?:\/|$)/.test(path)) return "/mypage";
    return value;
  } catch { return "/mypage"; }
}
export function socialLoginError(value: unknown) {
  switch (value) {
    case "cancelled": return "카카오 로그인이 취소되었습니다. 원하실 때 다시 시작해 주세요.";
    case "staff": return "강사·운영자·관리자 계정은 이메일과 비밀번호로 로그인해 주세요.";
    case "closed": return "현재 신규 회원가입을 준비하고 있습니다. 잠시 후 다시 이용해 주세요.";
    case "unavailable": return "계정 이용 상태를 확인하지 못했습니다. 사업단에 문의해 주세요.";
    case "callback": return "카카오 로그인을 완료하지 못했습니다. 이 화면에서 다시 시작해 주세요.";
    default: return null;
  }
}
