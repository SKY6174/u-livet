export type ClassSession = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  replaces_id: string | null;
  reason: string;
};
export type Attendance = {
  session_id: string;
  person_id: string;
  credited_minutes: number;
  reason: string;
  revision: number;
  recorded_at: string;
};
export type Question = { text: string; options: string[] };
export type Quiz = {
  id: string;
  title: string;
  opens_at: string;
  closes_at: string;
  duration_minutes: number;
};
export type Attempt = {
  id: string;
  quiz_id: string;
  person_id: string;
  expires_at: string;
  status: string;
  questions: Question[];
  answers: (number | null)[];
  score: number | null;
};
export type ExamRoom = { quizzes: Quiz[]; attempts: Attempt[] };
export type CompletionRule = {
  policy_id: string;
  attendance_percent: number | null;
  assignment_min: number | null;
  quiz_min: number | null;
  created_by: string;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
};
export type CompletionRun = {
  id: string;
  input_revision: number;
  outcome: string;
  reasons: string[];
  calculated_by: string;
  calculated_at: string;
  evidence: {
    attendance_percent: number | null;
    sessions: {
      session_id: string;
      title: string;
      minutes: number;
      credited_minutes: number | null;
    }[];
    assignments: {
      assignment_id: string;
      title: string;
      revision: number | null;
      score: number | null;
    }[];
    quizzes: {
      quiz_id: string;
      title: string;
      status: string | null;
      score: number | null;
    }[];
  };
};
export type CompletionRow = {
  person_id: string;
  name: string;
  enrollment_status: string;
  run: CompletionRun | null;
  approval: { approved_at: string } | null;
  stale: boolean;
  attendance_percent?: number | null;
  attendance_threshold?: number;
  attendance_complete?: boolean;
  attendance_eligible?: boolean;
  refund?: { status: string; requested_at: string } | null;
  refund_document?: { status: string; submitted_at: string } | null;
};
export type HistoryRow = {
  offering_id: string;
  name: string;
  outcome: string | null;
  reasons: string[] | null;
  calculated_at: string | null;
  approved_at: string | null;
  stale: boolean;
};
export const outcomeLabels: Record<string, string> = {
  READY: "수료 승인 대기",
  INELIGIBLE: "기준 미달",
  NEEDS_REVIEW: "검토 필요",
};
