"use server";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import type { ActionState } from "@/lib/portal/types";
export type BadgeShareState = ActionState & { token?: string | null; revision?: number };
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const errors: Record<string, string> = {
  MFA_REAUTH_REQUIRED: MFA_REAUTH_MESSAGE,
  FORBIDDEN: "이 배지에 대한 처리 권한이 없습니다.",
  SELF_APPROVAL_FORBIDDEN:
    "본인이 작성한 정의를 승인하거나 본인 배지를 발급할 수 없습니다.",
  APPROVED_POLICY_ISSUER_REQUIRED:
    "승인된 발급 안내·수료 정책과 유효한 기관 발급권이 필요합니다.",
  LATEST_DEFINITION_REQUIRED:
    "현재 승인된 최신 배지 정의를 확인해 주세요. 이전 신청은 철회 후 다시 신청할 수 있습니다.",
  CURRENT_COMPLETION_REQUIRED:
    "최신 수료 확정이 필요합니다. 수료 현황을 확인해 주세요.",
  CONSENT_REQUIRED: "해당 승인 안내문을 확인하고 선택해 주세요.",
  CORRECTION_REASON_REQUIRED:
    "현재 배지의 정정 필요 상태와 대체 사유를 확인해 주세요.",
  REASON_REQUIRED: "처리 근거·사유를 2,000자 이내로 입력해 주세요.",
  INVALID_TRANSITION: "현재 상태에서는 처리할 수 없습니다.",
  BADGE_NOT_CURRENT: "유효한 최신 배지만 다운로드·공유할 수 있습니다.",
  REVISION_CHANGED:
    "공유 설정이 변경되었습니다. 새로고침 후 다시 확인해 주세요.",
};
async function run(
  f: FormData,
  rpc: string,
  ids: string[],
  fields: string[] = [],
  extra: Record<string, unknown> = {},
): Promise<{ state: ActionState; data?: unknown }> {
  if (!(await getSessionIdentity()))
    return { state: { message: "로그인이 필요합니다." } };
  const args: Record<string, unknown> = { ...extra };
  for (const k of ids) {
    if (!UUID.test(text(f, k)))
      return { state: { message: "대상 정보를 확인해 주세요." } };
    args[k] = text(f, k);
  }
  for (const k of fields) {
    const v = text(f, k);
    if (!v || v.length > 2000)
      return {
        state: { message: "필수 내용은 2,000자 이내로 입력해 주세요." },
      };
    args[k] = v;
  }
  try {
    const { data, error } = await (
      await createServerSupabaseClient()
    ).rpc(rpc, args);
    if (error)
      return {
        state: {
          message:
            errors[error.message] ??
            "저장하지 못했습니다. 현재 상태와 입력값을 확인해 주세요.",
        },
      };
    revalidatePath("/", "layout");
    return {
      state: {
        ok: true,
        message: "처리되었습니다. 현재 상태와 이력을 확인해 주세요.",
      },
      data,
    };
  } catch {
    return {
      state: {
        message:
          "연결하지 못했습니다. 처리 여부를 확인한 뒤 다시 시도해 주세요.",
      },
    };
  }
}
export async function createBadgeDefinition(_: ActionState, f: FormData) {
  const mode = text(f, "validity"),
    days = text(f, "days");
  if (
    !["NONE", "DAYS"].includes(mode) ||
    (mode === "DAYS" &&
      (!/^\d{1,4}$/.test(days) || Number(days) < 1 || Number(days) > 3650))
  )
    return { message: "유효기간을 명시적으로 선택해 주세요." };
  return (
    await run(
      f,
      "life_create_badge_definition",
      ["f", "issuer", "policy"],
      ["title", "description", "achievement"],
      { days: mode === "DAYS" ? Number(days) : null },
    )
  ).state;
}
export async function approveBadgeDefinition(_: ActionState, f: FormData) {
  return (await run(f, "life_approve_badge_definition", ["d"], ["reference"]))
    .state;
}
export async function retireBadgeDefinition(_: ActionState, f: FormData) {
  if (f.get("confirmed") !== "on")
    return { message: "기존 발급 배지에 대한 영향을 확인해 주세요." };
  return (await run(f, "life_retire_badge_definition", ["d"], ["reason"]))
    .state;
}
export async function requestBadge(_: ActionState, f: FormData) {
  const supersedes = text(f, "supersedes"),
    reason = text(f, "reason");
  if (f.get("confirmed") !== "on")
    return { message: "배지 발급 안내문을 확인해 주세요." };
  if ((supersedes && !UUID.test(supersedes)) || reason.length > 2000)
    return { message: "정정 대상을 확인해 주세요." };
  return (
    await run(f, "life_request_badge", ["d", "policy"], [], {
      confirmed: true,
      supersedes: supersedes || null,
      reason,
    })
  ).state;
}
export async function cancelBadgeRequest(_: ActionState, f: FormData) {
  return (await run(f, "life_cancel_badge_request", ["r"], ["reason"])).state;
}
export async function rejectBadgeRequest(_: ActionState, f: FormData) {
  return (await run(f, "life_reject_badge_request", ["r"], ["reason"])).state;
}
export async function issueBadge(_: ActionState, f: FormData) {
  if (f.get("confirmed") !== "on")
    return { message: "수료 근거·정의·발급권을 확인해 주세요." };
  const r = await run(f, "life_issue_badge", ["r"], ["reference"]);
  if (r.state.ok && typeof r.data === "string" && UUID.test(r.data))
    redirect("/badges/" + r.data);
  return r.state;
}
export async function revokeBadge(_: ActionState, f: FormData) {
  return (await run(f, "life_revoke_badge", ["i"], ["reason"])).state;
}
export async function setBadgeShare(
  _: BadgeShareState,
  f: FormData,
): Promise<BadgeShareState> {
  const enabled = text(f, "enabled") === "true",
    policy = text(f, "policy"),
    rev = text(f, "revision");
  if (
    !/^\d{1,9}$/.test(rev) ||
    (enabled && (!UUID.test(policy) || f.get("confirmed") !== "on"))
  )
    return { message: "공유 안내 확인과 현재 설정을 확인해 주세요." };
  const r = await run(f, "life_set_badge_share", ["i"], [], {
    enabled,
    policy: enabled ? policy : null,
    confirmed: enabled,
    revision: Number(rev),
  });
  if (!r.state.ok) return r.state;
  const data = r.data as { token?: string; revision?: number };
  return { ...r.state, token: data?.token ?? null, revision: data?.revision };
}
