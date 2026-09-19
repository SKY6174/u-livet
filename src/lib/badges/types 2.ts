export type BadgePolicy = {
  id: string;
  org_id?: string;
  title: string;
  version: string;
  body: string;
};
export type BadgeOptions = {
  offerings: { id: string; org_id: string; name: string; manager: boolean }[];
  issuers: {
    id: string;
    org_id: string;
    name: string;
    test_only: boolean;
    can_issue: boolean;
  }[];
  policies: BadgePolicy[];
};
export type BadgeDefinition = {
  id: string;
  offering_id: string;
  version: number;
  issuer_id: string;
  policy_id: string;
  title: string;
  description: string;
  achievement: string;
  validity_days: number | null;
  status: string;
  created_by: string;
  revoked_at: string | null;
  approval_reference: string | null;
  can_issue: boolean;
  ready: boolean;
  policy_body: string;
  policy_title: string;
  policy_version: string;
  completion_body: string;
  completion_version: string;
};
export type BadgeRequest = {
  id: string;
  offering_id: string;
  definition_id: string;
  person_id: string;
  title: string;
  name?: string;
  version?: number;
  person_name?: string;
  status: string;
  reason: string;
  decision_reason: string | null;
  requested_at: string;
  supersedes_id: string | null;
  award_id?: string | null;
  ready?: boolean;
  can_issue?: boolean;
};
export type BadgeSummary = {
  id: string;
  offering_id: string;
  number: string;
  title: string;
  name: string;
  person_name?: string;
  state: string;
  status?: string;
  issued_at: string;
  expires_at: string | null;
  supersedes_id: string | null;
  test_only: boolean;
  can_issue?: boolean;
};
export type BadgeBoard = {
  offering: { id: string; name: string; org_id: string };
  manager: boolean;
  definitions: BadgeDefinition[];
  requests: BadgeRequest[];
  awards: BadgeSummary[];
};
export type BadgeEligible = {
  id: string;
  offering_id: string;
  name: string;
  title: string;
  description: string;
  achievement: string;
  version: number;
  validity_days: number | null;
  policy_id: string;
  policy_title: string;
  policy_version: string;
  policy_body: string;
  completion_body: string;
  ready: boolean;
};
export type BadgeWallet = {
  eligible: BadgeEligible[];
  requests: BadgeRequest[];
  awards: BadgeSummary[];
};
export type BadgeArtifact = {
  format: string;
  number: string;
  badge: {
    title: string;
    description: string;
    achievement: string;
    definition_version: number;
  };
  issuer: {
    organization: string;
    title: string;
    holder_name: string;
    test_only: boolean;
  };
  recipient_name: string;
  course: { name: string; starts_on: string; ends_on: string };
  completion: {
    approved_at: string;
    policy_version: string;
    policy_body: string;
  };
  issued_at: string;
  expires_at: string | null;
  verification_note: string;
};
export type BadgeDetail = {
  id: string;
  number: string;
  state: string;
  artifact: BadgeArtifact;
  sha256: string;
  issued_at: string;
  expires_at: string | null;
  supersedes_id: string | null;
  revocation_reason: string | null;
  owner: boolean;
  share: {
    enabled: boolean;
    revision: number;
    policy_valid: boolean;
    changed_at: string;
  } | null;
  share_policies: BadgePolicy[];
  events: { action: string; reason: string | null; at: string }[];
};
export type BadgeVerification = {
  state: string;
  number?: string;
  title?: string;
  achievement?: string;
  organization?: string;
  name?: string;
  course?: string;
  issued_at?: string;
  expires_at?: string | null;
  sha256?: string;
  test_only?: boolean;
};
export const badgeLabels: Record<string, string> = {
  DRAFT: "정의 초안",
  APPROVED: "정의 승인",
  REQUESTED: "발급 검토 대기",
  CANCELLED: "신청 철회",
  REJECTED: "반려",
  ISSUED: "유효한 발급",
  REVOKED: "발급 취소",
  SUPERSEDED: "새 배지로 대체됨",
  EXPIRED: "유효기간 만료",
  STALE: "수료 근거 재검토 필요",
  NOT_FOUND: "공개된 기록을 확인할 수 없음",
  RATE_LIMITED: "잠시 후 다시 확인해 주세요",
  UNAVAILABLE: "연결 상태를 확인해 주세요",
  BADGE_REQUESTED: "발급 신청",
  REQUEST_CANCELLED: "신청 철회",
  REQUEST_REJECTED: "신청 반려",
  DEFINITION_DRAFTED: "정의 초안 등록",
  DEFINITION_APPROVED: "정의 승인",
  DEFINITION_REVOKED: "정의 철회",
  BADGE_ISSUED: "배지 발급",
  BADGE_REVOKED: "배지 취소",
  BADGE_SUPERSEDED: "정정 배지 발급",
  BADGE_DOWNLOADED: "원본 다운로드",
  SHARE_CREATED: "공유 링크 생성·교체",
  SHARE_WITHDRAWN: "공유 철회",
};
export const badgeLabel = (v: string) => badgeLabels[v] ?? v;
