"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { guardAuthRequest } from "@/lib/auth/abuse";
import { recoveryOrigin } from "@/lib/auth/recovery";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { isReviewOnly, REVIEW_MESSAGE } from "@/lib/deployment/review-mode";
import { getSignupPolicy, socialDestination } from "@/lib/auth/social";
import { publicSignupEnabled, PUBLIC_SIGNUP_PENDING } from "@/lib/auth/signup-config";
import { MOBILE_GUIDANCE, normalizeMobilePhone, socialReturnTo } from "@/lib/auth/registration";
import type { ActionState } from "@/lib/portal/types";
import { loginAudience } from "@/lib/auth/login-audience";
import { socialProvider, socialProviderEnabled } from "@/lib/auth/social-providers";
import { naverSignupNeedsEmail } from "@/lib/auth/naver-signup";

export async function loginWithKakao(_: ActionState, form: FormData): Promise<ActionState> {
  form.set("provider", "kakao");
  return loginWithSocial(_, form);
}

export async function loginWithSocial(_: ActionState, form: FormData): Promise<ActionState> {
  if (isReviewOnly()) return { message: REVIEW_MESSAGE };
  const provider = socialProvider(form.get("provider"));
  const audience = loginAudience(form.get("audience")) ?? "learner";
  if (!provider || !socialProviderEnabled(provider)) return { message: "이 간편 로그인은 준비 중입니다. 카카오 또는 이메일로 이용해 주세요." };
  if (audience === "office" || audience === "internal") return { message: "사업단·교내 강사는 이메일과 비밀번호로 로그인해 주세요." };
  let url: string;
  try {
    const guard = await guardAuthRequest("login", provider, form, "oauth");
    if (!guard.allowed) return guard.state;
    const callback = new URL("/auth/callback", recoveryOrigin());
    const next = socialReturnTo(form.get("next"));
    callback.searchParams.set("next", next);
    callback.searchParams.set("audience", audience);
    const client = await createServerSupabaseClient();
    // Supabase adds options.scopes to its defaults. Replace the provider scope
    // instead: signup collects a name directly and does not need profile photos.
    const queryParams: Record<string, string> | undefined = provider === "kakao"
      ? { scope: "account_email" }
      : provider === "google"
        ? { scope: "openid email", include_granted_scopes: "false" }
        : undefined;
    const result = await client.auth.signInWithOAuth({
      provider: provider === "naver" ? "custom:naver" : provider,
      options: { redirectTo: callback.toString(), skipBrowserRedirect: true, queryParams },
    });
    if (result.error || !result.data.url) return { message: "간편 로그인에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." };
    const destination = new URL(result.data.url);
    if (destination.origin !== new URL(getSupabaseConfig()!.url).origin || destination.pathname !== "/auth/v1/authorize") throw new Error("INVALID_OAUTH_URL");
    url = destination.toString();
  } catch { return { message: "간편 로그인에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." }; }
  redirect(url);
}

export async function completeKakaoSignup(_: ActionState, form: FormData): Promise<ActionState> {
  if (isReviewOnly()) return { message: REVIEW_MESSAGE };
  if (!publicSignupEnabled()) return { message: PUBLIC_SIGNUP_PENDING };
  const name = String(form.get("name") ?? "").trim();
  const phone = normalizeMobilePhone(form.get("phone"));
  if (!name || name.length > 100) return { message: "이름을 100자 이내로 입력해 주세요." };
  if (!phone) return { message: MOBILE_GUIDANCE };
  let destination: string;
  try {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return { message: "간편 로그인을 다시 진행해 주세요." };
    if (naverSignupNeedsEmail(data.user)) return { message: "가입에 사용할 이메일을 먼저 확인해 주세요." };
    const policy = await getSignupPolicy();
    if (!policy || policy.id !== form.get("privacy_policy_id") || form.get("privacy_accepted") !== "on") return { message: "현재 개인정보 수집·이용 안내를 확인하고 동의해 주세요." };
    const result = await client.rpc("life_complete_registration", { p_name: name, p_phone: phone, p_policy: policy.id, p_accepted: true });
    if (result.error) return { message: "가입을 완료하지 못했습니다. 화면을 새로고침한 뒤 입력 내용과 동의를 확인해 주세요." };
    destination = await socialDestination(form.get("next"));
  } catch { return { message: "가입 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." }; }
  revalidatePath("/", "layout");
  redirect(destination);
}
