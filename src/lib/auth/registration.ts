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
  if (typeof value !== "string" || !/^\/(?!\/)[a-zA-Z0-9/_?=&%.-]*$/.test(value)) return "/";
  // Decode only the path to reject encoded slash/backslash and dot-segment redirects.
  try {
    const path = decodeURIComponent(value.split("?")[0]);
    if (path.startsWith("//") || path.includes("\\") || /[\r\n\u0000]/.test(path) || path.split("/").some(p => p === "." || p === "..") || /^\/auth(?:\/|$)/.test(path)) return "/";
    return value;
  } catch { return "/"; }
}
/** QR context selects the login UI only; attendance permissions stay server-side. */
export function qrCheckinReturnTo(value: unknown): string | null {
  const target = socialReturnTo(value);
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  if (!new RegExp(`^/learning/${uuid}/attendance/checkin\\?`, "i").test(target)) return null;
  const params = new URL(target, "https://local.invalid").searchParams;
  if (Array.from(params).length !== 2 || !new RegExp(`^${uuid}$`, "i").test(params.get("session") ?? "")
    || !/^[0-9a-f]{64}$/.test(params.get("t") ?? "")) return null;
  return target;
}
export function socialLoginRetry(next: unknown, error: string): string {
  const target = qrCheckinReturnTo(next);
  return `/auth/login?social_error=${encodeURIComponent(error)}${target ? `&next=${encodeURIComponent(target)}` : ""}`;
}
export function socialLoginError(value: unknown) {
  switch (value) {
    case "email-verification": return "이메일 확인이 필요합니다. 간편 로그인 계정에 등록된 이메일로 보낸 인증 메일에서 확인을 마친 뒤, 간편 로그인을 다시 진행해 주세요. 메일이 없으면 스팸함도 확인해 주세요.";
    case "cancelled": return "간편 로그인이 취소되었습니다. 원하실 때 다시 시작해 주세요.";
    case "staff": return "사업단·교내 강사 계정은 이메일과 비밀번호로 로그인해 주세요. 교외 강사는 사업단에 강사 구분 확인을 요청해 주세요.";
    case "closed": return "현재 신규 회원가입을 준비하고 있습니다. 잠시 후 다시 이용해 주세요.";
    case "unavailable": return "계정 이용 상태를 확인하지 못했습니다. 사업단에 문의해 주세요.";
    case "callback": return "간편 로그인을 완료하지 못했습니다. 다시 시도해 주세요.";
    default: return null;
  }
}
