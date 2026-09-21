"use server";

import { revalidatePath } from "next/cache";
import { getSessionIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";

export interface CheckinResult {
  ok: boolean;
  message: string;
  sessionTitle?: string;
  checkedInAt?: string;
}

/**
 * 수강생 스마트 QR 출석 체크 서버 액션
 * QR 코드를 스캔한 로그인 수강생의 입실 출석을 즉시 자동 기록합니다.
 */
export async function recordStudentQrCheckin(
  offeringId: string,
  sessionId: string,
): Promise<CheckinResult> {
  // 1. 로그인 인증 세션 확인
  const identity = await getSessionIdentity();
  if (!identity) {
    return {
      ok: false,
      message: "로그인이 필요합니다. 로그인 후 다시 스캔해 주세요.",
    };
  }

  // 2. 유효한 UUID 형식인지 검증
  if (!UUID.test(offeringId) || !UUID.test(sessionId)) {
    return {
      ok: false,
      message: "올바르지 않은 출석 요청입니다.",
    };
  }

  try {
    const db = await createServerSupabaseClient();

    // 3. 해당 수업 세션 정보 조회
    const { data: sessionData, error: sessionErr } = await db
      .from("life_class_sessions")
      .select("id, offering_id, title, starts_at, ends_at, status")
      .eq("id", sessionId)
      .eq("offering_id", offeringId)
      .single();

    if (sessionErr || !sessionData) {
      return {
        ok: false,
        message: "진행 중인 수업 차시를 찾을 수 없습니다.",
      };
    }

    if (sessionData.status === "CANCELLED") {
      return {
        ok: false,
        message: "해당 수업은 휴강 처리되었습니다.",
      };
    }

    // 4. 수강생의 수강 확정 여부 확인
    const { data: enrollment, error: enrollErr } = await db
      .from("life_enrollments")
      .select("id, status")
      .eq("offering_id", offeringId)
      .eq("person_id", identity.id)
      .single();

    if (enrollErr || !enrollment || enrollment.status !== "CONFIRMED") {
      return {
        ok: false,
        message: "해당 강좌의 수강 확정 대상자가 아닙니다. 수강신청 내역을 확인해 주세요.",
      };
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // 5. 출결 기록 저장/업데이트 (lms_attendance 또는 출결 레코드)
    // 수업 시작 시간부터 종료 시간 기준으로 인정 분 계산
    const startMs = Date.parse(sessionData.starts_at);
    const endMs = Date.parse(sessionData.ends_at);
    const totalMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));

    // 기존 출결 기록이 있는지 확인
    const { data: existingAttendance } = await db
      .from("life_lms_attendance")
      .select("id, status")
      .eq("lecture_id", sessionId)
      .eq("enrollment_id", enrollment.id)
      .maybeSingle();

    if (existingAttendance) {
      await db
        .from("life_lms_attendance")
        .update({
          status: "PRESENT",
          check_in_at: nowIso,
          is_qr_verified: true,
          note: "스마트 실시간 QR 코드 출석 확인",
          updated_at: nowIso,
        })
        .eq("id", existingAttendance.id);
    } else {
      await db
        .from("life_lms_attendance")
        .insert({
          lecture_id: sessionId,
          enrollment_id: enrollment.id,
          status: "PRESENT",
          check_in_at: nowIso,
          is_qr_verified: true,
          watched_seconds: 0,
          note: "스마트 실시간 QR 코드 출석 확인",
          created_at: nowIso,
          updated_at: nowIso,
        });
    }

    // 캐시 무효화 (학생 강의실, 출결 페이지, 강사 출석부 등)
    revalidatePath(`/learning/${offeringId}`, "layout");
    revalidatePath(`/instructor/offerings/${offeringId}/attendance`, "layout");

    return {
      ok: true,
      message: "출석이 성공적으로 인증되었습니다.",
      sessionTitle: sessionData.title,
      checkedInAt: now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    };
  } catch (error) {
    console.error("QR 출석 처리 오류:", error);
    return {
      ok: false,
      message: "출석 처리 중 오류가 발생했습니다. 담당 강사에게 문의해 주세요.",
    };
  }
}
