"use server";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import type { ActionState } from "@/lib/portal/types";
const errorMessages: Record<string, string> = {
  MFA_REAUTH_REQUIRED: MFA_REAUTH_MESSAGE,
  FORBIDDEN: "이 기관·기수의 처리 권한이 없습니다.",
  COURSE_NOT_ENDED: "종강 다음 날부터 평가를 진행할 수 있습니다.",
  APPROVED_SURVEY_POLICY_REQUIRED:
    "승인된 조사 안내문과 공개 기준이 필요합니다.",
  INVALID_SCHEDULE: "마감시각은 현재 이후 90일 이내로 입력해 주세요.",
  SURVEY_ALREADY_EXISTS: "이 기수에는 이미 조사가 개설되었습니다.",
  SURVEY_NOT_CLOSED: "조사 마감 후 결과를 확정할 수 있습니다.",
  SURVEY_CLOSED: "응답기간이 끝났습니다.",
  NOT_INVITED: "이 조사의 참여 대상이 아닙니다.",
  CONSENT_REQUIRED: "유효한 조사 안내문을 확인해 주세요.",
  INVALID_RATING: "모든 문항에 1~5점을 선택해 주세요.",
  REVISION_CHANGED: "다른 변경이 저장되었습니다. 새로고침 후 확인해 주세요.",
  INVALID_OWNER: "현재 담당 기수의 강사 또는 과정담당자를 선택해 주세요.",
  INVALID_DEADLINE: "기한은 오늘부터 2년 이내로 입력해 주세요.",
  INVALID_NEXT_OFFERING:
    "같은 기관에서 원기수 종료 후 시작하는 공개 기수를 선택해 주세요.",
  SELF_APPROVAL_FORBIDDEN:
    "작성·입력·반영 담당자와 승인자는 서로 달라야 합니다.",
  EVIDENCE_REQUIRED: "검토 근거를 입력해 주세요.",
  APPROVED_EXTERNAL_METRIC_REQUIRED:
    "현재 승인된 외부 자료 지표에만 실적을 등록할 수 있습니다.",
  INVALID_OBSERVATION_DATE:
    "사업연도에 포함되고 미래가 아닌 기준일을 입력해 주세요.",
  INVALID_DENOMINATOR:
    "분모와 분자·미확인 인원 범위를 확인해 주세요. 비율 외에는 분모를 비워 주세요.",
  METRICS_REQUIRED: "먼저 보고할 지표 정의를 등록해 주세요.",
  REPORT_NOT_READY: "미승인 정의 또는 미확인 자료가 있어 확정할 수 없습니다.",
  REPORT_SOURCE_CHANGED:
    "원자료가 변경되었습니다. 새 보고 초안을 생성해 주세요.",
  REPORT_PARENT_CHANGED:
    "다른 확정본이 생겼습니다. 최신 확정본을 기준으로 새 초안을 생성해 주세요.",
  IDEMPOTENCY_CONFLICT:
    "같은 요청키의 다른 내용입니다. 저장된 보고를 확인해 주세요.",
  INVALID_TRANSITION: "현재 상태에서는 처리할 수 없습니다.",
};
const value = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
async function run(
  f: FormData,
  rpc: string,
  ids: string[],
  texts: string[] = [],
  numbers: string[] = [],
  extra: Record<string, unknown> = {},
): Promise<{ state: ActionState; data?: unknown }> {
  if (!(await getSessionIdentity()))
    return { state: { message: "로그인이 필요합니다." } };
  const args: Record<string, unknown> = { ...extra };
  for (const k of ids) {
    if (!UUID.test(value(f, k)))
      return { state: { message: "대상 정보를 확인해 주세요." } };
    args[k] = value(f, k);
  }
  for (const k of texts) {
    if (!value(f, k) || value(f, k).length > 3000)
      return {
        state: { message: "필수 내용을 3,000자 이내로 입력해 주세요." },
      };
    args[k] = value(f, k);
  }
  for (const k of numbers) {
    const n = value(f, k);
    if (!/^\d{1,10}(\.\d{1,4})?$/.test(n) || Number(n) > 1000000000)
      return { state: { message: "숫자 범위를 확인해 주세요." } };
    args[k] = Number(n);
  }
  try {
    const { data, error } = await (
      await createServerSupabaseClient()
    ).rpc(rpc, args);
    if (error)
      return {
        state: {
          message:
            errorMessages[error.message] ??
            "저장하지 못했습니다. 값의 범위와 현재 상태를 확인해 주세요.",
        },
      };
    revalidatePath("/", "layout");
    return {
      state: {
        ok: true,
        message: "저장되었습니다. 아래 상태와 이력을 확인해 주세요.",
      },
      data,
    };
  } catch {
    return {
      state: {
        message:
          "연결하지 못했습니다. 저장 여부를 확인한 뒤 다시 시도해 주세요.",
      },
    };
  }
}
export async function openSurvey(_: ActionState, f: FormData) {
  const s = value(f, "closes");
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ||
    !Number.isFinite(Date.parse(s + "+09:00"))
  )
    return { message: "조사 마감시각을 확인해 주세요." };
  return (
    await run(f, "life_open_survey", ["f", "policy"], [], [], {
      closes: s + "+09:00",
    })
  ).state;
}
export async function answerSurvey(_: ActionState, f: FormData) {
  if (f.get("confirmed") !== "on")
    return { message: "조사 안내문을 확인해 주세요." };
  return (
    await run(
      f,
      "life_answer_survey",
      ["r", "policy"],
      [],
      ["overall", "content", "usefulness"],
      { confirmed: true },
    )
  ).state;
}
export async function qualityFeedback(_: ActionState, f: FormData) {
  return (await run(f, "life_quality_feedback", ["f"], ["note"], ["revision"]))
    .state;
}
export async function reviewCourse(_: ActionState, f: FormData) {
  return (
    await run(
      f,
      "life_review_course",
      ["f"],
      ["decision", "summary"],
      ["revision"],
    )
  ).state;
}
export async function addImprovement(_: ActionState, f: FormData) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value(f, "due")))
    return { message: "기한을 확인해 주세요." };
  return (await run(f, "life_add_improvement", ["r", "owner"], ["plan", "due"]))
    .state;
}
export async function reportImprovement(_: ActionState, f: FormData) {
  return (
    await run(
      f,
      "life_report_improvement",
      ["i", "target"],
      ["evidence"],
      ["revision"],
    )
  ).state;
}
export async function verifyImprovement(_: ActionState, f: FormData) {
  return (
    await run(f, "life_verify_improvement", ["i"], ["note"], ["revision"])
  ).state;
}
export async function createMetric(_: ActionState, f: FormData) {
  const d: Record<string, string> = {};
  for (const k of [
    "code",
    "title",
    "unit",
    "source",
    "formula",
    "target",
    "population",
    "dedup_rule",
    "calculation",
    "evidence_requirement",
  ]) {
    d[k] = value(f, k);
    if (!d[k] || d[k].length > 2000)
      return {
        message: "지표 정의의 모든 항목을 2,000자 이내로 입력해 주세요.",
      };
  }
  if (
    !/^[A-Z][A-Z0-9_]{1,49}$/.test(d.code) ||
    !/^\d+(\.\d{1,4})?$/.test(d.target) ||
    Number(d.target) > 1000000000
  )
    return { message: "지표 코드와 목표값을 확인해 주세요." };
  return (await run(f, "life_create_metric", ["y"], [], [], { d })).state;
}
export async function approveMetric(_: ActionState, f: FormData) {
  return (await run(f, "life_approve_metric", ["m"], ["reference"])).state;
}
export async function recordMetric(_: ActionState, f: FormData) {
  const d = value(f, "d"),
    date = value(f, "observed");
  if (
    (d && !/^\d{1,10}(\.\d{1,4})?$/.test(d)) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^\d+$/.test(value(f, "unknown_count"))
  )
    return { message: "분모·미확인 인원·기준일을 확인해 주세요." };
  return (
    await run(
      f,
      "life_record_metric",
      ["m"],
      ["source_ref", "evidence"],
      ["n", "unknown_count"],
      { d: d ? Number(d) : null, observed: date },
    )
  ).state;
}
export async function createPerformanceReport(_: ActionState, f: FormData) {
  const r = await run(
    f,
    "life_create_performance_report",
    ["y", "request_key"],
    ["reason"],
  );
  if (r.state.ok && typeof r.data === "string" && UUID.test(r.data))
    redirect("/performance/reports/" + r.data);
  return r.state;
}
export async function approvePerformanceReport(_: ActionState, f: FormData) {
  if (f.get("confirmed") !== "on")
    return { message: "등록 지표의 범위와 근거를 확인해 주세요." };
  return (await run(f, "life_approve_performance_report", ["r"], ["reference"]))
    .state;
}

export async function finalizeSurvey(_: ActionState, f: FormData) {
  return (await run(f, "life_finalize_survey", ["r"])).state;
}
