export type InstructorPolicy = {
  id: string;
  org_id: string;
  kind: string;
  title: string;
  version: string;
  body: string;
};
export type InstructorOptions = {
  organizations: {
    id: string;
    slug: string;
    name: string;
    manager: boolean;
    proposer: boolean;
  }[];
  policies: InstructorPolicy[];
  years: {
    id: string;
    org_id: string;
    label: string;
    starts_on: string;
    ends_on: string;
  }[];
};
export type Claim = {
  kind: string;
  title: string;
  organization: string;
  started_on: string;
  ended_on: string;
  expires_on: string;
  evidence: string;
};
export type DossierPayload = {
  specialty: string;
  introduction: string;
  public_intro: string;
  claims: Claim[];
};
export type PlanSession = {
  title: string;
  content: string;
  equipment: string;
  assessment: string;
  minutes: number;
  method: string;
};
export type DevelopmentPayload = {
  title: string;
  academy: string;
  summary: string;
  rationale: string;
  target: string;
  outcomes: string;
  prerequisites: string;
  assessment: string;
  materials: string;
  budget: string;
  capacity: number;
  theory_minutes: number;
  practice_minutes: number;
  sessions: PlanSession[];
};
export type ReviewVersion<T> = {
  id: string;
  version: number;
  revision: number;
  status: string;
  payload: T;
  submitted_at: string | null;
  decision_reason: string | null;
  decided_at: string | null;
  valid_until?: string | null;
  privacy_policy_id?: string;
  review_policy_id?: string;
  development_policy_id?: string;
  completion_policy_id?: string;
  revoked_at?: string | null;
  revocation_reason?: string | null;
  course_version_id?: string | null;
  ready?: boolean;
  notices: { title: string; version: string; body: string }[];
};
export type ReviewEvent = { action: string; reason: string | null; at: string };
export type Dossier = {
  id: string;
  org_id: string;
  person_id: string;
  name: string;
  owner: boolean;
  current: boolean;
  public_enabled: boolean;
  public_policy_id: string | null;
  revision: number;
  versions: ReviewVersion<DossierPayload>[];
  events: ReviewEvent[];
};
export type Development = {
  id: string;
  org_id: string;
  person_id: string;
  project_year_id: string;
  track: string | null;
  kind: string;
  name: string;
  owner: boolean;
  manager: boolean;
  can_write: boolean;
  versions: ReviewVersion<DevelopmentPayload>[];
  events: ReviewEvent[];
  openings: { id: string; name: string; status: string }[];
};
export type DevelopmentBoardData = {
  items: {
    id: string;
    name: string;
    title: string;
    kind: string;
    year_id: string;
    track: string | null;
    status: string;
    version: number;
    revoked_at: string | null;
  }[];
  more: boolean;
  counts: {
    project_year_id: string;
    new_count: number;
    revision_count: number;
  }[];
  courses: { id: string; title: string }[];
};
export const reviewLabels: Record<string, string> = {
  DRAFT: "작성 중",
  SUBMITTED: "심사 대기",
  APPROVED: "승인",
  CHANGES_REQUESTED: "보완 요청",
  REJECTED: "반려",
  WITHDRAWN: "철회",
  NEW: "신규 개발",
  REVISION: "개편",
  EDUCATION: "학력",
  CAREER: "산업 경력",
  TEACHING: "강의 경력",
  QUALIFICATION: "자격",
  THEORY: "이론",
  PRACTICE: "실습",
};
export const eventLabels: Record<string, string> = {
  DOSSIER_DRAFTED: "이력 새 버전 작성",
  DOSSIER_SAVED: "이력 저장",
  DOSSIER_SUBMITTED: "이력 심사 제출",
  DOSSIER_APPROVED: "이력 확인 승인",
  DOSSIER_CHANGES_REQUESTED: "이력 보완 요청",
  DOSSIER_REJECTED: "이력 반려",
  DOSSIER_WITHDRAWN: "이력 제출 철회",
  PUBLIC_ENABLED: "공개 소개 동의",
  PUBLIC_WITHDRAWN: "공개 소개 철회",
  DEVELOPMENT_DRAFTED: "과정 제안 새 버전",
  DEVELOPMENT_SAVED: "과정 제안 저장",
  DEVELOPMENT_SUBMITTED: "과정 심의 제출",
  DEVELOPMENT_APPROVED: "과정 심의 승인",
  DEVELOPMENT_CHANGES_REQUESTED: "과정 보완 요청",
  DEVELOPMENT_REJECTED: "과정 반려",
  DEVELOPMENT_WITHDRAWN: "과정 제안 철회",
  DEVELOPMENT_REVOKED: "과정 승인 취소",
  DEVELOPMENT_OPENED: "승인 과정의 기수 개설",
};
