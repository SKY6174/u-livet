import type { LearnerDocumentType } from "@/lib/learner-documents/model";

export const DOCUMENT_KIND = {
  application: "APPLICATION",
  scholarship: "SCHOLARSHIP",
  refund: "REFUND",
} as const;

export type LearnerDocumentKind = (typeof DOCUMENT_KIND)[LearnerDocumentType];
export type LearnerDocumentStatus =
  | "RECEIVED"
  | "REVIEWING"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED"
  | "CANCELLED";

export const DOCUMENT_KIND_LABELS: Record<LearnerDocumentKind, string> = {
  APPLICATION: "수강신청원서",
  SCHOLARSHIP: "장학금 지급신청서",
  REFUND: "수강료환불신청서",
};

export const DOCUMENT_STATUS_LABELS: Record<LearnerDocumentStatus, string> = {
  RECEIVED: "접수 완료",
  REVIEWING: "검토 중",
  APPROVED: "승인",
  REJECTED: "반려",
  COMPLETED: "처리 완료",
  CANCELLED: "신청 취소",
};

export const DOCUMENT_STATUS_TONES: Record<LearnerDocumentStatus, string> = {
  RECEIVED: "border-sky-200 bg-sky-50 text-sky-800",
  REVIEWING: "border-amber-200 bg-amber-50 text-amber-800",
  APPROVED: "border-teal-200 bg-teal-50 text-teal-800",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-800",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  CANCELLED: "border-slate-200 bg-slate-100 text-slate-600",
};

export type LearnerDocumentEvent = {
  id: number;
  from_status: LearnerDocumentStatus | null;
  to_status: LearnerDocumentStatus;
  note: string;
  created_at: string;
  actor_name: string | null;
};

export type LearnerDocumentRequest = {
  id: string;
  org_id?: string;
  offering_id: string | null;
  kind: LearnerDocumentKind;
  course_name: string;
  applicant_name: string;
  phone_masked: string;
  refund_occurrence: string | null;
  amount: number | null;
  status: LearnerDocumentStatus;
  current_note: string;
  reviewer_name?: string | null;
  revision: number;
  submitted_at: string;
  updated_at: string;
  resolved_at: string | null;
  events: LearnerDocumentEvent[];
  registration?: LearnerDocumentRegistration;
};

export type LearnerDocumentRegistration = {
  offering_name: string | null;
  offering_status: string | null;
  starts_on: string | null;
  ends_on: string | null;
  application_id: string | null;
  application_status: string | null;
  active: boolean;
  can_manage: boolean;
  can_apply: boolean;
  can_admit: boolean;
};

export type DocumentOfferingChoice = {
  id: string;
  org_id: string;
  name: string;
  status: string;
  starts_on: string;
  ends_on: string;
};

export function documentRegistrationMessage(state: LearnerDocumentRegistration) {
  if (state.active) return "수강 등록 완료 · 내 강의실에서 수업 정보를 확인할 수 있습니다.";
  if (state.application_status === "PENDING_PAYMENT") return "납부 대기 · 납부 완료 후 수강 등록이 확정됩니다.";
  if (state.application_status === "REJECTED") return "수강 신청 미선정 · 원서 승인과 신청 심사 결과가 다릅니다.";
  if (state.application_status === "CANCELLED") return "수강 신청 취소 · 원서 승인 이력은 보관됩니다.";
  if (state.offering_status === "DRAFT") return "모집 준비 중 · 교육·모집 일정과 신청 안내가 확정되면 수강 신청할 수 있습니다.";
  if (state.can_admit) return "수강 신청 접수 완료 · 담당자의 수강 등록 확정이 필요합니다.";
  if (state.application_id) return "수강 등록 대기 · 개설 과정과 신청 상태를 담당자가 확인해야 합니다.";
  if (state.can_apply) return "수강생 신청 필요 · 과정 안내와 신청 동의를 확인해 수강 신청을 완료해 주세요.";
  if (state.offering_name) return "수강 등록 미확인 · 현재 신청 가능한 기간이 아닙니다. 담당자에게 개설 일정을 확인해 주세요.";
  return "과정 연결 필요 · 담당자가 실제 개설 기수를 연결하면 신청·등록 상태를 확인할 수 있습니다.";
}

export type LearnerDocumentEligibility = {
  offering_id: string;
  course_name: string;
  application_approved: boolean;
  completion_approved: boolean;
  refund_allowed: boolean;
  scholarship_allowed: boolean;
};

export type LearnerDocumentAdminContext = {
  organizations: { id: string; name: string }[];
  requests: LearnerDocumentRequest[];
  offerings?: DocumentOfferingChoice[];
};

export const NEXT_DOCUMENT_STATUSES: Partial<
  Record<LearnerDocumentStatus, LearnerDocumentStatus[]>
> = {
  RECEIVED: ["REVIEWING", "APPROVED", "REJECTED"],
  REVIEWING: ["APPROVED", "REJECTED"],
  APPROVED: ["COMPLETED"],
};

export function isOpenLearnerDocument(request: Pick<LearnerDocumentRequest, "kind" | "status">) {
  return request.status === "RECEIVED" || request.status === "REVIEWING" ||
    (request.status === "APPROVED" && request.kind !== "APPLICATION");
}

export function documentDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
