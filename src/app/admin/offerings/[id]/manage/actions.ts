"use server";

import { revalidatePath } from "next/cache";
import { getSessionIdentity } from "@/lib/auth/session";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";
import { UUID } from "@/lib/portal/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/portal/types";

const ERRORS: Record<string, string> = {
  REVISION_CHANGED: "다른 담당자가 먼저 변경했습니다. 새로고침 후 다시 지정해 주세요.",
  INVALID_RESPONSIBLE: "현재 과정에 배정된 활성 강사만 책임강사로 지정할 수 있습니다.",
  FORBIDDEN: "과정 관리 권한과 추가 인증을 확인해 주세요.",
  MFA_REAUTH_REQUIRED: MFA_REAUTH_MESSAGE,
};

export async function assignResponsibleInstructor(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const f = String(form.get("offering") ?? "");
  const p = String(form.get("person") ?? "");
  const rawRevision = String(form.get("revision") ?? "");
  const revision = Number(rawRevision);
  if (!UUID.test(f) || !UUID.test(p) || !/^\d+$/.test(rawRevision) || !Number.isSafeInteger(revision))
    return { message: "과정과 책임강사를 다시 선택해 주세요." };
  if (!(await getSessionIdentity())) return { message: "다시 로그인해 주세요." };
  try {
    const { error } = await (await createServerSupabaseClient()).rpc(
      "life_operation_assign",
      { f, p, expected_revision: revision },
    );
    if (error) return { message: ERRORS[error.message] ?? "지정하지 못했습니다. 권한과 현재 배정을 확인해 주세요." };
    revalidatePath(`/admin/offerings/${f}/manage`);
    revalidatePath("/admin/courses");
    revalidatePath("/operation-documents");
    revalidatePath(`/operation-documents/${f}/plan`);
    revalidatePath(`/operation-documents/${f}/result`);
    return { ok: true, message: "책임강사를 지정했습니다. 계획서와 결과보고서에 연결됩니다." };
  } catch {
    return { message: "연결에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  }
}
