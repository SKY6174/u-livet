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
  checkedOutAt?: string;
  phase?: "START" | "END";
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
    if (!data || typeof data.session_title !== "string" || !Number.isFinite(Date.parse(data.checked_in_at))
      || !["START", "END"].includes(data.phase)
      || (data.phase === "END" && !Number.isFinite(Date.parse(data.checked_out_at))))
      return { message: "QR 저장 결과를 확인하지 못했습니다. 담당 강사에게 확인해 주세요." };
    revalidatePath(`/learning/${offering}/attendance`);
    revalidatePath(`/instructor/offerings/${offering}/attendance`);
    return { ok: true, message: `${data.phase === "END" ? "종료" : "시작"} QR 시각을 저장했습니다. 강사가 실제 인정시간을 별도로 확정합니다.`,
      sessionTitle: data.session_title, checkedInAt: data.checked_in_at, checkedOutAt: data.checked_out_at,
      phase: data.phase };
  } catch { return { message: "출석 확인에 실패했습니다. 다시 시도하거나 담당 강사에게 문의해 주세요." }; }
}
