import type { ClassSession } from "@/lib/portal/evaluation";
export type LearningSession = ClassSession & {
  credited_minutes: number | null;
};
export type LearningCourse = {
  application_id: string;
  id: string;
  course_id: string;
  name: string;
  academy: string;
  status: string;
  submitted_at: string;
  active: boolean;
  mode: "ONLINE" | "OFFLINE" | "BLENDED";
  location: string;
  starts_on: string;
  ends_on: string;
  instructors: string[];
  completion: {
    title: string;
    version: string;
    body: string;
    attendance_percent: number | null;
    assignment_min: number | null;
    quiz_min: number | null;
  } | null;
  sessions: LearningSession[];
  lessons: { id: string; title: string; position: number; read: boolean }[];
};
export type LearningRequest = {
  id: string;
  org_id: string;
  title: string;
  goal: string;
  preferred_schedule: string;
  status: "SUBMITTED" | "REVIEWING" | "PLANNED" | "NOT_PLANNED";
  response: string;
  created_at: string;
  updated_at: string;
};
export type LearningHub = {
  courses: LearningCourse[];
  scholarships: {
    offering_id: string;
    name: string;
    category: string;
    amount: number;
    paid_on: string;
  }[];
  organizations: { id: string; name: string }[];
  requests: LearningRequest[];
};
