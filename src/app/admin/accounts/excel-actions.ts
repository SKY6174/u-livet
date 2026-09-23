"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { memberAdmin } from "@/lib/members/data";
import { MEMBER_GROUPS, type MemberGroup } from "@/lib/members/model";
import { validateMemberExcelRows, type MemberExcelRecord, type MemberExcelRow } from "@/lib/members/excel";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";

const validGroup = (group: string): group is MemberGroup => Object.hasOwn(MEMBER_GROUPS, group);
function importError(message: string) {
  const row = /ROW_(\d+):/.exec(message);
  const prefix = row ? `${Number(row[1]) + 1}행: ` : "";
  if (message.includes("MFA_REAUTH_REQUIRED")) return prefix + MFA_REAUTH_MESSAGE;
  if (message.includes("MEMBER_EMAIL_EXISTS")) return prefix + "이미 등록된 이메일입니다. 기존 구성원 명단을 확인해 주세요.";
  if (message.includes("MEMBER_EMAIL_MISMATCH")) return prefix + "기존 구성원의 이메일은 엑셀로 변경할 수 없습니다.";
  if (message.includes("REVISION_CONFLICT")) return prefix + "다른 관리자가 수정했습니다. 명단을 다시 내려받아 주세요.";
  if (message.includes("SCHOOL_EMAIL_REQUIRED")) return prefix + "교내 강사는 학교 이메일(@uc.ac.kr)이 필요합니다.";
  if (message.includes("MEMBER_ENTRY_FORBIDDEN") || message.includes("FORBIDDEN")) return prefix + "구성원 등록·수정 권한이나 소속 사업단을 확인해 주세요.";
  if (message.includes("INVALID_INPUT")) return prefix + "입력값과 현재 구성원 구분을 확인해 주세요.";
  return prefix + "엑셀 내용을 저장하지 못했습니다. 파일 전체가 반영되지 않았습니다.";
}

export async function exportMemberExcel(group: string, query: string): Promise<MemberExcelRecord[]> {
  await memberAdmin();
  if (!validGroup(group) || typeof query !== "string" || query.length > 100) throw Error("구성원 구분과 검색어를 확인해 주세요.");
  const { data, error } = await (await createServerSupabaseClient()).rpc("life_member_excel_export", { p_group: group, p_query: query });
  if (error) throw Error(error.message.includes("EXPORT_LIMIT") ? "검색 결과가 1,000명을 넘습니다. 검색어를 좁혀 주세요." : "명부를 내려받지 못했습니다. 권한과 연결을 확인해 주세요.");
  if (!Array.isArray(data)) throw Error("명부 자료를 확인하지 못했습니다.");
  return data as MemberExcelRecord[];
}

export async function importMemberExcel(group: string, org: string, rows: MemberExcelRow[]) {
  const me = await memberAdmin();
  if (!validGroup(group)) return { ok: false, message: "구성원 구분을 확인해 주세요." };
  try {
    const verified = validateMemberExcelRows(rows, group, org);
    if (verified.some(row => !row.person_id) && !me.member_entry_orgs?.some(item => item.org_id === org))
      return { ok: false, message: "해당 사업단의 신규 구성원 등록 권한이 없습니다." };
    if (verified.some(row => !!row.person_id) && !me.roles.some(role => role.role === "SYSTEM_ADMIN"))
      return { ok: false, message: "기존 구성원 수정은 시스템 관리자만 할 수 있습니다." };
    const { data, error } = await (await createServerSupabaseClient()).rpc("life_member_excel_import", { p_group: group, p_org: org || null, p_rows: verified });
    if (error) return { ok: false, message: importError(error.message) };
    if (!data || typeof data.created !== "number" || typeof data.updated !== "number")
      return { ok: false, message: "저장 결과를 확인하지 못했습니다. 목록을 새로고침해 주세요." };
    revalidatePath("/admin/accounts");
    return { ok: true, message: `신규 ${data.created}명, 수정 ${data.updated}명의 정보를 저장했습니다.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "엑셀 입력값을 확인해 주세요." };
  }
}
