"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { memberAdmin } from "@/lib/members/data";
import { MEMBER_GROUPS, MEMBER_SORT_OPTIONS, MEMBER_YEARS, type MemberFilters, type MemberGroup } from "@/lib/members/model";
import { validateMemberExcelRows, type MemberExcelRecord, type MemberExcelRow } from "@/lib/members/excel";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";
import { canInviteManualMembers, inviteManualMember, sendMemberSetupEmail } from "@/lib/members/invitations";
import { provisionMember, syncManualMemberAuthMetadata } from "@/lib/auth/member-provisioning";
import { syncAuthDirectoryFields } from "@/lib/auth/auth-directory";
import { UUID } from "@/lib/portal/data";

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

export async function exportMemberExcel(group: string, query: string, filters: MemberFilters): Promise<MemberExcelRecord[]> {
  await memberAdmin();
  if (!validGroup(group) || typeof query !== "string" || query.length > 100 || !filters
    || (filters.year !== null && (group === "office" || !MEMBER_YEARS.some(year => year === filters.year)))
    || (filters.kind !== null && (group !== "instructor" || !["INTERNAL", "EXTERNAL"].includes(filters.kind)))
    || !MEMBER_SORT_OPTIONS[group].some(option => option.value === filters.sort)
    || !["asc", "desc"].includes(filters.direction)) throw Error("명부 조회 조건을 확인해 주세요.");
  const { data, error } = await (await createServerSupabaseClient()).rpc("life_member_excel_export_filtered", {
    p_group: group, p_query: query, p_year: filters.year, p_kind: filters.kind,
    p_sort: filters.sort, p_direction: filters.direction,
  });
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
    if (verified.some(row => !row.person_id) && !await canInviteManualMembers(org))
      return { ok: false, message: "계정 설정 메일이나 개인정보 처리 안내가 준비되지 않았습니다. 사업단에 문의해 주세요." };
    if (verified.some(row => !!row.person_id) && !me.roles.some(role => role.role === "SYSTEM_ADMIN"))
      return { ok: false, message: "기존 구성원 수정은 시스템 관리자만 할 수 있습니다." };
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("life_member_excel_import", { p_group: group, p_org: org || null, p_rows: verified });
    if (error) return { ok: false, message: importError(error.message) };
    if (!data || typeof data.created !== "number" || typeof data.updated !== "number" || !Array.isArray(data.created_members))
      return { ok: false, message: "저장 결과를 확인하지 못했습니다. 목록을 새로고침해 주세요." };
    const created = data.created_members as { person_id: string; email: string; row: number }[];
    if (created.length !== data.created || created.some(item => !UUID.test(item.person_id) || typeof item.email !== "string" || !Number.isInteger(item.row)))
      return { ok: false, message: "명부는 저장됐지만 초대 대상을 확인하지 못했습니다. 사업단에 문의해 주세요." };
    const failedRows: number[] = [];
    let sent = 0;
    let existing = 0;
    let activated = 0;
    for (const item of created) {
      const row = verified[item.row - 2];
      if (!row || row.email !== item.email) { failedRows.push(item.row); continue; }
      const schoolMember = group === "office" || (group === "instructor" && row.kind === "INTERNAL");
      let result: "sent" | "existing" | "activated" | "failed" = "failed";
      if (schoolMember) {
        try {
          await provisionMember(item.person_id, item.email, client);
          result = await sendMemberSetupEmail(item.person_id);
        } catch { result = "failed"; }
      } else result = await inviteManualMember(item.person_id, item.email, org);
      if (result === "sent") sent++;
      else if (result === "existing") existing++;
      else if (result === "activated") activated++;
      else failedRows.push(item.row);
    }
    const metadataFailedRows: number[] = [];
    for (let index = 0; index < verified.length; index++) {
      const row = verified[index];
      if (!row.person_id) continue;
      try {
        if (group === "office" || group === "instructor" && row.kind === "INTERNAL")
          await syncManualMemberAuthMetadata(row.person_id);
        else await syncAuthDirectoryFields({ personId: row.person_id });
      } catch { metadataFailedRows.push(index + 2); }
    }
    revalidatePath("/admin/accounts");
    if (failedRows.length || metadataFailedRows.length) return { ok: false, message: `신규 ${data.created}명·수정 ${data.updated}명 명부 저장, 설정 메일 ${sent}건 발송.${failedRows.length ? ` ${failedRows.join(", ")}행은 계정 생성·발송에 실패했습니다.` : ""}${metadataFailedRows.length ? ` ${metadataFailedRows.join(", ")}행은 Auth 정보 반영에 실패했습니다.` : ""} 목록을 새로고침한 뒤 다시 시도해 주세요.` };
    return { ok: true, message: `신규 ${data.created}명, 수정 ${data.updated}명 저장 · 초대 메일 ${sent}건 발송${existing ? ` · 이미 생성된 계정 ${existing}건` : ""}${activated ? ` · 활성화된 계정 ${activated}건 발송 제외` : ""}` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "엑셀 입력값을 확인해 주세요." };
  }
}
