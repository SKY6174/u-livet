"use server";

import { revalidatePath } from "next/cache";
import { getSessionIdentity } from "@/lib/auth/session";
import { UUID } from "@/lib/portal/data";
import type { ActionState } from "@/lib/portal/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

const policyErrors: Record<string, string> = {
  FORBIDDEN: "이 조직의 정책을 관리할 권한이 없습니다.",
  INVALID_POLICY: "정책 종류, 제목(3~120자), 버전(1~50자), 본문(20~20,000자)을 확인해 주세요.",
  POLICY_NOT_DRAFT: "이미 승인된 정책은 수정하거나 다시 승인할 수 없습니다. 새 버전을 만드세요.",
  REVISION_CHANGED: "초안이 변경되었습니다. 새로고침 후 최신 내용을 확인해 주세요.",
  APPROVED_POLICY_IMMUTABLE: "승인된 정책은 수정할 수 없습니다. 새 버전을 만드세요.",
};

async function runPolicyAction(
  org: string,
  rpc: string,
  args: Record<string, string>,
): Promise<ActionState> {
  const me = await getSessionIdentity();
  if (!me?.roles.some((role) => role.role === "COURSE_MANAGER" && role.org_id === org)) {
    return { message: "이 조직의 정책을 관리할 권한이 없습니다." };
  }
  try {
    const { error } = await (await createServerSupabaseClient()).rpc(rpc, args);
    if (error) {
      return {
        message: error.code === "23505"
          ? "이 종류와 버전의 정책이 이미 있습니다. 다른 버전을 입력해 주세요."
          : policyErrors[error.message] ?? "정책을 저장하지 못했습니다. 내용을 확인해 주세요.",
      };
    }
    revalidatePath("/admin/policies");
    revalidatePath("/admin/offerings", "layout");
    return { ok: true, message: rpc.includes("approve") ? "정책을 승인했습니다." : "초안을 저장했습니다." };
  } catch {
    return { message: "연결에 실패했습니다. 다시 시도해 주세요." };
  }
}

export async function createPolicyDraft(_: ActionState, form: FormData): Promise<ActionState> {
  const org = field(form, "org_id");
  const kind = field(form, "policy_kind");
  const version = field(form, "policy_version");
  const title = field(form, "policy_title");
  const body = field(form, "policy_body");
  if (!UUID.test(org) || !["ENROLLMENT", "COMPLETION"].includes(kind)
    || version.length < 1 || version.length > 50 || title.length < 3 || title.length > 120
    || body.length < 20 || body.length > 20000) {
    return { message: policyErrors.INVALID_POLICY };
  }
  return runPolicyAction(org, "life_create_recruitment_policy_draft", {
    org_id: org, policy_kind: kind, policy_version: version, policy_title: title, policy_body: body,
  });
}

export async function updatePolicyDraft(_: ActionState, form: FormData): Promise<ActionState> {
  const org = field(form, "org_id");
  const id = field(form, "policy_id");
  const title = field(form, "policy_title");
  const body = field(form, "policy_body");
  if (!UUID.test(org) || !UUID.test(id) || title.length < 3 || title.length > 120
    || body.length < 20 || body.length > 20000) return { message: policyErrors.INVALID_POLICY };
  return runPolicyAction(org, "life_update_recruitment_policy_draft", {
    policy_id: id,
    expected_title: field(form, "expected_title"),
    expected_body: String(form.get("expected_body") ?? ""),
    policy_title: title,
    policy_body: body,
  });
}

export async function approvePolicyDraft(_: ActionState, form: FormData): Promise<ActionState> {
  const org = field(form, "org_id");
  const id = field(form, "policy_id");
  if (!UUID.test(org) || !UUID.test(id)) return { message: "정책을 다시 선택해 주세요." };
  if (form.get("review_confirmed") !== "on") {
    return { message: "기관의 문안 검토와 승인 여부를 확인해 주세요." };
  }
  return runPolicyAction(org, "life_approve_recruitment_policy_draft", {
    policy_id: id,
    expected_title: field(form, "expected_title"),
    expected_body: String(form.get("expected_body") ?? ""),
  });
}
