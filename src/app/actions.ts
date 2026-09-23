"use server";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionIdentity } from "@/lib/auth/session";
import { UUID } from "@/lib/portal/data";
import type { ActionState } from "@/lib/portal/types";
import { OPENING_SOURCE, openingDateOrderError, openingValues, validOpeningValues } from "@/lib/course-opening/working-copy";

const errors: Record<string, string> = {
  MFA_REAUTH_REQUIRED: MFA_REAUTH_MESSAGE,
  CAPACITY_FULL: "정원이 찼습니다. 다른 신청의 취소 여부를 확인해 주세요.",
  FORBIDDEN: "이 작업을 처리할 권한이 없습니다.",
  AUTH_REQUIRED: "다시 로그인해 주세요.",
  APPLICATION_CLOSED: "접수 기간이 아니거나 모집이 종료되었습니다.",
  POLICY_CHANGED: "신청 안내가 변경되었습니다. 새로고침 후 다시 확인해 주세요.",
  APPROVED_POLICY_REQUIRED: "승인된 모집·수료 정책을 선택해 주세요.",
  APPROVED_REFUND_POLICY_REQUIRED:
    "승인된 환불 규정과 계산 조항을 먼저 등록해 주세요.",
  REFUND_REQUEST_REQUIRED:
    "납부 내역이 있습니다. 나의 납부·환불에서 수강취소와 환불을 신청해 주세요.",
  PAID_ENROLLMENT_NOT_ENABLED: "유료 과정의 수납 기능은 준비 중입니다.",
  DEADLINE_PASSED: "과제 제출 기한이 지났습니다.",
  REVISION_CHANGED: "제출물이 변경되었습니다. 새로고침 후 다시 채점해 주세요.",
  RESPONSIBLE_INSTRUCTOR: "현재 책임강사는 배정을 해제할 수 없습니다. 다른 강사를 책임강사로 지정한 뒤 다시 시도해 주세요.",
  INVALID_TRANSITION: "현재 상태에서는 이 작업을 처리할 수 없습니다.",
  ALREADY_REGISTERED: "이미 등록된 과정입니다. 문서 목록을 새로고침해 주세요.",
  INVALID_SOURCE: "연결할 원문 과정을 찾지 못했습니다.",
  INVALID_YEAR_OR_ORG: "앵커사업단의 2026년 사업연도를 선택해 주세요.",
  WITHDRAWAL_REVIEW_REQUIRED: "교육 시작 후 취소는 사업단 확인이 필요합니다.",
};
async function mutate(
  rpc: string,
  args: Record<string, unknown>,
): Promise<ActionState> {
  if (!(await getSessionIdentity())) return { message: "로그인이 필요합니다." };
  try {
    const { error } = await (await createServerSupabaseClient()).rpc(rpc, args);
    if (error)
      return {
        message:
          (error.code === "23514" && error.message.includes("life_offerings_check1")
            ? "교육 종료일은 교육 시작일과 같거나 늦어야 합니다."
            : error.code === "23514" && error.message.includes("life_offerings_check")
              ? "접수 마감 일시는 접수 시작 일시보다 늦어야 합니다."
              : null) ??
          errors[error.message] ??
          "처리하지 못했습니다. 입력 내용과 현재 상태를 확인해 주세요.",
      };
    revalidatePath("/", "layout");
    return { ok: true, message: "저장되었습니다." };
  } catch {
    return { message: "연결에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  }
}
const value = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();
const validId = (form: FormData, key: string) => UUID.test(value(form, key));
export async function applyForCourse(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  if (
    !validId(f, "offering") ||
    !validId(f, "policy") ||
    f.get("consent") !== "on"
  )
    return { message: "현재 신청 안내를 확인하고 필수 동의에 체크해 주세요." };
  const result = await mutate("life_apply", {
    f: value(f, "offering"),
    policy: value(f, "policy"),
  });
  return result.ok
    ? {
        ok: true,
        message:
          "신청이 접수되었습니다. 나의 공간에서 심사·대기·수강 확정 상태를 확인하세요.",
      }
    : result;
}
export async function decideApplication(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  if (
    !validId(f, "application") ||
    !["ACCEPTED", "REJECTED", "CANCELLED"].includes(value(f, "decision"))
  )
    return { message: "신청 정보를 확인해 주세요." };
  return mutate("life_decide", {
    a: value(f, "application"),
    decision: value(f, "decision"),
  });
}
export async function readLesson(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  if (!validId(f, "lesson")) return { message: "차시 정보를 확인해 주세요." };
  return mutate("life_read_lesson", { l: value(f, "lesson") });
}
export async function submitAssignment(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  if (
    !validId(f, "assignment") ||
    !value(f, "body") ||
    value(f, "body").length > 20000
  )
    return { message: "과제 내용을 20,000자 이내로 입력해 주세요." };
  return mutate("life_submit", {
    a: value(f, "assignment"),
    body: value(f, "body"),
  });
}
export async function gradeSubmission(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  const score = Number(value(f, "score"));
  const revision = Number(value(f, "revision"));
  if (
    !validId(f, "submission") ||
    !value(f, "score") ||
    !Number.isFinite(score) ||
    score < 0 ||
    score > 100 ||
    !Number.isInteger(revision)
  )
    return { message: "점수와 제출 버전을 확인해 주세요." };
  return mutate("life_grade", {
    s: value(f, "submission"),
    revision,
    score,
    feedback: value(f, "feedback"),
  });
}
export async function createContent(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  if (
    !validId(f, "offering") ||
    !["LESSON", "ASSIGNMENT"].includes(value(f, "kind")) ||
    !value(f, "title") ||
    !value(f, "body")
  )
    return { message: "제목과 내용을 입력해 주세요." };
  return mutate("life_teaching_content", {
    f: value(f, "offering"),
    kind: value(f, "kind"),
    title: value(f, "title"),
    body: value(f, "body"),
    ordinal: Number(value(f, "position")) || 1,
    due_at: value(f, "due_at") ? `${value(f, "due_at")}+09:00` : null,
  });
}
export async function createOffering(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  if (!validId(f, "org") || !validId(f, "year"))
    return { message: "기관과 사업연도를 선택해 주세요." };
  const fields = [
    "title",
    "academy",
    "summary",
    "curriculum",
    "mode",
    "location",
    "selection_method",
    "starts_on",
    "ends_on",
  ];
  const args: Record<string, unknown> = {
    o: value(f, "org"),
    y: value(f, "year"),
    capacity: Number(value(f, "capacity")),
  };
  for (const key of fields) {
    args[key] = value(f, key);
    if (!args[key]) return { message: "필수 항목을 모두 입력해 주세요." };
  }
  for (const key of ["apply_from", "apply_until"]) {
    if (!value(f, key)) return { message: "접수 일시를 입력해 주세요." };
    args[key] = `${value(f, key)}+09:00`;
  }
  const opening = openingValues(f);
  if (!validOpeningValues(opening))
    return { message: "정원·날짜·입력 항목을 확인해 주세요." };
  const dateError = openingDateOrderError(opening);
  if (dateError) return { message: dateError.message };
  const source = value(f, "source");
  if (source && !OPENING_SOURCE.test(source))
    return { message: "원문 과정 식별자를 확인해 주세요." };
  return source
    ? mutate("life_create_source_offering", { ...args, source_id: source })
    : mutate("life_create_offering", args);
}
export async function publishOffering(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  if (
    !["offering", "enrollment_policy", "completion_policy"].every((key) =>
      validId(f, key),
    )
  )
    return { message: "승인된 모집·수료 정책을 선택해 주세요." };
  return mutate("life_publish", {
    f: value(f, "offering"),
    enrollment_policy: value(f, "enrollment_policy"),
    completion_policy: value(f, "completion_policy"),
  });
}

export async function assignInstructor(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  if (
    !validId(f, "offering") ||
    !validId(f, "person") ||
    !["true", "false"].includes(value(f, "enabled"))
  )
    return { message: "배정할 강사와 처리 내용을 확인해 주세요." };
  return mutate("life_assign_instructor", {
    f: value(f, "offering"),
    p: value(f, "person"),
    enabled: value(f, "enabled") === "true",
  });
}
