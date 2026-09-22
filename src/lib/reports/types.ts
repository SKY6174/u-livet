import type { Offering } from "@/lib/portal/types";
import type {
  Attendance,
  ClassSession,
  CompletionRow,
} from "@/lib/portal/evaluation";

export const DOCUMENTS = [
  ["result", "결과보고서"],
  ["attendance", "출석부"],
  ["completion", "수료자명단"],
  ["scholarships", "장학금 지급현황"],
  ["teaching", "강사 강의날인부"],
  ["fees", "강사료 지급현황"],
] as const;
export type DocumentKind = (typeof DOCUMENTS)[number][0];
export type BudgetRow = {
  category: string;
  planned: number;
  spent: number;
  note: string;
};
export type ParticipantDetail = {
  personId: string;
  birthDate: string;
  note: string;
};
export type ScholarshipRow = {
  personId: string;
  category: string;
  rate: number;
  amount: number;
  bank: string;
  account: string;
  holder: string;
  paidOn: string;
  note: string;
};
export type FeeRow = {
  name: string;
  kind: string;
  birthDate: string;
  dates: string;
  hours: number;
  rate: number;
  bank: string;
  account: string;
  holder: string;
  paidOn: string;
  note: string;
};
export type SourceReport = {
  filename: string;
  sha256: string;
  enrolled: number;
  completed: number;
  educationHours: number;
  classCount: number;
  scholarshipRecipients: number;
  scholarshipAmount: number;
  notes: string;
};
export type ReportPayload = {
  sourceReport?: SourceReport;
  operator: string;
  professor: string;
  reportDate: string;
  program: string;
  content: string;
  method: string;
  education: string;
  promotion: string;
  other: string;
  strengths: string;
  improvements: string;
  followUp: string;
  certificates: number | null;
  employed: number | null;
  surveyResponses: number | null;
  satisfaction: number | null;
  budgets: BudgetRow[];
  participants: ParticipantDetail[];
  scholarships: ScholarshipRow[];
  fees: FeeRow[];
};
export type ReportRecord = {
  payload: ReportPayload;
  revision: number;
  updated_at: string;
};
export type TeachingLog = {
  id: string;
  session_id: string;
  person_id: string;
  name: string;
  minutes: number;
  topic: string;
  confirmed_at: string;
  revision: number;
  current: boolean;
  segments?: { starts_at: string; ends_at: string }[];
  signature?: string | null;
  signed_at?: string | null;
  signed_revision?: number | null;
};
export type ReportFile = {
  id: string;
  kind: DocumentKind | "photo";
  filename: string;
  mime: string;
  size: number;
  caption: string;
  created_at: string;
};
export type ReportBundle = {
  report: ReportRecord | null;
  members: CompletionRow[];
  sessions: ClassSession[];
  attendance: Attendance[];
  teaching: TeachingLog[];
  files: ReportFile[];
};
export function emptyReport(offering: Offering): ReportPayload {
  return {
    operator: "이연향 연구원",
    professor: "",
    reportDate: "",
    program: offering.academy,
    content: offering.summary,
    method: "",
    education: offering.curriculum,
    promotion: "",
    other: "",
    strengths: "",
    improvements: "",
    followUp: "",
    certificates: null,
    employed: null,
    surveyResponses: null,
    satisfaction: null,
    budgets: [],
    participants: [],
    scholarships: [],
    fees: [],
  };
}
export const money = (value: number | null) => value === null ? "미기재" : value.toLocaleString("ko-KR");
export const feeAmount = (row: FeeRow) =>
  Math.floor((Math.round(row.hours * 100) * row.rate) / 100);
export const isCompleted = (m: CompletionRow) =>
  m.enrollment_status === "ACTIVE" &&
  !m.stale &&
  m.run?.outcome === "READY" &&
  !!m.approval;
export function attendanceSummary(bundle: ReportBundle, person: string) {
  const sessions = bundle.sessions.filter((s) => s.status === "SCHEDULED");
  const total = sessions.reduce(
    (n, s) => n + (Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 60000,
    0,
  );
  const records = bundle.attendance.filter(
    (a) =>
      a.person_id === person && sessions.some((s) => s.id === a.session_id),
  );
  const credited = records.reduce((n, a) => n + Number(a.credited_minutes), 0);
  return {
    total,
    credited,
    missing: sessions.length - records.length,
    percent: total ? (credited / total) * 100 : null,
  };
}
export const hours = (minutes: number) => Number((minutes / 60).toFixed(2));
export const maskAccount = (account: string, reveal: boolean) =>
  !account
    ? "—"
    : reveal
      ? account
      : `**** ${account.replace(/[^0-9]/g, "").slice(-4)}`;
