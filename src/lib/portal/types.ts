import type { OfficePosition } from "@/lib/auth/login-audience";

export type Identity = {
  id: string;
  name: string;
  roles: { role: string; org_id: string }[];
  member_entry_orgs?: { org_id: string; org_name: string; is_super_admin: boolean }[];
  is_super_admin?: boolean;
  office_position?: OfficePosition | null;
  member_group?: "office" | "instructor" | null;
  instructor_kind?: "INTERNAL" | "EXTERNAL" | null;
};
export type Offering = {
  id: string;
  org_id: string;
  project_year_id: string;
  course_version_id: string;
  name: string;
  title: string;
  academy: string;
  summary: string;
  curriculum: string;
  mode: "ONLINE" | "OFFLINE" | "BLENDED";
  location: string;
  capacity: number;
  tuition: number | null;
  selection_method: string | null;
  status: string;
  apply_from: string | null;
  apply_until: string | null;
  starts_on: string;
  ends_on: string;
  year_label: string;
  enrollment_policy_id: string | null;
  completion_policy_id: string | null;
  academic_revision: number;
  academic_sealed: boolean;
};
export type CourseSummary = Pick<
  Offering,
  | "id"
  | "name"
  | "academy"
  | "summary"
  | "mode"
  | "capacity"
  | "tuition"
  | "status"
  | "apply_from"
  | "apply_until"
  | "starts_on"
  | "ends_on"
>;
export type WorkspaceOffering = Pick<
  Offering,
  "id" | "org_id" | "name" | "status" | "capacity" | "year_label" | "starts_on" | "ends_on"
>;
export type CourseIntroduction = CourseSummary & Pick<
  Offering,
  "curriculum" | "location" | "selection_method" | "year_label" | "completion_policy_id"
>;
export type Policy = {
  id: string;
  org_id: string;
  kind: string;
  title: string;
  version: string;
  body: string;
  effective_from: string;
  effective_until: string | null;
};
export type Application = {
  id: string;
  offering_id: string;
  person_id: string;
  status: string;
  submitted_at: string;
};
export type Lesson = {
  id: string;
  offering_id: string;
  title: string;
  content: string;
  position: number;
};
export type Assignment = {
  id: string;
  offering_id: string;
  title: string;
  instructions: string;
  due_at: string;
};
export type Submission = {
  id: string;
  assignment_id: string;
  person_id: string;
  body: string;
  revision: number;
  submitted_at: string;
};
export type Grade = {
  submission_id: string;
  submission_revision: number;
  score: number;
  feedback: string;
};
export type RosterRow = {
  application_id: string;
  person_id: string;
  name: string;
  status: string;
  submitted_at: string;
};
export type ActionState = {
  ok?: boolean;
  message: string;
  retryAfter?: number;
};
