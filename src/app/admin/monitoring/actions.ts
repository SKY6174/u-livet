"use server";

import { revalidatePath } from "next/cache";
import { requireIdentity } from "@/lib/auth/session";
import { ANCHOR_ORG_ID, type MonitoringPlan } from "@/lib/course-monitoring/model";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const DATE_FIELDS = [
  "plan_due_on", "plan_done_on", "delivery_starts_on", "delivery_ends_on",
  "check_due_on", "check_done_on", "act_due_on", "act_done_on",
] as const;

export async function saveMonitoringPlan(input: {
  guideId: string;
  revision: number;
  dates: Record<(typeof DATE_FIELDS)[number], string>;
  blocked: boolean;
  issueNote: string;
  actionNote: string;
}): Promise<{ ok: true; plan: MonitoringPlan } | { ok: false; error: string }> {
  const me = await requireIdentity("/admin/monitoring");
  if (!me.roles.some((role) => role.role === "COURSE_MANAGER" && role.org_id === ANCHOR_ORG_ID))
    return { ok: false, error: "과정 담당자 권한이 없습니다." };
  if (!input || typeof input !== "object" || !input.dates || typeof input.dates !== "object" ||
      typeof input.guideId !== "string" || !/^2026-[a-z0-9-]{1,80}$/.test(input.guideId) ||
      !Number.isInteger(input.revision) || input.revision < 0 || typeof input.blocked !== "boolean" ||
      typeof input.issueNote !== "string" || typeof input.actionNote !== "string")
    return { ok: false, error: "저장할 과정 정보를 확인해 주세요." };

  const dates: Record<string, string | null> = {};
  for (const field of DATE_FIELDS) {
    const value = input.dates[field] ?? "";
    if (typeof value !== "string" || (value && (!/^20\d{2}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)))
      return { ok: false, error: "날짜 형식을 확인해 주세요." };
    dates[field] = value || null;
  }
  const issueNote = input.issueNote.trim();
  const actionNote = input.actionNote.trim();
  if (issueNote.length > 1000 || actionNote.length > 2000 || (input.blocked && !issueNote))
    return { ok: false, error: "애로 사유와 조치 내용을 확인해 주세요." };
  try {
    const { data, error } = await (await createServerSupabaseClient()).rpc("life_save_monitoring_plan", {
      o: ANCHOR_ORG_ID,
      g: input.guideId,
      p: { ...dates, blocked: input.blocked, issue_note: issueNote, action_note: actionNote },
      expected_revision: input.revision,
    });
    if (error || !data || typeof data !== "object")
      return { ok: false, error: error?.message?.includes("STALE_PLAN")
        ? "다른 곳에서 계획이 변경되었습니다. 화면을 새로고침한 뒤 다시 저장해 주세요."
        : "저장하지 못했습니다. 날짜 순서와 권한을 확인해 주세요." };
    revalidatePath("/admin/monitoring");
    return { ok: true, plan: data as MonitoringPlan };
  } catch {
    return { ok: false, error: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
}
