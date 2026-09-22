"use server";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";
import { revalidatePath } from "next/cache";
import { getSessionIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import type { ActionState } from "@/lib/portal/types";
const value = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const messages: Record<string, string> = {
  MFA_REAUTH_REQUIRED: MFA_REAUTH_MESSAGE,
  FORBIDDEN: "이 작업을 처리할 권한이 없습니다.",
  REVISION_CHANGED:
    "기록이 변경되었습니다. 새로고침 후 최신 자료로 다시 처리해 주세요.",
  SELF_APPROVAL_FORBIDDEN:
    "본인 기록이나 직접 작성한 결과는 승인할 수 없습니다. 별도 승인자가 필요합니다.",
  CLASS_NOT_FINISHED: "종료된 정상 수업에만 출결을 기록할 수 있습니다.",
  SESSION_OUTSIDE_COURSE: "수업 일정을 과정 운영기간 안으로 입력해 주세요.",
  INVALID_REPLACEMENT:
    "이 기수에서 취소된 수업만 보강 대상으로 선택할 수 있습니다.",
  EXAM_CLOSED: "시험 응시 기간이 아닙니다.",
  NOT_READY:
    "승인 가능한 수료 후보가 아닙니다. 기준과 근거자료를 다시 확인해 주세요.",
  APPROVED_POLICY_REQUIRED: "유효한 승인 수료 정책이 필요합니다.",
  APPROVED_POLICY_IMMUTABLE:
    "승인된 기준은 수정할 수 없습니다. 새 정책 버전이 필요합니다.",
};
async function mutate(
  rpc: string,
  args: Record<string, unknown>,
): Promise<ActionState> {
  if (!(await getSessionIdentity())) return { message: "로그인이 필요합니다." };
  try {
    const { data, error } = await (
      await createServerSupabaseClient()
    ).rpc(rpc, args);
    if (error)
      return {
        message:
          messages[error.message] ??
          "저장하지 못했습니다. 입력 값과 현재 상태를 확인해 주세요.",
      };
    revalidatePath("/", "layout");
    return {
      ok: true,
      message:
        data === "EXPIRED"
          ? "응시 시간이 종료되어 추가 답안은 저장되지 않았습니다."
          : data === "SUBMITTED"
            ? "제출이 완료되었습니다. 시험 종료 후 점수를 확인하세요."
            : "저장되었습니다.",
    };
  } catch {
    return { message: "연결에 실패했습니다. 다시 시도해 주세요." };
  }
}
export async function scheduleClass(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  if (
    !UUID.test(value(f, "offering")) ||
    !value(f, "starts_at") ||
    !value(f, "ends_at")
  )
    return { message: "수업 일정을 입력해 주세요." };
  return mutate("life_schedule_class", {
    f: value(f, "offering"),
    title: value(f, "title"),
    starts_at: `${value(f, "starts_at")}+09:00`,
    ends_at: `${value(f, "ends_at")}+09:00`,
    replaces: value(f, "replaces") || null,
  });
}
export async function cancelClass(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  return mutate("life_cancel_class", {
    s: value(f, "session"),
    reason: value(f, "reason"),
  });
}
export async function recordAttendance(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  if (!value(f, "minutes") || !Number.isFinite(Number(value(f, "minutes"))))
    return { message: "인정 출석시간을 입력해 주세요." };
  return mutate("life_record_attendance", {
    s: value(f, "session"),
    p: value(f, "person"),
    minutes: Number(value(f, "minutes")),
    reason: value(f, "reason"),
    expected_revision: Number(value(f, "revision")),
  });
}
export async function createQuiz(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  const count = Number(value(f, "count"));
  if (!Number.isInteger(count) || count < 1 || count > 20)
    return { message: "문항은 1~20개로 구성해 주세요." };
  const questions = [];
  const answer_key = [];
  for (let i = 0; i < count; i++) {
    questions.push({
      text: value(f, `q${i}`),
      options: [0, 1, 2, 3].map((j) => value(f, `q${i}o${j}`)),
    });
    if (!value(f, `q${i}answer`))
      return { message: "모든 문항의 정답을 선택해 주세요." };
    answer_key.push(Number(value(f, `q${i}answer`)));
  }
  return mutate("life_create_quiz", {
    f: value(f, "offering"),
    title: value(f, "title"),
    opens_at: `${value(f, "opens_at")}+09:00`,
    closes_at: `${value(f, "closes_at")}+09:00`,
    duration_minutes: Number(value(f, "duration")),
    questions,
    answer_key,
  });
}
export async function startQuiz(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  return mutate("life_start_quiz", { q: value(f, "quiz") });
}
export async function answerQuiz(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  const count = Number(value(f, "count"));
  if (!Number.isInteger(count) || count < 1 || count > 20)
    return { message: "시험 정보를 다시 확인해 주세요." };
  const answers = Array.from({ length: count }, (_, i) =>
    value(f, `answer${i}`) === "" ? null : Number(value(f, `answer${i}`)),
  );
  return mutate("life_answer_quiz", {
    a: value(f, "attempt"),
    answers,
    finalize: value(f, "finalize") === "true",
  });
}
export async function proposeRules(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  const read = (k: string) => (value(f, k) === "" ? null : Number(value(f, k)));
  const nums = ["attendance", "assignment_score", "quiz_score"].map(read);
  if (
    nums.every((n) => n === null) ||
    nums.some((n) => n !== null && (!Number.isFinite(n) || n < 0 || n > 100))
  )
    return {
      message: "적용할 기준을 한 가지 이상 0~100 범위로 입력해 주세요.",
    };
  return mutate("life_propose_rules", {
    policy: value(f, "policy"),
    attendance: nums[0],
    assignment_score: nums[1],
    quiz_score: nums[2],
  });
}
export async function approveRules(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  if (f.get("reviewed") !== "on")
    return { message: "문안과 계산 기준을 검토해 주세요." };
  return mutate("life_approve_rules", {
    policy: value(f, "policy"),
    expected_created_at: value(f, "created_at"),
  });
}
export async function sealAcademics(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  if (f.get("reviewed") !== "on")
    return { message: "모든 운영자료 등록을 확인해 주세요." };
  return mutate("life_seal_academics", {
    f: value(f, "offering"),
    expected_revision: Number(value(f, "revision")),
  });
}
export async function calculateCompletion(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  return mutate("life_calculate_completion", {
    f: value(f, "offering"),
    p: value(f, "person"),
  });
}
export async function confirmCompletion(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  if (f.get("reviewed") !== "on")
    return { message: "판정 근거를 확인해 주세요." };
  return mutate("life_confirm_completion", { r: value(f, "run") });
}
