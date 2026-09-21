"use server";
import { revalidatePath } from "next/cache";
import { getSessionIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import { QR_TOKEN, qrError } from "@/lib/attendance/qr";
export interface CheckinResult {
  ok?: boolean;
  message: string;
  sessionTitle?: string;
  checkedInAt?: string;
}
export async function recordStudentQrCheckin(_: CheckinResult, form: FormData): Promise<CheckinResult> {
  const offering = String(form.get("offering") ?? "");
  const session = String(form.get("session") ?? "");
  const token = String(form.get("token") ?? "");
  if (!UUID.test(offering) || !UUID.test(session) || !QR_TOKEN.test(token)) return { message: "QR 코드를 다시 스캔해 주세요." };
  try {
    if (!(await getSessionIdentity())) return { message: "로그인이 필요합니다. 로그인 후 다시 스캔해 주세요." };
    const { data, error } = await (await createServerSupabaseClient()).rpc("life_qr_checkin", { f: offering, s: session, t: token });
    if (error) return { message: qrError(error.message, error.code) };
    if (!data || typeof data.session_title !== "string" || !Number.isFinite(Date.parse(data.checked_in_at))) return { message: "입실 저장 결과를 확인하지 못했습니다. 담당 강사에게 확인해 주세요." };
    revalidatePath(`/learning/${offering}/attendance`);
    revalidatePath(`/instructor/offerings/${offering}/attendance`);
    return { ok: true, message: "QR 입실 확인을 저장했습니다. 수업 종료 후 강사가 실제 출석시간을 확정합니다.", sessionTitle: data.session_title, checkedInAt: data.checked_in_at };
  } catch { return { message: "출석 확인에 실패했습니다. 다시 시도하거나 담당 강사에게 문의해 주세요." }; }
}
