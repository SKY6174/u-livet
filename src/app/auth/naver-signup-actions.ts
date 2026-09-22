"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createRecoveryClient, recoveryOrigin } from "@/lib/auth/recovery";
import { guardAuthRequest } from "@/lib/auth/abuse";
import { socialReturnTo } from "@/lib/auth/registration";
import { naverSignupNeedsEmail, signupEmail } from "@/lib/auth/naver-signup";
import { isReviewOnly, REVIEW_MESSAGE } from "@/lib/deployment/review-mode";
import type { ActionState } from "@/lib/portal/types";

async function pendingSignup() {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || !naverSignupNeedsEmail(data.user)) return null;
  const status = await client.rpc("life_registration_status");
  return !status.error && status.data?.state === "PENDING" ? { client, user: data.user } : null;
}

export async function requestNaverSignupEmail(_: ActionState, form: FormData): Promise<ActionState> {
  if (isReviewOnly()) return { message: REVIEW_MESSAGE };
  const email = signupEmail(form.get("email"));
  if (!email) return { message: "U-LIFE에서 사용할 이메일 주소를 확인해 주세요." };
  try {
    const pending = await pendingSignup();
    if (!pending) return { message: "네이버 로그인을 다시 진행해 주세요. 이미 이메일을 확인했다면 화면을 새로고침해 주세요." };
    const guard = await guardAuthRequest("signup", `naver-email:${pending.user.id}`, form, "oauth");
    if (!guard.allowed) return guard.state;
    const { data, error } = await pending.client.auth.updateUser({ email }, {
      emailRedirectTo: `${recoveryOrigin()}/auth/complete-signup?next=${encodeURIComponent(socialReturnTo(form.get("next")))}`,
    });
    if (error || signupEmail(data.user?.new_email) !== email || !data.user?.email_change_sent_at) {
      return { message: "인증 메일을 보내지 못했습니다. 주소를 확인하고 잠시 후 다시 시도해 주세요. 이미 가입한 이메일이면 기존 로그인 방법을 이용해 주세요." };
    }
  } catch { return { message: "이메일 인증에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." }; }
  revalidatePath("/auth/complete-signup");
  return { ok: true, message: "인증 메일을 보냈습니다. 메일의 인증번호를 아래에 입력해 주세요.", retryAfter: 60 };
}

export async function verifyNaverSignupEmail(_: ActionState, form: FormData): Promise<ActionState> {
  if (isReviewOnly()) return { message: REVIEW_MESSAGE };
  const email = signupEmail(form.get("email"));
  const token = String(form.get("token") ?? "").trim();
  if (!email || !/^\d{6,10}$/.test(token)) return { message: "메일에 표시된 인증번호를 정확히 입력해 주세요." };
  try {
    const pending = await pendingSignup();
    if (!pending || signupEmail(pending.user.new_email) !== email) return { message: "현재 요청한 이메일을 확인해 주세요. 화면을 새로고침한 뒤 다시 진행해 주세요." };
    const guard = await guardAuthRequest("reset", `naver-email:${pending.user.id}`, form, "oauth");
    if (!guard.allowed) return guard.state;
    // Verify in an isolated client: replacing the browser's OAuth session with an
    // email OTP session would lose the OAuth AMR required by registration RLS.
    const verifier = createRecoveryClient();
    let verified = false;
    try {
      const { data, error } = await verifier.auth.verifyOtp({ email, token, type: "email_change" });
      verified = !error && data.user?.id === pending.user.id
        && signupEmail(data.user.email) === email && !!data.user.email_confirmed_at;
    } finally {
      await verifier.auth.signOut({ scope: "local" });
    }
    if (!verified) return { message: "인증번호가 일치하지 않거나 만료되었습니다. 최근 메일의 번호를 확인하거나 인증 메일을 다시 요청해 주세요." };
    const refreshed = await pending.client.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session) return { message: "이메일 확인을 마쳤습니다. 네이버 로그인을 다시 진행하면 가입을 이어갈 수 있습니다." };
  } catch { return { message: "이메일 확인을 마치지 못했습니다. 잠시 후 다시 시도해 주세요." }; }
  revalidatePath("/auth/complete-signup");
  redirect(`/auth/complete-signup?next=${encodeURIComponent(socialReturnTo(form.get("next")))}`);
}
