import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CourseIntroduction, CourseSummary, InstructorName, Offering, Policy, WorkspaceOffering } from "./types";
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const modeLabel = { ONLINE: "온라인", OFFLINE: "대면", BLENDED: "혼합" };
export const statusLabel: Record<string, string> = {
  DRAFT: "준비 중",
  PUBLISHED: "모집 공개",
  CLOSED: "모집 종료",
  ARCHIVED: "운영 완료 · 보고서 보관",
  SUBMITTED: "심사 대기",
  WAITLISTED: "대기 접수",
  PENDING_PAYMENT: "납부 대기",
  ACCEPTED: "수강 확정",
  REJECTED: "미선정",
  CANCELLED: "신청 취소",
  ACTIVE: "수강 중",
  WITHDRAWN: "수강 취소",
};
export function dateTime(value: string | null) {
  if (!value) return "미기재";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
export async function getCourseCards(featured = false) {
  try {
    const db = await createServerSupabaseClient();
    let query = (featured
      ? db.from("life_catalog")
      : db.rpc("life_course_introductions", {}, { get: true }))
      .select(
        // PostgREST table-returning RPC ordering needs the sort field selected.
        "id,name,academy,summary,mode,capacity,tuition,status,apply_from,apply_until,starts_on,ends_on,created_at",
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });
    query = featured
      ? query.eq("status", "PUBLISHED").limit(3)
      : query.neq("status", "DRAFT");
    const { data, error } = await query;
    return { offerings: (data ?? []) as CourseSummary[], unavailable: !!error };
  } catch {
    return { offerings: [] as CourseSummary[], unavailable: true };
  }
}
export async function getCourseIntroduction(id: string) {
  if (!UUID.test(id)) return null;
  try {
    const { data, error } = await (await createServerSupabaseClient())
      .rpc("life_course_introductions", { f: id }, { get: true })
      .maybeSingle();
    return error ? null : (data as CourseIntroduction | null);
  } catch {
    return null;
  }
}
export async function getCourseInstructorNames(ids: string[]): Promise<Record<string, InstructorName[]> | null> {
  if (!ids.length) return {};
  if (!ids.every((id) => UUID.test(id))) return null;
  try {
    const { data, error } = await (await createServerSupabaseClient())
      .rpc("life_course_instructor_names", { f: Array.from(new Set(ids)) });
    if (error) return null;
    const names: Record<string, InstructorName[]> = {};
    for (const row of (data ?? []) as (InstructorName & { offering_id: string })[]) {
      (names[row.offering_id] ??= []).push({ name: row.name, responsible: row.responsible });
    }
    return names;
  } catch {
    return null;
  }
}
export async function getOfferings() {
  try {
    const { data, error } = await (
      await createServerSupabaseClient()
    )
      .from("life_catalog")
      .select("*")
      .order("created_at", { ascending: false });
    return { offerings: (data ?? []) as Offering[], unavailable: !!error };
  } catch {
    return { offerings: [] as Offering[], unavailable: true };
  }
}
export async function getWorkspaceOfferings(
  column: "id" | "org_id",
  values: string[],
) {
  const empty = { offerings: [] as WorkspaceOffering[], unavailable: false };
  if (!values.length) return empty;
  if (!values.every((value) => UUID.test(value)))
    return { ...empty, unavailable: true };
  try {
    const { data, error } = await (await createServerSupabaseClient())
      .from("life_catalog")
      .select("id,org_id,name,status,capacity,year_label,starts_on,ends_on")
      .in(column, Array.from(new Set(values)))
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });
    return { offerings: (data ?? []) as WorkspaceOffering[], unavailable: !!error };
  } catch {
    return { ...empty, unavailable: true };
  }
}
export async function getOffering(id: string) {
  if (!UUID.test(id)) return null;
  try {
    const { data, error } = await (
      await createServerSupabaseClient()
    )
      .from("life_catalog")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return error ? null : (data as Offering | null);
  } catch {
    return null;
  }
}
export async function getPolicies(kind?: string, id?: string | null) {
  if (id !== undefined && (!id || !UUID.test(id))) return [];
  try {
    let query = (await createServerSupabaseClient())
      .from("life_policy_versions")
      .select(
        "id,org_id,kind,title,version,body,effective_from,effective_until",
      )
      .eq("status", "APPROVED")
      .order("effective_from", { ascending: false });
    if (kind) query = query.eq("kind", kind);
    if (id) query = query.eq("id", id);
    const { data, error } = await query;
    if (error) return [];
    const now = Date.now();
    return ((data ?? []) as Policy[]).filter(
      (p) =>
        Date.parse(p.effective_from) <= now &&
        (!p.effective_until || Date.parse(p.effective_until) > now),
    );
  } catch {
    return [];
  }
}

export async function getLatestPrivacyPolicy(): Promise<Policy | null> {
  try {
    const now = new Date().toISOString();
    const { data, error } = await (await createServerSupabaseClient())
      .from("life_policy_versions")
      .select("id,org_id,kind,title,version,body,effective_from,effective_until")
      .eq("kind", "ACCOUNT_PRIVACY")
      .eq("status", "APPROVED")
      .lte("effective_from", now)
      .or(`effective_until.is.null,effective_until.gt.${now}`)
      .order("effective_from", { ascending: false })
      .order("approved_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    return error ? null : (data as Policy | null);
  } catch {
    return null;
  }
}
