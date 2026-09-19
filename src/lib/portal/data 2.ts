import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Offering, Policy } from "./types";
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const modeLabel = { ONLINE: "온라인", OFFLINE: "대면", BLENDED: "혼합" };
export const statusLabel: Record<string, string> = {
  DRAFT: "준비 중",
  PUBLISHED: "모집 공개",
  CLOSED: "모집 종료",
  SUBMITTED: "심사 대기",
  WAITLISTED: "대기 접수",
  PENDING_PAYMENT: "납부 대기",
  ACCEPTED: "수강 확정",
  REJECTED: "미선정",
  CANCELLED: "신청 취소",
  ACTIVE: "수강 중",
  WITHDRAWN: "수강 취소",
};
export function dateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
export async function getPolicies(kind?: string) {
  try {
    let query = (await createServerSupabaseClient())
      .from("life_policy_versions")
      .select(
        "id,org_id,kind,title,version,body,effective_from,effective_until",
      )
      .eq("status", "APPROVED")
      .order("effective_from", { ascending: false });
    if (kind) query = query.eq("kind", kind);
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
