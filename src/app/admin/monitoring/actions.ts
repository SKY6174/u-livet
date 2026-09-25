"use server";

import { revalidatePath } from "next/cache";
import { requireIdentity } from "@/lib/auth/session";
import { ANCHOR_ORG_ID, type MonitoringPlan, type NextYearDecision } from "@/lib/course-monitoring/model";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const DATE_FIELDS = [
  "preparation_due_on", "preparation_done_on", "operation_plan_due_on", "operation_plan_done_on",
  "recruitment_due_on", "recruitment_done_on", "delivery_starts_on", "delivery_ends_on",
  "check_due_on", "check_done_on", "act_due_on", "act_done_on",
  "self_evaluation_first_on", "self_evaluation_second_on", "business_evaluation_on",
] as const;
const DECISIONS: NextYearDecision[] = ["UNDECIDED", "CONTINUE", "REVISE", "STOP"];

export async function saveMonitoringPlan(input: {
  guideId: string;
  revision: number;
  dates: Record<(typeof DATE_FIELDS)[number], string>;
  blocked: boolean;
  issueNote: string;
  actionNote: string;
  nextYearDecision: NextYearDecision;
  selfEvaluationTargetCount: 1 | 2;
}): Promise<{ ok: true; plan: MonitoringPlan } | { ok: false; error: string }> {
  const me = await requireIdentity("/admin/monitoring");
  if (!me.roles.some((role) => role.role === "COURSE_MANAGER" && role.org_id === ANCHOR_ORG_ID))
    return { ok: false, error: "과정 담당자 권한이 없습니다." };
  if (!input || typeof input !== "object" || !input.dates || typeof input.dates !== "object" ||
      typeof input.guideId !== "string" || !/^2026-[a-z0-9-]{1,80}$/.test(input.guideId) ||
      !Number.isInteger(input.revision) || input.revision < 0 || typeof input.blocked !== "boolean" ||
      typeof input.issueNote !== "string" || typeof input.actionNote !== "string" ||
      !DECISIONS.includes(input.nextYearDecision) || ![1, 2].includes(input.selfEvaluationTargetCount))
    return { ok: false, error: "저장할 과정 정보를 확인해 주세요." };

  const dates: Record<string, string | null> = {};
  for (const field of DATE_FIELDS) {
    const value = input.dates[field] ?? "";
    if (typeof value !== "string" || (value && (!/^20\d{2}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value ||
      value < "2026-01-01" || value > "2027-02-28")))
      return { ok: false, error: "날짜 형식을 확인해 주세요." };
    dates[field] = value || null;
  }
  const issueNote = input.issueNote.trim();
  const actionNote = input.actionNote.trim();
  if (issueNote.length > 1000 || actionNote.length > 2000 || (input.blocked && !issueNote))
    return { ok: false, error: "애로 사유와 조치 내용을 확인해 주세요." };
  if (dates.act_done_on && (input.nextYearDecision === "UNDECIDED" || !actionNote))
    return { ok: false, error: "A 완료 시 차년도 과정운영 판단과 반영 내용을 입력해 주세요." };
  if (dates.self_evaluation_second_on &&
      (input.selfEvaluationTargetCount !== 2 || !dates.self_evaluation_first_on ||
        dates.self_evaluation_first_on > dates.self_evaluation_second_on))
    return { ok: false, error: "자체평가 2회차 날짜와 목표 횟수를 확인해 주세요." };
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  if ([dates.self_evaluation_first_on, dates.self_evaluation_second_on, dates.business_evaluation_on]
    .some((date) => date && date > today))
    return { ok: false, error: "평가회 수행일에는 미래 날짜를 입력할 수 없습니다." };
  try {
    const { data, error } = await (await createServerSupabaseClient()).rpc("life_save_monitoring_plan_v3", {
      o: ANCHOR_ORG_ID,
      g: input.guideId,
      p: { ...dates, plan_due_on: dates.recruitment_due_on, plan_done_on: dates.recruitment_done_on,
        next_year_decision: input.nextYearDecision,
        self_evaluation_target_count: input.selfEvaluationTargetCount,
        blocked: input.blocked, issue_note: issueNote, action_note: actionNote },
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
