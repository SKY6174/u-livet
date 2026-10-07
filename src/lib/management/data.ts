import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/workspace-navigation";
import { UUID } from "@/lib/portal/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const APPLICATION_STATUSES = ["SUBMITTED", "WAITLISTED", "ACCEPTED", "PENDING_PAYMENT", "REJECTED", "CANCELLED", "EXPIRED"];
export type ManagedApplication = {
  id: string; person_id: string; name: string; active: boolean;
  offering_id: string; course_name: string; status: string;
  submitted_at: string; enrollment_status: string | null;
};
export type ApplicationDetail = {
  application: ManagedApplication;
  contact: { email: string | null; phone: string | null };
  history: { id: number; previous_status: string | null; next_status: string; reason: string; created_at: string; actor_name: string | null }[];
};
export type ManagedLearner = { id: string; name: string; active: boolean; applications: number; enrollments: number };
export type LearnerDetail = { id: string; name: string; active: boolean; email: string | null; phone: string | null; applications: ManagedApplication[] };
export type ManagementBoard<T> = { items: T[]; count: number; courses: { id: string; name: string }[] };
export type Filters = { course: string; q: string; status: string; page: number };

export async function requireManager(path: string) {
  const me = await requireIdentity(path);
  if (!hasRole(me, "COURSE_MANAGER")) notFound();
  return me;
}
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (await createServerSupabaseClient()).rpc(name, args);
  if (error?.message === "FORBIDDEN" || error?.message === "NOT_FOUND") notFound();
  if (error || data === null) throw new Error("관리 내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
  return data as T;
}
export function managementFilters(query: Record<string, string | string[] | undefined>): Filters {
  const one = (key: string) => typeof query[key] === "string" ? query[key] as string : "";
  const course = one("course"); const q = one("q").trim(); const status = one("status");
  const page = one("page") ? Number(one("page")) : 1;
  if ((course && !UUID.test(course)) || q.length > 100 || (status && !APPLICATION_STATUSES.includes(status)) || !Number.isInteger(page) || page < 1 || page > 100000) notFound();
  return { course, q, status, page };
}
export async function getManagementBoard(kind: "applications" | "learners", filters: Filters) {
  await requireManager(`/admin/${kind}`);
  const args = { f: filters.course || null, q: filters.q, page: filters.page };
  return kind === "applications"
    ? rpc<ManagementBoard<ManagedApplication>>("life_management_applications", { ...args, s: filters.status })
    : rpc<ManagementBoard<ManagedLearner>>("life_management_learners", args);
}
export async function getApplicationDetail(id: string) {
  if (!UUID.test(id)) notFound();
  await requireIdentity();
  return rpc<ApplicationDetail>("life_application_detail", { a: id });
}
export async function getLearnerDetail(id: string) {
  if (!UUID.test(id)) notFound();
  await requireManager(`/admin/learners/${id}`);
  return rpc<LearnerDetail>("life_management_learner", { p: id });
}
