"use server";
import { revalidatePath } from "next/cache";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";
import { budgetInput, canManageBudget, validWorkbook, type SavedWorkbook, type WorkbookInput } from "@/lib/course-budget/model";
import type { ActionState } from "@/lib/portal/types";

async function authorize(org: string) {
  const me = await requireIdentity("/admin/courses");
  if (!UUID.test(org) || !canManageBudget(me.roles, org)) throw new Error("예산 관리 권한이 없습니다.");
}
function errorMessage(message: string) {
  if (message.includes("MFA_REAUTH_REQUIRED")) return MFA_REAUTH_MESSAGE;
  if (message.includes("REVISION_CHANGED")) return "다른 담당자가 수정했습니다. 새로고침 후 최신 예산을 확인해 주세요.";
  return "저장하지 못했습니다. 입력값과 관리 권한을 확인한 뒤 다시 시도해 주세요.";
}
export async function saveCourseBudget(_: ActionState, form: FormData): Promise<ActionState> {
  const org = String(form.get("org") ?? "");
  await authorize(org);
  const payload = budgetInput(form);
  const guide = String(form.get("guide") ?? "");
  const revision = String(form.get("revision") ?? "");
  if (!payload || !/^[a-z0-9-]{1,100}$/.test(guide) || !/^\d{1,8}$/.test(revision)) return { message: "프로그램 ID와 0 이상의 원 단위 정수 금액을 확인해 주세요." };
  const { error } = await (await createServerSupabaseClient()).rpc("life_save_course_budget", { o: org, g: guide, payload, expected_revision: Number(revision) });
  if (error) return { message: errorMessage(error.message) };
  revalidatePath("/admin/courses");
  return { ok: true, message: "예산 현황을 저장했습니다." };
}
export async function saveBudgetWorkbook(org: string, input: WorkbookInput): Promise<ActionState> {
  await authorize(org);
  if (!validWorkbook(input)) return { message: "엑셀 파일명, 제목 행, 내역 크기를 확인해 주세요." };
  const { error } = await (await createServerSupabaseClient()).rpc("life_save_budget_workbook", { o: org, y: 2026, payload: input });
  if (error) return { message: errorMessage(error.message) };
  revalidatePath("/admin/courses");
  return { ok: true, message: "집행내역을 저장했습니다. 다른 관리자도 확인할 수 있습니다." };
}
export async function readBudgetWorkbook(org: string, id: string): Promise<{ workbook?: SavedWorkbook; message?: string }> {
  await authorize(org);
  if (!UUID.test(id)) return { message: "자료를 확인해 주세요." };
  const { data, error } = await (await createServerSupabaseClient()).rpc("life_budget_workbook", { o: org, w: id });
  if (error || !data) return { message: "저장한 집행내역을 불러오지 못했습니다." };
  return { workbook: data as SavedWorkbook };
}
