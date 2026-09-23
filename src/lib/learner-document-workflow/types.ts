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
};

export type LearnerDocumentAdminContext = {
  organizations: { id: string; name: string }[];
  requests: LearnerDocumentRequest[];
};

export const NEXT_DOCUMENT_STATUSES: Partial<
  Record<LearnerDocumentStatus, LearnerDocumentStatus[]>
> = {
  RECEIVED: ["REVIEWING", "APPROVED", "REJECTED"],
  REVIEWING: ["APPROVED", "REJECTED"],
  APPROVED: ["COMPLETED"],
};

export function documentDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
