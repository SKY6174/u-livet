export type PerformanceYear = {
  id: string;
  org_id: string;
  label: string;
  starts_on: string;
  ends_on: string;
  org_name?: string;
};
export type SurveySummary = {
  id: string;
  closes_at: string;
  closed: boolean;
  question_version: string;
  min_responses: number;
  invited: number;
  responses: number;
  finalized: boolean;
  released: boolean;
  overall: number | null;
  content: number | null;
  usefulness: number | null;
};
export type QualityReview = {
  id: string;
  revision: number;
  decision: string;
  summary: string;
  created_at: string;
  survey_snapshot: SurveySummary | null;
};
export type PerformanceFacts = {
  query_version: string;
  fingerprint: string;
  totals: Record<string, number | null>;
  offerings: {
    id: string;
    name: string;
    academy: string;
    status: string;
    starts_on: string;
    ends_on: string;
    enrollments: number;
    completions: number;
    survey: SurveySummary | null;
    review: QualityReview | null;
    improvements_open: number;
    improvements_overdue: number;
  }[];
};
export type MetricDefinition = {
  id: string;
  code: string;
  version: number;
  title: string;
  unit: string;
  source: string;
  formula: string;
  target: number;
  population: string;
  dedup_rule: string;
  calculation: string;
  evidence_requirement: string;
  status: string;
  created_by: string;
  approval_reference: string | null;
};
export type MetricRow = {
  definition: MetricDefinition;
  observation: {
    id: string;
    numerator: number;
    denominator: number | null;
    unknown_count: number;
    observed_on: string;
    source_reference: string;
    evidence_reference: string;
    recorded_by: string;
  } | null;
  numerator: number | null;
  denominator: number | null;
  unknown_count: number | null;
  value: number | null;
  blocker: string | null;
};
export type ReportSummary = {
  id: string;
  version: number;
  status: string;
  created_at: string;
  approved_at: string | null;
  reason: string;
  supersedes_id: string | null;
  stale: boolean;
};
export type PerformanceBoard = {
  year: PerformanceYear;
  generated_at: string;
  can_prepare: boolean;
  can_approve: boolean;
  academies: string[];
  facts: PerformanceFacts;
  metrics: MetricRow[];
  reports: ReportSummary[];
};
export type PerformanceReport = ReportSummary & {
  org_id: string;
  year_id: string;
  created_by: string;
  approved_by: string | null;
  approval_reference: string | null;
  fingerprint: string;
  can_approve: boolean;
  snapshot: {
    year: PerformanceYear;
    query_version: string;
    facts: PerformanceFacts;
    metrics: MetricRow[];
  };
  events: { action: string; at: string }[];
};
export type QualityBoard = {
  offering: { id: string; name: string; year_id: string; ends_on: string };
  manager: boolean;
  teacher: boolean;
  survey: SurveySummary | null;
  survey_policies: {
    id: string;
    title: string;
    version: string;
    body: string;
    min_responses: number;
  }[];
  feedback: {
    person_id: string;
    name: string;
    note: string;
    revision: number;
    updated_at: string;
  }[];
  reviews: QualityReview[];
  improvements: {
    id: string;
    owner_id: string;
    owner_name: string;
    plan: string;
    due_on: string;
    status: string;
    revision: number;
    target_name: string | null;
    evidence_reference: string | null;
    verification_note: string | null;
    reported_by: string | null;
  }[];
  owners: { id: string; name: string }[];
  targets: { id: string; name: string }[];
};
export type MySurvey = {
  id: string;
  name: string;
  closes_at: string;
  closed: boolean;
  submitted_at: string | null;
  policy_id: string;
  policy_title: string;
  policy_version: string;
  policy_body: string;
  policy_valid: boolean;
  min_responses: number;
};
export const sourceLabels: Record<string, string> = {
  ENROLLED_PEOPLE: "등록 실인원 (취소 포함)",
  ENROLLMENTS: "수강건수 (취소 포함)",
  COMPLETED_PEOPLE: "최신 확정 수료 실인원",
  COMPLETIONS: "최신 확정 수료건수",
  COMPLETION_RATE: "수료건수 / 전체 등록건수 × 100",
  EXTERNAL: "외부 확인 자료",
};
export const qualityLabels: Record<string, string> = {
  KEEP: "유지",
  REVISE: "개편",
  MERGE: "통합",
  RETIRE: "폐지 검토",
  OPEN: "진행 전",
  REPORTED: "반영 보고",
  VERIFIED: "반영 확인",
  DRAFT: "초안",
  APPROVED: "승인 완료",
  DEFINITION_UNAPPROVED: "지표 정의 승인 필요",
  MISSING_SOURCE: "외부 원자료 미등록",
  UNCONFIRMED_SOURCE: "미확인 자료 확인 필요",
  YEAR_BOUNDARY_REVIEW: "사업연도 귀속 확인 필요",
  COMPLETION_REVIEW: "수료 원자료 재검토 필요",
  NO_DENOMINATOR: "분모 없음 · 산출 불가",
  REPORT_DRAFTED: "보고 초안 생성",
  REPORT_APPROVED: "보고 확정",
};
export const qualityLabel = (v: string) => qualityLabels[v] ?? v;
