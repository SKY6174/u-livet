"use server";

import { revalidatePath } from "next/cache";
import { getSessionIdentity } from "@/lib/auth/session";
import { workspaceKind } from "@/lib/auth/workspace-navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { accountProfileInput } from "@/lib/account-profile/model";
import { isReviewOnly, REVIEW_MESSAGE } from "@/lib/deployment/review-mode";
import type { ActionState } from "@/lib/portal/types";

export async function saveAccountProfile(_: ActionState, form: FormData): Promise<ActionState> {
  if (isReviewOnly()) return { message: REVIEW_MESSAGE };
  const identity = await getSessionIdentity();
  if (!identity || workspaceKind(identity) === "learner") return { message: "사업단 또는 강사 계정으로 로그인해 주세요." };
  const parsed = accountProfileInput(form);
  if (parsed.error) return { message: parsed.error };
  try {
    const { error } = await (await createServerSupabaseClient()).rpc("life_save_account_profile", parsed.data);
    if (error) return { message: "내 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
    for (const path of ["/mypage", "/instructor", "/admin/accounts", "/admin/instructors"]) revalidatePath(path, "layout");
    return { ok: true, message: "내 정보가 저장됐습니다." };
  } catch { return { message: "내 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }; }
}
