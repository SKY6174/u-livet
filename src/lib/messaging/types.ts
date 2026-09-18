export type MessageTemplate = {
  id: string;
  org_id: string;
  title: string;
  kind: string;
  audience: string;
  version: string;
  body: string;
};
export type MessageOptions = {
  offerings: { id: string; org_id: string; name: string }[];
  templates: MessageTemplate[];
};
export type MessageJob = {
  id: string;
  offering_id: string;
  status: string;
  mode: string;
  scheduled_at: string;
  created_at: string;
  expires_at: string;
  body: string;
  name: string;
  title: string;
  version: string;
  kind: string;
  audience: string;
  total: number;
  counts: Record<string, number>;
  exclusions: Record<string, number>;
  samples: { state: string; reason: string; label: string | null }[];
  events: { id: number; action: string; created_at: string }[];
};
export type NotificationPreference = {
  id: string;
  name: string;
  accepted: boolean;
  effective: boolean;
  policy_id: string | null;
  updated_at: string | null;
  contact: { label: string; valid: boolean; until: string } | null;
  policies: { id: string; title: string; version: string; body: string }[];
  events: {
    id: number;
    accepted: boolean;
    recorded_at: string;
    title: string | null;
    version: string | null;
  }[];
};
export const messageLabels: Record<string, string> = {
  OPERATIONS: "운영 안내",
  MARKETING: "홍보",
  APPLICANTS: "유효 신청자",
  ACTIVE: "수강 중",
  PENDING_PAYMENT: "납부 대기",
  COMPLETED: "확정 수료자",
  PREVIEW: "미리보기",
  QUEUED: "예약 대기",
  BLOCKED_CONFIG: "연결 대기 · 미발송",
  CANCELLED: "취소",
  FINISHED: "처리 종료",
  ELIGIBLE: "대상 포함",
  SKIPPED: "제외",
  PROCESSING: "테스트 처리 중",
  UNKNOWN: "결과 확인 필요",
  TEST_PROCESSED: "테스트 완료 · 실제 미발송",
  TEMPLATE_DISABLED: "문안 사용 중지",
  ACCOUNT_INACTIVE: "이용 중지·탈퇴",
  OUTSIDE_AUDIENCE: "대상 조건 불일치",
  NO_VERIFIED_CONTACT: "인증 연락처 없음·만료",
  CONTACT_CHANGED: "연락처 변경",
  NO_MARKETING_CONSENT: "유효한 홍보 동의 없음",
  CONSENT_WITHDRAWN: "홍보 동의 철회",
  CONTACT_DISCONNECTED: "연락처 연결 해제",
  CREATOR_REVOKED: "예약자 권한 만료",
  LEASE_EXPIRED: "처리 결과 확인 필요",
  TEST_ONLY: "가상 처리",
  PREVIEW_CREATED: "미리보기 저장",
  TEST_QUEUED: "테스트 예약 저장",
  CONFIG_BLOCKED: "업체 연결 대기로 저장",
  TEST_CLAIM_CHECKED: "테스트 대상 재검사",
  TEST_SKIPPED: "테스트 처리에서 제외",
};
export const messageLabel = (value: string) => messageLabels[value] ?? value;
