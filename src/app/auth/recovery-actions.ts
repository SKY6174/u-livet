"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createRecoveryClient, recoveryOrigin } from "@/lib/auth/recovery";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isValidPassword, PASSWORD_GUIDANCE } from "@/lib/auth/password-policy";
import type { ActionState } from "@/lib/portal/types";
import { guardAuthRequest, authProviderError } from "@/lib/auth/abuse";

const REQUEST_MESSAGE =
  "요청을 접수했습니다. 등록된 이메일이면 재설정 안내를 받을 수 있습니다. 반복 요청은 잠시 제한될 수 있습니다. 메일이 오지 않으면 스팸함과 주소를 확인하고, 대기 후에도 오지 않으면 잠시 더 기다리거나 사업단에 문의해 주세요.";
const LINK_MESSAGE =
  "재설정 링크를 사용할 수 없습니다. 이미 사용했거나 시간이 지났을 수 있습니다. 새 재설정 메일을 요청해 주세요.";

export async function requestPasswordReset(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
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
  const tokenHash = String(form.get("token_hash") ?? "");
  const password = String(form.get("password") ?? "");
  const mfaCode = String(form.get("mfa_code") ?? "").trim();
  if (!/^[a-f0-9]{32,128}$/i.test(tokenHash)) return { message: LINK_MESSAGE };
  if (!isValidPassword(password)) return { message: PASSWORD_GUIDANCE };
  if (mfaCode && !/^\d{6}$/.test(mfaCode))
    return { message: "인증 앱의 숫자 6자리를 입력해 주세요." };
  const guard = await guardAuthRequest("reset", tokenHash, form);
  if (!guard.allowed) return guard.state;
  let client: ReturnType<typeof createRecoveryClient> | undefined;
  let verified = false;
  let changed = false;
  try {
    client = createRecoveryClient();
    const proof = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    if (proof.error || !proof.data.user || !proof.data.session)
      return { message: LINK_MESSAGE };
    verified = true;
    const status = await client.rpc("life_auth_status");
    if (status.error || !status.data?.active) return { message: LINK_MESSAGE };
    const factors = await client.auth.mfa.listFactors();
    if (factors.error) return { message: LINK_MESSAGE };
    const verifiedFactors = factors.data.totp.filter(
      (f) => f.status === "verified",
    );
    if (verifiedFactors.length) {
      let confirmed = false;
      if (mfaCode) {
        // Any enrolled app is acceptable; Auth owns attempt limits and validation.
        for (const factor of verifiedFactors.slice(0, 10)) {
          const result = await client.auth.mfa.challengeAndVerify({
            factorId: factor.id,
            code: mfaCode,
          });
          if (!result.error) {
            confirmed = true;
            break;
          }
          if (result.error.status === 429) break;
        }
      }
      if (!confirmed)
        return {
          message:
            "이 계정은 인증 앱 확인도 필요합니다. 새 재설정 메일을 요청한 뒤 새 비밀번호와 현재 6자리 코드를 함께 입력해 주세요. 인증 앱을 사용할 수 없으면 사업단에 복구를 요청해 주세요.",
        };
    }
    const update = await client.auth.updateUser({ password });
    if (update.error)
      return {
        message:
          update.error.code === "same_password"
            ? "이전과 다른 비밀번호를 사용해 주세요. 새 재설정 메일을 요청한 뒤 다시 진행해 주세요."
            : "비밀번호를 바꾸지 못했습니다. 새 재설정 메일을 요청한 뒤 다시 진행해 주세요.",
      };
    changed = true;
  } catch {
    return { message: LINK_MESSAGE };
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
  redirect("/auth/password-updated");
}
