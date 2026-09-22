"use server";
import { revalidatePath } from "next/cache";
import { getSessionIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import { validateReport } from "@/lib/reports/validation";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";
import type { ActionState } from "@/lib/portal/types";
const value = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
async function mutate(
  rpc: string,
  args: Record<string, unknown>,
): Promise<ActionState> {
  if (!(await getSessionIdentity())) return { message: "로그인이 필요합니다." };
  try {
    const { error } = await (await createServerSupabaseClient()).rpc(rpc, args);
    if (error)
      return {
        message:
          error.message === "REVISION_CHANGED"
            ? "다른 수정이 저장되었습니다. 새로고침 후 최신 내용을 확인해 주세요."
            : error.message === "MFA_REAUTH_REQUIRED"
              ? MFA_REAUTH_MESSAGE
              : "저장하지 못했습니다. 권한과 입력 내용, 수업 종료 여부를 확인해 주세요.",
      };
    revalidatePath("/admin", "layout");
    revalidatePath("/instructor", "layout");
    return {
      ok: true,
      message: "저장되었습니다. 출력에는 저장된 내용이 반영됩니다.",
    };
  } catch {
    return { message: "연결하지 못했습니다. 다시 시도해 주세요." };
  }
}
export async function saveCourseReport(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  let payload: unknown;
  try {
    payload = JSON.parse(value(f, "payload"));
  } catch {
    return { message: "보고서 내용을 확인해 주세요." };
  }
  const revision = Number(value(f, "revision"));
  if (
    !UUID.test(value(f, "offering")) ||
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    !validateReport(payload)
  )
    return { message: "필수 항목, 날짜, 금액과 행 수를 확인해 주세요." };
  return mutate("life_save_course_report", {
    f: value(f, "offering"),
    payload,
    expected_revision: revision,
  });
}
