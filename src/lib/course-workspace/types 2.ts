import type { WorkspaceOffering } from "@/lib/portal/types";
import type { DocumentKind } from "@/lib/reports/types";

export type CourseWorkspace = WorkspaceOffering & {
  academy: string;
  location: string;
  operator: string;
  instructors: number;
  application_pending: number;
  enrolled: number;
  completed: number;
  completion_pending: number;
  scheduled_sessions: number;
  ended_sessions: number;
  education_hours: number;
  attendance_expected: number;
  attendance_recorded: number;
  missing_attendance: number;
  teaching_logs: number;
  teaching_pending: number;
  report_revision: number | null;
  report_updated_at: string | null;
  report_missing: string[];
  document_kinds: DocumentKind[];
  result_file_id: string | null;
  fee_count: number;
  fee_unpaid: number;
  fee_total: number;
  scholarship_count: number;
  scholarship_unpaid: number;
  budget_spent: number;
  source: {
    enrolled: number;
    completed: number;
    hours: number;
    classes: number;
    scholarship_amount: number;
  } | null;
};
export type DocumentReadiness = {
  kind: DocumentKind;
  title: string;
  owner: string;
  label: string;
  detail: string;
  href: string;
  tone: "ready" | "attention" | "empty" | "source";
};
