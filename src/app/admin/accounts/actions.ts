"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";
import type { ActionState } from "@/lib/portal/types";
export async function saveAccountClassification(_: ActionState, form: FormData): Promise<ActionState> {
  const person = String(form.get("person_id") ?? "");
  const position = String(form.get("office_position") ?? "");
  const kind = String(form.get("instructor_kind") ?? "");
  if (!UUID.test(person) || !["", "DIRECTOR", "CENTER_HEAD", "RESEARCHER"].includes(position) || !["", "INTERNAL", "EXTERNAL"].includes(kind)) return { message: "계정 구분을 확인해 주세요." };
  const { error } = await (await createServerSupabaseClient()).rpc("life_set_account_classification", { p_person: person, p_position: position || null, p_kind: kind || null });
  if (error) return { message: error.message.includes("MFA_REAUTH_REQUIRED") ? MFA_REAUTH_MESSAGE : error.message.includes("SCHOOL_EMAIL_REQUIRED") ? "교내 강사는 인증된 학교 이메일(@uc.ac.kr)이 필요합니다." : "구분을 저장하지 못했습니다. 관리 권한과 계정 상태를 확인해 주세요." };
  revalidatePath("/", "layout");
  return { ok: true, message: "계정 구분을 저장했습니다. 다음 화면 이동부터 적용됩니다." };
}
