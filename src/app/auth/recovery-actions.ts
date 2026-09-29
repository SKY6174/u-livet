"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createRecoveryClient, recoveryOrigin } from "@/lib/auth/recovery";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isValidPassword, PASSWORD_GUIDANCE } from "@/lib/auth/password-policy";
import type { ActionState } from "@/lib/portal/types";
import { guardAuthRequest, authProviderError } from "@/lib/auth/abuse";
import { authEmailEnabled, AUTH_EMAIL_PENDING } from "@/lib/auth/email-config";
import { createMemberAdminClient } from "@/lib/auth/member-provisioning";
import { normalizeMobilePhone } from "@/lib/auth/registration";

const REQUEST_MESSAGE =
  "요청을 접수했습니다. 등록된 이메일이면 재설정 안내를 받을 수 있습니다. 반복 요청은 잠시 제한될 수 있습니다. 메일이 오지 않으면 스팸함과 주소를 확인하고, 대기 후에도 오지 않으면 잠시 더 기다리거나 사업단에 문의해 주세요.";
const LINK_MESSAGE =
  "재설정 링크를 사용할 수 없습니다. 이미 사용했거나 시간이 지났을 수 있습니다. 새 재설정 메일을 요청해 주세요.";

export async function requestPasswordReset(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!authEmailEnabled()) return { message: AUTH_EMAIL_PENDING };
  const email = String(form.get("email") ?? "").trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { message: "회원가입할 때 사용한 이메일 주소를 확인해 주세요." };
  const guard = await guardAuthRequest("recovery", email, form);
  if (!guard.allowed) {
    if (guard.reason !== "limited") return guard.state;
    return { ok: true, message: REQUEST_MESSAGE, retryAfter: 60 };
  }
  try {
    const client = createRecoveryClient();
    // Do not reveal whether an account exists, is rate limited, or is disabled.
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${recoveryOrigin()}/auth/reset-password`,
      captchaToken: guard.captchaToken,
    });
    if (error?.code === "captcha_failed") return authProviderError(error)!;
  } catch {
    return { ok: true, message: REQUEST_MESSAGE, retryAfter: 60 };
  }
  return { ok: true, message: REQUEST_MESSAGE, retryAfter: 60 };
}

export async function resetPassword(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  return finishPassword(form, "recovery");
}

export async function acceptInvitation(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  return finishPassword(form, "invite");
}

async function finishPassword(
  form: FormData,
  purpose: "recovery" | "invite",
): Promise<ActionState> {
  const linkMessage =
    purpose === "invite"
      ? "초대 링크를 사용할 수 없습니다. 이미 사용했거나 시간이 지났을 수 있습니다. 사업단에 새 초대 메일을 요청해 주세요."
      : LINK_MESSAGE;
  const tokenHash = String(form.get("token_hash") ?? "");
  const password = String(form.get("password") ?? "");
  const policyId = String(form.get("privacy_policy_id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const mobile = purpose === "invite" && policyId ? normalizeMobilePhone(form.get("phone")) : null;
  if (!/^[a-f0-9]{32,128}$/i.test(tokenHash)) return { message: linkMessage };
  if (!isValidPassword(password)) return { message: PASSWORD_GUIDANCE };
  if (purpose === "invite" && policyId && (!name || name.length > 100 || !mobile
    || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
    return { message: "이름, 초대받은 이메일, 휴대폰 번호를 확인해 주세요." };
  const guard = await guardAuthRequest("reset", tokenHash, form);
  if (!guard.allowed) return guard.state;
  let client: ReturnType<typeof createRecoveryClient> | undefined;
  let verified = false;
  let changed = false;
  try {
    client = createRecoveryClient();
    const proof = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type: purpose,
    });
    if (proof.error || !proof.data.user || !proof.data.session)
      return { message: linkMessage };
    verified = true;
    if (purpose === "invite" && !proof.data.user.invited_at)
      return { message: linkMessage };
    if (purpose === "invite" && policyId) {
      if (proof.data.user.email?.toLowerCase() !== email)
        return { message: "초대받은 이메일 주소를 정확히 입력해 주세요." };
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(policyId)
        || form.get("privacy_accepted") !== "on")
        return { message: "개인정보 수집·이용 안내를 확인하고 동의해 주세요." };
      const acceptance = await client.rpc("life_accept_manual_member_invitation", {
        p_policy: policyId, p_accepted: true,
      });
      if (acceptance.error)
        return { message: "개인정보 동의 또는 계정 연결을 완료하지 못했습니다. 사업단에 문의해 주세요." };
    }
    const status = await client.rpc("life_auth_status");
    if (status.error || !status.data?.active) return { message: linkMessage };
    const setup = await client.rpc("life_member_setup_required");
    if (setup.error) return { message: linkMessage };
    if (setup.data === true) {
      const policyId = String(form.get("member_privacy_policy_id") ?? "");
      if (form.get("member_privacy_accepted") !== "on" || !/^[0-9a-f-]{36}$/i.test(policyId))
        return { message: "첫 비밀번호를 설정하려면 개인정보 안내를 확인하고 동의해 주세요." };
      const consent = await client.rpc("life_accept_member_privacy", { p_policy: policyId });
      if (consent.error)
        return { message: "계정 동의를 확인하지 못했습니다. 새 메일을 요청하거나 사업단에 문의해 주세요." };
    }
    const update = await createMemberAdminClient().auth.admin.updateUserById(proof.data.user.id, {
      password,
      ...(purpose === "invite" && policyId ? { user_metadata: {
        ...proof.data.user.user_metadata, name, email, mobile_phone: mobile,
      } } : {}),
    });
    if (update.error)
      return {
        message:
          purpose === "invite"
            ? "비밀번호 설정을 마치지 못했습니다. 사업단에 계정 설정 도움을 요청해 주세요."
            : update.error.code === "same_password"
            ? "이전과 다른 비밀번호를 사용해 주세요. 새 재설정 메일을 요청한 뒤 다시 진행해 주세요."
            : "비밀번호를 바꾸지 못했습니다. 새 재설정 메일을 요청한 뒤 다시 진행해 주세요.",
      };
    changed = true;
  } catch {
    return { message: linkMessage };
  } finally {
    if (verified && client) {
      // DB authorization also rejects every session predating the password change.
      await client.auth
        .signOut({ scope: changed ? "global" : "local" })
        .catch(() => undefined);
    }
  }
  // The recovery session is never written into browser cookies. Clear any older
  // browser login (including a different account) before offering a fresh login.
  try {
    await (await createServerSupabaseClient()).auth.signOut({ scope: "local" });
  } catch {
    // The password was changed; cookie cleanup cannot turn that into a failure.
  }
  revalidatePath("/", "layout");
  redirect(
    purpose === "invite"
      ? "/auth/invitation-accepted"
      : "/auth/password-updated",
  );
}
