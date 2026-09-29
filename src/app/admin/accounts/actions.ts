"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";
import { memberAdmin, memberEntryOperator } from "@/lib/members/data";
import { isOfficePosition, isSchoolEmail } from "@/lib/auth/login-audience";
import { memberInput, newMemberInput } from "@/lib/members/model";
import { provisionMember, syncManualMemberAuthMetadata } from "@/lib/auth/member-provisioning";
import { syncAuthDirectoryFields } from "@/lib/auth/auth-directory";
import { canInviteManualMembers, inviteManualMember, sendMemberSetupEmail } from "@/lib/members/invitations";
import type { ActionState } from "@/lib/portal/types";

function memberError(message: string) {
  if (message.includes("MEMBER_EMAIL_EXISTS")) return "이미 등록된 이메일입니다. 구성원 목록에서 기존 정보를 확인해 주세요.";
  if (message.includes("REQUEST_CONFLICT")) return "등록 요청이 변경되었습니다. 등록 화면을 새로 열어 주세요.";
  if (message.includes("SUPER_ADMIN_PROTECTED")) return "최고 관리자 계정은 삭제할 수 없습니다.";
  if (message.includes("MEMBER_ENTRY_FORBIDDEN")) return "구성원 수동 등록 권한이 없습니다.";
  if (message.includes("MFA_REAUTH_REQUIRED")) return MFA_REAUTH_MESSAGE;
  if (message.includes("SCHOOL_EMAIL_REQUIRED")) return "교내 강사는 인증된 학교 이메일(@uc.ac.kr)이 필요합니다.";
  if (message.includes("REVISION_CONFLICT")) return "다른 관리자가 정보를 변경했습니다. 새로고침 후 다시 확인해 주세요.";
  if (message.includes("SELF_DELETE_FORBIDDEN")) return "현재 로그인한 자신의 계정은 삭제할 수 없습니다.";
  if (message.includes("MOBILE_REQUIRED")) return "가입 시 등록된 핸드폰 전화번호는 비울 수 없습니다. 사용할 번호를 입력해 주세요.";
  return "처리하지 못했습니다. 입력 정보와 구성원 관리 권한을 확인해 주세요.";
}
export async function saveMember(_: ActionState, form: FormData): Promise<ActionState> {
  await memberAdmin(true);
  const input = memberInput(form);
  if (!input || !UUID.test(input.p_person)) return { message: "성명, 전화번호, 생년월일과 구분을 확인해 주세요." };
  const { error } = await (await createServerSupabaseClient()).rpc("life_save_member", input);
  if (error) return { message: memberError(error.message) };
  try {
    if (input.p_group === "office" || input.p_kind === "INTERNAL")
      await syncManualMemberAuthMetadata(input.p_person);
    else await syncAuthDirectoryFields({ personId: input.p_person });
  } catch { return { message: "구성원 정보는 저장됐지만 Auth 사용자 정보 반영에 실패했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요." }; }
  revalidatePath("/", "layout");
  redirect(`/admin/accounts?group=${input.p_group}&saved=1`);
}
export async function deleteMember(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await memberAdmin(true);
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
  if (!UUID.test(person) || (position !== "" && !isOfficePosition(position)) || !["", "INTERNAL", "EXTERNAL"].includes(kind)) return { message: "계정 구분을 확인해 주세요." };
  const { error } = await (await createServerSupabaseClient()).rpc("life_set_account_classification", { p_person: person, p_position: position || null, p_kind: kind || null });
  if (error) return { message: memberError(error.message) };
  try {
    await syncManualMemberAuthMetadata(person);
    await syncAuthDirectoryFields({ personId: person });
  }
  catch { return { message: "계정 구분은 저장됐지만 Auth 사용자 정보 반영에 실패했습니다. 새로고침 후 다시 시도해 주세요." }; }
  revalidatePath("/", "layout");
  return { ok: true, message: "계정 구분을 저장했습니다. 다음 화면 이동부터 적용됩니다." };
}

export async function createMember(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await memberEntryOperator();
  const input = newMemberInput(form);
  if (!input || !UUID.test(input.p_request) || !UUID.test(input.p_org)) return { message: "성명, 이메일, 전화번호와 생년월일을 확인해 주세요." };
  if ((input.p_group === "office" || (input.p_group === "instructor" && input.p_kind === "INTERNAL")) && !isSchoolEmail(input.p_email))
    return { message: "사업단 구성원과 교내 강사는 대학 이메일(@uc.ac.kr)로 등록해 주세요." };
  if (!me.member_entry_orgs?.some((org) => org.org_id === input.p_org)) return { message: "해당 사업단의 구성원 등록 권한이 없습니다." };
  const schoolMember = input.p_group === "office" || (input.p_group === "instructor" && input.p_kind === "INTERNAL");
  if (!await canInviteManualMembers(input.p_org)) return { message: "계정 설정 메일이나 개인정보 처리 안내가 준비되지 않았습니다. 사업단에 문의해 주세요." };
  const client = await createServerSupabaseClient();
  const { data, error } = await client.rpc("life_create_member", input);
  if (error) return { message: memberError(error.message) };
  if (typeof data !== "string" || !UUID.test(data)) return { message: "등록 결과를 확인하지 못했습니다. 같은 화면에서 다시 시도해 주세요." };
  let invitation: "sent" | "existing" | "activated" = "activated";
  if (schoolMember) {
    try {
      await provisionMember(data, input.p_email, client);
    } catch {
      return { message: "구성원 정보는 저장됐지만 로그인 계정 연결을 마치지 못했습니다. 같은 화면에서 다시 제출해 주세요. 계속 실패하면 관리자에게 문의해 주세요." };
    }
    const result = await sendMemberSetupEmail(data);
    if (result === "failed") return { message: "로그인 계정은 만들어졌지만 비밀번호 설정 메일을 보내지 못했습니다. 같은 화면에서 다시 시도해 주세요." };
    invitation = result;
  } else {
    const result = await inviteManualMember(data, input.p_email, input.p_org);
    if (result === "failed") return { message: "구성원 명부는 저장됐지만 계정 설정 메일을 보내지 못했습니다. 같은 화면에서 다시 시도해 주세요." };
    invitation = result;
  }
  revalidatePath("/admin/accounts");
  redirect(`/admin/accounts?group=${input.p_group}&created=1&invited=${invitation}`);
}
