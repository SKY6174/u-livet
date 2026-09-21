export type QrChallenge = { token: string; expires_at: string };
export type QrCheckin = { session_id: string; person_id: string; checked_in_at: string };
export const QR_TOKEN = /^[0-9a-f]{64}$/;
export function qrError(message: string, code?: string) {
  if (code === "PGRST202" || code === "42883") return "QR 출석 기능을 준비 중입니다. 담당 강사에게 출석 확인을 요청해 주세요.";
  return ({
    FORBIDDEN: "현재 배정된 담당 강사만 QR 출석을 관리할 수 있습니다.",
    NOT_ENROLLED: "이 강좌의 수강 확정 계정으로 로그인해 주세요.",
    SELF_APPROVAL_FORBIDDEN: "담당 강사는 본인의 출석을 확인할 수 없습니다.",
    CLASS_NOT_OPEN: "진행 중인 정상 수업에서만 QR 입실을 확인할 수 있습니다.",
    INVALID_QR: "올바른 QR 코드가 아닙니다. 강의실의 QR을 다시 스캔해 주세요.",
    QR_EXPIRED: "QR 코드가 만료되었거나 중지되었습니다. 강의실의 새 QR을 스캔해 주세요.",
    MFA_REAUTH_REQUIRED: "계정 보안 화면에서 추가 인증한 뒤 다시 시도해 주세요.",
  } as Record<string, string>)[message] ?? "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
