export type CertificateKind = "COMPLETION" | "TEACHING";
export const kindLabel: Record<string, string> = {
  COMPLETION: "이수증",
  TEACHING: "강의경력증명서",
};
export const certificateState: Record<string, string> = {
  REQUESTED: "승인 대기",
  GENERATING: "PDF 생성 대기",
  ISSUED: "발급 완료",
  REVOKED: "취소됨",
  SUPERSEDED: "정정본으로 대체됨",
  STALE: "근거 변경 · 재검토 필요",
  NOT_FOUND: "확인할 수 없음",
  RATE_LIMITED: "잠시 후 다시 확인",
};
export type TeachingRecord = {
  id: string;
  session_id: string;
  offering_id: string;
  course_name: string;
  session_title: string;
  starts_at: string;
  ends_at: string;
  person_id: string;
  person_name: string;
  minutes: number;
  notes: string;
  revision: number;
  approved_at: string | null;
  current: boolean | null;
};
export type CertificateRequest = {
  id: string;
  org_id: string;
  evidence: {
    evidence: {
      minutes: number | null;
      logs?: { title: string; minutes: number }[];
    };
  } | null;
  offering_id: string;
  person_id: string;
  person_name: string;
  course_name: string;
  kind: CertificateKind;
  status: string;
  reason: string;
  requested_at: string;
  issue_id: string | null;
  number: string | null;
  state: string | null;
  last_error: string | null;
};
export type CertificateOptions = {
  issuers: {
    id: string;
    org_id: string;
    label: string;
    test_only: boolean;
    kinds: CertificateKind[];
  }[];
  templates: {
    id: string;
    org_id: string;
    kind: CertificateKind;
    title: string;
    version: string;
  }[];
};
export type CertificateSnapshot = {
  person_name: string;
  person_id: string;
  offering_id: string;
  course_name: string;
  starts_on: string;
  ends_on: string;
  kind: CertificateKind;
  evidence: {
    minutes: number | null;
    logs?: { title: string; starts_at: string; minutes: number }[];
  };
  issuer: {
    organization_name: string;
    title: string;
    holder_name: string;
    seal_omission_basis: string | null;
    test_only: boolean;
  };
  template: { title: string; body: string; version: string; layout: string };
};
export type CertificateDetail = {
  id: string;
  number: string;
  snapshot: CertificateSnapshot;
  state: string;
  issued_at: string | null;
  sha256: string | null;
  last_error: string | null;
  revocation_reason: string | null;
  request: { offering_id: string; person_id: string; kind: CertificateKind };
};
export type CertificateJob = {
  id: string;
  nonce: string;
  number: string;
  snapshot: CertificateSnapshot;
  issue_date: string;
  token: string;
  seal: string | null;
};
