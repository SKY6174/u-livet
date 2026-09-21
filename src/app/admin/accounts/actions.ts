"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";
import { memberAdmin } from "@/lib/members/data";
import { memberInput } from "@/lib/members/model";
import type { ActionState } from "@/lib/portal/types";

function memberError(message: string) {
  if (message.includes("MFA_REAUTH_REQUIRED")) return MFA_REAUTH_MESSAGE;
  if (message.includes("SCHOOL_EMAIL_REQUIRED")) return "교내 강사는 인증된 학교 이메일(@uc.ac.kr)이 필요합니다.";
  if (message.includes("REVISION_CONFLICT")) return "다른 관리자가 정보를 변경했습니다. 새로고침 후 다시 확인해 주세요.";
  if (message.includes("SELF_DELETE_FORBIDDEN")) return "현재 로그인한 자신의 계정은 삭제할 수 없습니다.";
  if (message.includes("MOBILE_REQUIRED")) return "가입 시 등록된 핸드폰 전화번호는 비울 수 없습니다. 사용할 번호를 입력해 주세요.";
  return "처리하지 못했습니다. 입력 정보와 구성원 관리 권한을 확인해 주세요.";
}
export async function saveMember(_: ActionState, form: FormData): Promise<ActionState> {
  await memberAdmin();
  const input = memberInput(form);
  if (!input || !UUID.test(input.p_person)) return { message: "성명, 전화번호, 생년월일과 구분을 확인해 주세요." };
  const { error } = await (await createServerSupabaseClient()).rpc("life_save_member", input);
  if (error) return { message: memberError(error.message) };
  revalidatePath("/", "layout");
  redirect(`/admin/accounts?group=${input.p_group}&saved=1`);
}
export async function deleteMember(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await memberAdmin();
  const person = String(form.get("person_id") ?? "");
  const group = String(form.get("group") ?? "");
  const revision = String(form.get("revision") ?? "");
  if (!UUID.test(person) || !["office", "instructor", "learner"].includes(group) || !/^(0|[1-9]\d{0,8})$/.test(revision) || form.get("confirmed") !== "yes") return { message: "삭제 대상과 확인 항목을 확인해 주세요." };
  if (person === me.id) return { message: "현재 로그인한 자신의 계정은 삭제할 수 없습니다." };
  const { error } = await (await createServerSupabaseClient()).rpc("life_delete_member", { p_person: person, p_revision: Number(revision) });
  if (error) return { message: memberError(error.message) };
  revalidatePath("/admin/accounts");
  redirect(`/admin/accounts?group=${group}&deleted=1`);
}

// Compatibility for older loaded clients during deployment.
export async function saveAccountClassification(_: ActionState, form: FormData): Promise<ActionState> {
  const person = String(form.get("person_id") ?? "");
  const position = String(form.get("office_position") ?? "");
  const kind = String(form.get("instructor_kind") ?? "");
  if (!UUID.test(person) || !["", "DIRECTOR", "CENTER_HEAD", "RESEARCHER"].includes(position) || !["", "INTERNAL", "EXTERNAL"].includes(kind)) return { message: "계정 구분을 확인해 주세요." };
  const { error } = await (await createServerSupabaseClient()).rpc("life_set_account_classification", { p_person: person, p_position: position || null, p_kind: kind || null });
  if (error) return { message: memberError(error.message) };
  revalidatePath("/", "layout");
  return { ok: true, message: "계정 구분을 저장했습니다. 다음 화면 이동부터 적용됩니다." };
}
