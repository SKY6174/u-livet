"use server";
import { getSessionIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import { QR_TOKEN, qrError, type QrChallenge } from "@/lib/attendance/qr";
export async function issueAttendanceQr(offering: string, session: string): Promise<{ challenge?: QrChallenge; message?: string }> {
  if (!UUID.test(offering) || !UUID.test(session)) return { message: "올바른 수업을 선택해 주세요." };
  try {
    if (!(await getSessionIdentity())) return { message: "로그인이 필요합니다." };
    const { data, error } = await (await createServerSupabaseClient()).rpc("life_issue_attendance_qr", { f: offering, s: session });
    if (error) return { message: qrError(error.message, error.code) };
    if (!data || !QR_TOKEN.test(data.token) || !Number.isFinite(Date.parse(data.expires_at))) return { message: "QR 발급 응답을 확인하지 못했습니다." };
    return { challenge: data };
  } catch { return { message: "연결에 실패했습니다. 다시 시도해 주세요." }; }
}
export async function stopAttendanceQr(offering: string, session: string): Promise<{ ok?: boolean; message?: string }> {
  if (!UUID.test(offering) || !UUID.test(session)) return { message: "올바른 수업을 선택해 주세요." };
  try {
    if (!(await getSessionIdentity())) return { message: "로그인이 필요합니다." };
    const { error } = await (await createServerSupabaseClient()).rpc("life_stop_attendance_qr", { f: offering, s: session });
    return error ? { message: qrError(error.message, error.code) } : { ok: true };
  } catch { return { message: "중지하지 못했습니다. 다시 시도해 주세요. 발급된 QR은 최대 2분 후 만료됩니다." }; }
}
