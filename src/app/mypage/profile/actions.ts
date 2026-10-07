"use server";

import { revalidatePath } from "next/cache";
import { getSessionIdentity } from "@/lib/auth/session";
import { workspaceKind } from "@/lib/auth/workspace-navigation";
import { normalizeMobilePhone } from "@/lib/auth/registration";
import { signupEmail } from "@/lib/auth/naver-signup";
import { recoveryOrigin } from "@/lib/auth/recovery";
import { guardAuthRequest } from "@/lib/auth/abuse";
import { syncAuthDirectoryFields } from "@/lib/auth/auth-directory";
import { isReviewOnly, REVIEW_MESSAGE } from "@/lib/deployment/review-mode";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/portal/types";

const CHARACTERS = new Set(["", "sprout", "book", "star", "flower"]);

export async function saveLearnerProfile(_: ActionState, form: FormData): Promise<ActionState> {
  if (isReviewOnly()) return { message: REVIEW_MESSAGE };
  const identity = await getSessionIdentity();
  if (!identity || workspaceKind(identity) !== "learner") return { message: "수강생 계정으로 로그인해 주세요." };
  const phone = normalizeMobilePhone(form.get("phone"));
  const nickname = String(form.get("nickname") ?? "").trim();
  const character = String(form.get("character") ?? "");
  if (!phone) return { message: "휴대전화 번호를 확인해 주세요. 예: 010-1234-5678" };
  if (nickname.length > 24 || !CHARACTERS.has(character)) return { message: "별명 또는 캐릭터 선택을 확인해 주세요." };
  try {
    const client = await createServerSupabaseClient();
    const { error } = await client.rpc("life_save_learner_profile", {
      p_phone: phone, p_nickname: nickname, p_character: character || null,
    });
    if (error) return { message: "정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
    revalidatePath("/mypage/profile");
    revalidatePath("/mypage/documents");
    const { data: { user } } = await client.auth.getUser();
    if (user) {
      try { await syncAuthDirectoryFields({ userId: user.id }); }
      catch { console.error("Learner Auth phone sync deferred"); }
    }
    return { ok: true, message: "내 정보가 저장됐습니다. 수정한 번호는 미인증 연락처로 표시됩니다." };
  } catch {
    return { message: "정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
}

export async function requestLearnerEmailChange(_: ActionState, form: FormData): Promise<ActionState> {
  if (isReviewOnly()) return { message: REVIEW_MESSAGE };
  const identity = await getSessionIdentity();
  if (!identity || workspaceKind(identity) !== "learner") return { message: "수강생 계정으로 로그인해 주세요." };
  const email = signupEmail(form.get("email"));
  if (!email) return { message: "올바른 이메일 주소를 입력해 주세요." };
  try {
    const client = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) return { message: "로그인 상태를 다시 확인해 주세요." };
    if (user.email?.toLowerCase() === email) return { message: "현재 사용 중인 이메일입니다." };
    const guard = await guardAuthRequest("reset", `profile-email:${user.id}`, form, "oauth");
    if (!guard.allowed) return guard.state;
    const result = await client.auth.updateUser({ email }, {
      emailRedirectTo: `${recoveryOrigin()}/auth/callback?next=%2Fmypage%2Fprofile`,
    });
    if (result.error || !result.data.user ||
      (result.data.user.new_email?.toLowerCase() !== email && result.data.user.email?.toLowerCase() !== email)) {
      return { message: "이메일 변경 요청을 보내지 못했습니다. 주소를 확인하고 다시 시도해 주세요." };
    }
    revalidatePath("/mypage/profile");
    return { ok: true, message: result.data.user.email?.toLowerCase() === email
      ? "이메일 주소가 변경됐습니다." : "확인 메일을 보냈습니다. 메일의 안내를 완료하면 새 주소가 적용됩니다." };
  } catch {
    return { message: "이메일 변경 요청을 보내지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
}
