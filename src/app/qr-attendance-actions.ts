"use server";
import { revalidatePath } from "next/cache";
import { getSessionIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import { QR_TOKEN, qrError, parseKoreanDateTime, type QrChallenge, type QrSessionTime } from "@/lib/attendance/qr";
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
export async function rescheduleQrTestClass(offering: string, previous: QrSessionTime, startsAt: string, endsAt: string): Promise<{ session?: QrSessionTime; message: string }> {
  if (!UUID.test(offering) || !previous || !UUID.test(previous.id)
    || !Number.isFinite(Date.parse(previous.starts_at)) || !Number.isFinite(Date.parse(previous.ends_at)))
    return { message: "올바른 수업을 선택해 주세요." };
  const start = parseKoreanDateTime(startsAt), end = parseKoreanDateTime(endsAt);
  if (!start || !end || Date.parse(end) <= Date.parse(start) || Date.parse(end) - Date.parse(start) > 86400000)
    return { message: qrError("INVALID_SESSION_TIME") };
  try {
    if (!(await getSessionIdentity())) return { message: "로그인이 필요합니다." };
    const { data, error } = await (await createServerSupabaseClient()).rpc("life_reschedule_qr_test_class", {
      f: offering, s: previous.id, p_starts_at: start, p_ends_at: end,
      p_expected_starts_at: previous.starts_at, p_expected_ends_at: previous.ends_at,
    });
    if (error) return { message: qrError(error.message, error.code) };
    if (!data || data.id !== previous.id || Date.parse(data.starts_at) !== Date.parse(start) || Date.parse(data.ends_at) !== Date.parse(end))
      return { message: "저장 결과를 확인하지 못했습니다. 새로고침하여 시간을 확인해 주세요." };
    for (const path of ["/instructor", "/mypage", `/instructor/offerings/${offering}`, `/learning/${offering}`])
      revalidatePath(path, "layout");
    return { session: data, message: "테스트 수업 시간을 저장했습니다. QR 입실 확인을 다시 시작해 주세요." };
  } catch { return { message: "시간을 저장하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요." }; }
}
