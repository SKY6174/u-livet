"use server";
import { revalidatePath } from "next/cache";
import { getSessionIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import type { ActionState } from "@/lib/portal/types";
const value = (form: FormData, key: string) =>
  typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
async function save(
  rpc: string,
  args: Record<string, string>,
): Promise<ActionState> {
  if (!(await getSessionIdentity()))
    return { message: "로그인 후 다시 시도해 주세요." };
  try {
    const { error } = await (await createServerSupabaseClient()).rpc(rpc, args);
    if (error)
      return {
        message:
          error.message === "RATE_LIMIT"
            ? "과목 제안은 하루에 5건까지 접수할 수 있습니다."
            : "저장하지 못했습니다. 입력 내용과 권한을 확인하고 다시 시도해 주세요.",
      };
    revalidatePath("/mypage");
    revalidatePath("/admin/course-requests");
    return {
      ok: true,
      message:
        rpc === "life_submit_learning_request"
          ? "희망 과목을 접수했습니다. 아래 제안 내역에서 검토 상태를 확인하세요."
          : "검토 결과를 저장했습니다.",
    };
  } catch {
    return { message: "연결하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
}
export async function submitLearningRequest(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  const o = value(f, "org"),
    title = value(f, "title"),
    goal = value(f, "goal"),
    schedule = value(f, "schedule");
  if (
    !UUID.test(o) ||
    title.length < 2 ||
    title.length > 100 ||
    goal.length < 10 ||
    goal.length > 2000 ||
    schedule.length > 200
  )
    return {
      message:
        "과목명 2~100자, 배우고 싶은 내용 10~2,000자, 희망 시간 200자 이내로 입력해 주세요.",
    };
  return save("life_submit_learning_request", { o, title, goal, schedule });
}
export async function reviewLearningRequest(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  const r = value(f, "request"),
    new_status = value(f, "status"),
    reply = value(f, "reply");
  if (
    !UUID.test(r) ||
    !["REVIEWING", "PLANNED", "NOT_PLANNED"].includes(new_status) ||
    !reply ||
    reply.length > 2000
  )
    return { message: "검토 상태와 답변(2,000자 이내)을 입력해 주세요." };
  return save("life_review_learning_request", { r, new_status, reply });
}
