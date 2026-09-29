"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { safeReturnTo } from "@/lib/auth/session";
import { audienceError, isSchoolEmail, loginAudience, type LoginContext } from "@/lib/auth/login-audience";
import { getSignupPolicy } from "@/lib/auth/social";
import { normalizeMobilePhone, MOBILE_GUIDANCE } from "@/lib/auth/registration";
import type { ActionState } from "@/lib/portal/types";
import { guardAuthRequest, authProviderError } from "@/lib/auth/abuse";
import { authEmailEnabled, AUTH_EMAIL_PENDING } from "@/lib/auth/email-config";
import { syncAuthDirectoryFields } from "@/lib/auth/auth-directory";
import {
  publicSignupEnabled,
  PUBLIC_SIGNUP_PENDING,
} from "@/lib/auth/signup-config";
import {
  isValidPassword,
  PASSWORD_GUIDANCE,
  PASSWORD_MAX_LENGTH,
} from "@/lib/auth/password-policy";
export async function authenticate(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const audience = loginAudience(form.get("audience")) ?? "learner";
  if ((audience === "office" || audience === "internal") && !isSchoolEmail(email))
    return { message: "사업단 구성원과 교내 강사는 학교 이메일(@uc.ac.kr)로 로그인해 주세요." };
  const destination = safeReturnTo(form.get("next"));
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    !password ||
    password.length > PASSWORD_MAX_LENGTH
  )
    return { message: "이메일과 비밀번호를 확인해 주세요." };
  if (!isValidPassword(password))
    return {
      message:
        PASSWORD_GUIDANCE +
        " 기존 비밀번호가 기준에 맞지 않으면 ‘비밀번호를 잊으셨나요?’에서 다시 설정해 주세요.",
    };
  try {
    const guard = await guardAuthRequest("login", email, form);
    if (!guard.allowed) return guard.state;
    const client = await createServerSupabaseClient();
    const { data: authData, error } = await client.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: guard.captchaToken },
    });
    if (error)
      return (
        authProviderError(error) ?? {
          message:
            "로그인하지 못했습니다. 이메일·비밀번호와 이메일 인증 여부를 확인해 주세요.",
        }
      );
    if (authData.weakPassword) {
      await client.auth.signOut();
      return {
        message:
          "현재 비밀번호가 새 보안 기준에 맞지 않습니다. ‘비밀번호를 잊으셨나요?’에서 다시 설정해 주세요. " +
          PASSWORD_GUIDANCE,
      };
    }
    const status = await client.rpc("life_auth_status");
    if (!status.error && status.data?.active && status.data?.needs_reset) {
      await client.auth.signOut();
      return {
        message:
          "새 보안 기준 적용을 위해 비밀번호를 한 번 다시 설정해 주세요. ‘비밀번호를 잊으셨나요?’에서 이메일 안내를 받을 수 있습니다.",
      };
    }
    const security = await client.rpc("life_security_status");
    if (security.error || !security.data?.active) {
      await client.auth.signOut();
      return {
        message:
          audience === "office" || audience === "internal"
            ? "계정 활성화를 완료하지 못했습니다. 등록된 이메일의 확인 링크를 누른 뒤 다시 로그인해 주세요. 이미 확인했다면 사업단에 등록 상태를 문의해 주세요."
            : "계정 보안 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      };
    }
    const context = await client.rpc("life_login_context");
    if (context.error || !context.data) {
      await client.auth.signOut();
      return { message: "계정 구분을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." };
    }
    const mismatch = audienceError(audience, (context.data as LoginContext).audience);
    if (mismatch) { await client.auth.signOut(); return { message: mismatch }; }
    if (!(await client.rpc("life_identity")).data) {
      await client.auth.signOut();
      return {
        message: "계정 이용 상태를 확인할 수 없습니다. 사업단에 문의해 주세요.",
      };
    }
    try { await syncAuthDirectoryFields({ userId: authData.user.id }); }
    catch { console.error("Auth directory sync deferred after login"); }
  } catch {
    return { message: "로그인 서비스에 연결하지 못했습니다." };
  }
  revalidatePath("/", "layout");
  redirect(destination);
}
export async function register(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const audience = loginAudience(form.get("audience")) ?? "learner";
  if (audience === "office" || audience === "internal")
    return { message: "사업단에서 등록한 뒤 ‘신규 비밀번호 설정’을 이용해 주세요." };
  if (!publicSignupEnabled()) return { message: PUBLIC_SIGNUP_PENDING };
  if (!authEmailEnabled()) return { message: AUTH_EMAIL_PENDING };
  const phone = normalizeMobilePhone(form.get("phone"));
  if (!phone) return { message: MOBILE_GUIDANCE };
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (
    !name ||
    name.length > 100 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    return { message: "이름과 이메일 주소를 확인해 주세요." };
  if (!isValidPassword(password)) return { message: PASSWORD_GUIDANCE };
  const guard = await guardAuthRequest("signup", email, form);
  if (!guard.allowed) return guard.state;
  const policy = await getSignupPolicy();
  if (!policy || policy.id !== form.get("privacy_policy_id") || form.get("privacy_accepted") !== "on")
    return {
      message: "현재 개인정보 수집·이용 안내를 확인하고 동의해 주세요.",
    };
  try {
    const { data, error } = await (
      await createServerSupabaseClient()
    ).auth.signUp({
      email,
      password,
      options: {
        captchaToken: guard.captchaToken,
        data: { name, email: email.toLowerCase(), mobile_phone: phone,
          privacy_policy_id: policy.id, privacy_accepted: true, member_audience: audience },
      },
    });
    if (error)
      return (
        authProviderError(error) ?? {
          message:
            "가입을 완료하지 못했습니다. 입력 내용을 확인하거나 잠시 후 다시 시도해 주세요.",
        }
      );
    if (data.user?.identities?.length) {
      try { await syncAuthDirectoryFields({ userId: data.user.id }); }
      catch { console.error("Auth directory sync deferred after signup"); }
    }
  } catch {
    return { message: "가입 서비스에 연결하지 못했습니다." };
  }
  return {
    ok: true,
    message:
      "가입 요청을 처리했습니다. 이메일 인증이 필요한 경우 받은 편지함을 확인한 뒤 로그인해 주세요.",
  };
}
export async function signOut() {
  await (await createServerSupabaseClient()).auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
