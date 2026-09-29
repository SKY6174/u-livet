"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import type { SecurityStatus } from "@/lib/auth/mfa";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";

export type MfaResult = {
  ok?: boolean;
  message: string;
  enrollment?: { id: string; qr: string; secret: string };
};
async function context() {
  const client = await createServerSupabaseClient();
  const user = await client.auth.getUser();
  if (user.error || !user.data.user) throw new Error("AUTH_REQUIRED");
  const result = await client.rpc("life_security_status");
  if (result.error || !result.data?.active || result.data.needs_reset)
    throw new Error("AUTH_REQUIRED");
  const factors = await client.auth.mfa.listFactors();
  if (factors.error) throw new Error("AUTH_REQUIRED");
  return {
    client,
    status: result.data as SecurityStatus,
    factors: factors.data.all,
  };
}
export async function enrollMfa(): Promise<MfaResult> {
  try {
    const { client, status, factors } = await context();
    if (factors.some((f) => f.status === "verified") && !status.recent)
      return { message: MFA_REAUTH_MESSAGE };
    // Only clear unfinished enrollments belonging to this authenticated user.
    for (const factor of factors.filter(
      (f) => f.status === "unverified" && f.factor_type === "totp",
    ))
      await client.auth.mfa.unenroll({ factorId: factor.id });
    const permit = await client.rpc("life_prepare_mfa_change", { k: "ENROLL" });
    if (permit.error || !permit.data) return { message: MFA_REAUTH_MESSAGE };
    const { data, error } = await client.auth.mfa.enroll({
      factorType: "totp",
      issuer: "U-LiVET",
      friendlyName: permit.data,
    });
    if (error || !data)
      return {
        message: "인증 앱을 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      };
    return {
      message:
        "인증 앱에 아래 QR 또는 설정 키를 등록한 뒤 6자리 코드를 입력해 주세요.",
      enrollment: {
        id: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
      },
    };
  } catch {
    return {
      message: "로그인 상태와 비밀번호 재설정 필요 여부를 확인해 주세요.",
    };
  }
}
export async function verifyMfa(
  factorId: string,
  code: string,
): Promise<MfaResult> {
  if (!UUID.test(factorId) || !/^\d{6}$/.test(code))
    return { message: "인증 앱에 표시된 숫자 6자리를 입력해 주세요." };
  try {
    const { client, factors } = await context();
    if (!factors.some((f) => f.id === factorId && f.factor_type === "totp"))
      return { message: "현재 계정에 연결된 인증 앱을 선택해 주세요." };
    const result = await client.auth.mfa.challengeAndVerify({ factorId, code });
    if (result.error)
      return {
        message:
          "코드를 확인하지 못했습니다. 인증 앱의 현재 6자리 숫자로 다시 시도해 주세요. 반복해서 실패하면 잠시 기다려 주세요.",
      };
    const status = await client.rpc("life_security_status");
    if (
      status.error ||
      !status.data?.active ||
      status.data?.needs_reset ||
      !status.data?.mfa_verified ||
      !status.data?.recent
    )
      return {
        message: "인증 상태를 확인하지 못했습니다. 다시 로그인해 주세요.",
      };
    revalidatePath("/", "layout");
    return {
      ok: true,
      message:
        "추가 인증을 마쳤습니다. 다른 창에서 작성 중인 내용은 그대로 유지됩니다.",
    };
  } catch {
    return {
      message: "인증 서비스에 연결하지 못했습니다. 다시 시도해 주세요.",
    };
  }
}
export async function removeMfa(factorId: string): Promise<MfaResult> {
  if (!UUID.test(factorId)) return { message: "인증 앱을 확인해 주세요." };
  try {
    const { client, status, factors } = await context();
    const factor = factors.find(
      (f) => f.id === factorId && f.factor_type === "totp",
    );
    if (!factor)
      return { message: "현재 계정에 연결된 인증 앱을 확인해 주세요." };
    if (factor.status === "verified" && !status.recent)
      return { message: MFA_REAUTH_MESSAGE };
    if (
      factor.status === "verified" &&
      status.staff_required &&
      factors.filter((f) => f.status === "verified").length <= 1
    )
      return {
        message:
          "관리자 계정은 인증 앱이 하나 이상 필요합니다. 새 인증 앱을 먼저 연결해 주세요.",
      };
    if (factor.status === "verified") {
      const permit = await client.rpc("life_prepare_mfa_change", { k: "REMOVE", f: factorId });
      if (permit.error) return { message: MFA_REAUTH_MESSAGE };
    }
    const result = await client.auth.mfa.unenroll({ factorId });
    if (result.error)
      return { message: "인증 앱을 해제하지 못했습니다. 다시 확인해 주세요." };
    await client.auth.refreshSession();
    revalidatePath("/", "layout");
    return {
      ok: true,
      message:
        "선택한 인증 앱을 해제했습니다. 다른 인증 앱이 있으면 다시 추가 인증해 주세요.",
    };
  } catch {
    return { message: "로그인 상태를 확인한 뒤 다시 시도해 주세요." };
  }
}
