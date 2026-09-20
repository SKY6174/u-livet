"use server";
import { revalidatePath } from "next/cache";
import { getSessionIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";
import { UUID } from "@/lib/portal/data";
import type { ActionState } from "@/lib/portal/types";

export async function saveAttendanceBatch(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await getSessionIdentity())) return { message: "로그인이 필요합니다." };
  const session = String(form.get("session") ?? "");
  const raw = String(form.get("records") ?? "");
  if (!UUID.test(session) || raw.length > 250000) return { message: "출석부 입력을 확인해 주세요." };
  let records: unknown;
  try { records = JSON.parse(raw); } catch { return { message: "출석부 입력을 확인해 주세요." }; }
  if (!Array.isArray(records) || !records.length || records.length > 200 || records.some((row) =>
    !row || typeof row !== "object" || typeof row.person_id !== "string" || !UUID.test(row.person_id) ||
    typeof row.minutes !== "number" || !Number.isFinite(row.minutes) || row.minutes < 0 || row.minutes > 1440 ||
    !Number.isInteger(row.expected_revision) || row.expected_revision < 0 || row.expected_revision > 2147483647 ||
    typeof row.reason !== "string" || !row.reason.trim() || row.reason.length > 1000,
  ) || new Set(records.map((row) => row.person_id.toLowerCase())).size !== records.length)
    return { message: "대상자·인정시간·확인 근거를 확인해 주세요. 한 번에 200명까지 저장할 수 있습니다." };
  try {
    const { data, error } = await (await createServerSupabaseClient()).rpc("life_record_attendance_batch", { s: session, records });
    if (error) return { message: ({
      REVISION_CHANGED: "다른 작업에서 출결이 변경되었습니다. 입력 내용은 유지됩니다. 최신 출석부를 확인한 뒤 다시 저장해 주세요.",
      FORBIDDEN: "담당 강사와 현재 수강 확정자만 출결을 기록할 수 있습니다.",
      SELF_APPROVAL_FORBIDDEN: "강사는 본인의 출석을 기록할 수 없습니다.",
      CLASS_NOT_FINISHED: "종료된 정상 수업에만 출결을 기록할 수 있습니다.",
      MFA_REAUTH_REQUIRED: MFA_REAUTH_MESSAGE,
    } as Record<string, string>)[error.message] ?? "저장하지 못했습니다. 인정시간과 확인 근거를 확인해 주세요." };
    // Report/completion views also use the same evidence. Invalidate their route trees.
    for (const path of ["/instructor", "/learning", "/admin", "/completion", "/mypage"]) revalidatePath(path, "layout");
    return { ok: true, message: `${data}명의 출결을 저장했습니다.` };
  } catch { return { message: "DB 연결에 실패했습니다. 입력 내용은 유지됩니다. 다시 시도해 주세요." }; }
}
