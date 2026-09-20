"use server";
import { revalidatePath } from "next/cache";
import { getSessionIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";
import { UUID } from "@/lib/portal/data";
import { openingValues, OPENING_SOURCE, validOpeningValues } from "@/lib/course-opening/working-copy";
import type { ActionState } from "@/lib/portal/types";

export async function saveOpeningWorkingCopy(_: ActionState & { revision?: number; updatedAt?: string }, form: FormData) {
  const me = await getSessionIdentity();
  if (!me) return { message: "로그인이 필요합니다." };
  const org = String(form.get("org") ?? ""), source = String(form.get("source") ?? "");
  if (!UUID.test(org) || !me.roles.some(r => r.org_id === org && r.role === "COURSE_MANAGER")) return { message: "이 기관의 개설 준비를 저장할 권한이 없습니다." };
  const payload = openingValues(form), rawRevision = String(form.get("revision") ?? ""), revision = Number(rawRevision);
  if (!OPENING_SOURCE.test(source) || !validOpeningValues(payload) || !/^\d+$/.test(rawRevision) || !Number.isInteger(revision) || revision < 0 || revision >= 2147483647) return { message: "입력 형식과 길이를 확인해 주세요. 미정 항목은 비워둘 수 있습니다." };
  try {
    const { data, error } = await (await createServerSupabaseClient()).rpc("life_save_opening_working_copy", { o: org, source, payload, expected_revision: revision });
    if (error) return { message: error.message === "MFA_REAUTH_REQUIRED" ? MFA_REAUTH_MESSAGE : error.message === "REVISION_CHANGED" ? "다른 창에서 임시저장본이 변경되었습니다. 현재 입력은 유지됩니다. 저장본을 다시 불러와 비교한 뒤 수정해 주세요." : "임시저장하지 못했습니다. 입력 내용은 유지됩니다. 기관·사업연도와 입력값을 확인해 주세요." };
    revalidatePath("/admin/course-plan/opening");
    return { ok: true, message: "개설 준비를 임시저장했습니다. 실제 과정은 등록되지 않았습니다.", revision: data.revision as number, updatedAt: data.updated_at as string };
  } catch { return { message: "DB 연결에 실패했습니다. 입력 내용은 유지됩니다. 다시 시도해 주세요." }; }
}
