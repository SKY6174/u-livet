"use server";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import type { ActionState } from "@/lib/portal/types";
const errors: Record<string, string> = {
  MFA_REAUTH_REQUIRED: MFA_REAUTH_MESSAGE,
  FORBIDDEN: "해당 기관의 안내문자 관리 권한이 없습니다.",
  APPROVED_TEMPLATE_REQUIRED:
    "해당 기수와 같은 기관의 승인된 문안을 선택해 주세요.",
  APPROVED_POLICY_REQUIRED: "현재 유효한 홍보 동의문을 확인해 주세요.",
  INVALID_SCHEDULE: "예약시각은 현재 이후 30일 이내로 입력해 주세요.",
  PREVIEW_EXPIRED:
    "미리보기 유효시간 또는 예약시각이 지났습니다. 새 미리보기를 만들어 주세요.",
  IDEMPOTENCY_CONFLICT:
    "이미 사용한 요청입니다. 목록에서 저장된 미리보기를 확인해 주세요.",
  NO_ELIGIBLE_RECIPIENTS:
    "현재 발송 가능한 대상이 없습니다. 동의·연락처 상태를 확인하고 새 미리보기를 만들어 주세요.",
  INVALID_TRANSITION: "현재 상태에서는 처리할 수 없습니다.",
  PROCESSING_REQUIRES_REVIEW:
    "처리 중이거나 결과 확인이 필요한 항목이 있어 취소할 수 없습니다.",
  CREATOR_REVOKED:
    "미리보기 생성자의 권한이 변경되었습니다. 새 미리보기를 만들어 주세요.",
  AUDIENCE_LIMIT: "1,000명 이하의 기수별로 미리보기를 생성해 주세요.",
};
const value = (f: FormData, key: string) => String(f.get(key) ?? "");
async function run(
  rpc: string,
  args: Record<string, unknown>,
): Promise<{ state: ActionState; data?: unknown }> {
  if (!(await getSessionIdentity()))
    return { state: { message: "로그인이 필요합니다." } };
  try {
    const { data, error } = await (
      await createServerSupabaseClient()
    ).rpc(rpc, args);
    if (error)
      return {
        state: {
          message:
            errors[error.message] ??
            "처리하지 못했습니다. 현재 상태를 확인하고 다시 시도해 주세요.",
        },
      };
    revalidatePath("/", "layout");
    return {
      state: {
        ok: true,
        message: "저장되었습니다. 현재 상태와 이력을 확인해 주세요.",
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
export async function previewMessage(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  const ids = ["f", "t", "request_key"];
  if (ids.some((k) => !UUID.test(value(f, k))))
    return { message: "기수와 승인 문안을 선택해 주세요." };
  const scheduled = value(f, "scheduled");
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(scheduled) ||
    !Number.isFinite(Date.parse(scheduled + "+09:00"))
  )
    return { message: "예약시각을 확인해 주세요." };
  const result = await run("life_message_preview", {
    f: value(f, "f"),
    t: value(f, "t"),
    request_key: value(f, "request_key"),
    scheduled: scheduled + "+09:00",
  });
  if (
    result.state.ok &&
    typeof result.data === "string" &&
    UUID.test(result.data)
  )
    redirect(`/admin/messages/${result.data}`);
  return result.state;
}
export async function queueMessage(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  if (!UUID.test(value(f, "j")) || f.get("confirmed") !== "on")
    return { message: "문안·대상과 실제 미발송 안내를 확인해 주세요." };
  return (await run("life_message_queue", { j: value(f, "j") })).state;
}
export async function cancelMessage(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  if (!UUID.test(value(f, "j"))) return { message: "작업을 확인해 주세요." };
  return (await run("life_message_cancel", { j: value(f, "j") })).state;
}
export async function setMarketing(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  const accepted = value(f, "accepted");
  if (!UUID.test(value(f, "o")) || !["true", "false"].includes(accepted))
    return { message: "동의 설정을 확인해 주세요." };
  if (
    accepted === "true" &&
    (f.get("confirmed") !== "on" || !UUID.test(value(f, "policy")))
  )
    return { message: "선택 동의문 원문을 읽고 확인해 주세요." };
  return (
    await run("life_set_marketing", {
      o: value(f, "o"),
      policy: accepted === "true" ? value(f, "policy") : null,
      accepted: accepted === "true",
    })
  ).state;
}
export async function disconnectContact(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  if (!UUID.test(value(f, "o")) || f.get("confirmed") !== "on")
    return { message: "연결 해제 안내를 확인해 주세요." };
  return (await run("life_disconnect_contact", { o: value(f, "o") })).state;
}
