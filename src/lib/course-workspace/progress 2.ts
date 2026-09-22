import { DOCUMENTS } from "@/lib/reports/types";
import type { CourseWorkspace, DocumentReadiness } from "./types";

export function documentReadiness(c: CourseWorkspace): DocumentReadiness[] {
  const base = `/admin/offerings/${c.id}`;
  const report = `${base}/reports`;
  const rows: Omit<DocumentReadiness, "kind" | "title">[] = [
    {
      owner: "운영진",
      href: `${report}#report-basic`,
      label: !c.report_revision
        ? "작성 전"
        : c.report_missing.length
          ? "기본정보 보완"
          : "내용 저장됨",
      detail: c.report_missing.length
        ? `${c.report_missing.join(" · ")} 확인`
        : "운영 결과·예산·총평을 검토하세요.",
      tone: !c.report_revision
        ? "empty"
        : c.report_missing.length
          ? "attention"
          : "ready",
    },
    {
      owner: "강사 입력 · 운영진 확인",
      href: `${base}#attendance`,
      label:
        !c.scheduled_sessions || !c.enrolled
          ? "개인별 자료 미등록"
          : c.missing_attendance
            ? `${c.missing_attendance}건 미입력`
            : c.ended_sessions < c.scheduled_sessions
              ? "수업 진행 중"
              : "출결 입력됨",
      detail: "종료된 정상 수업 기준입니다. 미입력과 결석은 구분합니다.",
      tone:
        !c.scheduled_sessions || !c.enrolled
          ? "empty"
          : c.missing_attendance
            ? "attention"
            : c.ended_sessions < c.scheduled_sessions
              ? "empty"
              : "ready",
    },
    {
      owner: "운영진 검토 · 승인자 확정",
      href:
        c.status === "ARCHIVED" && !c.enrolled
          ? `${report}#attachments`
          : `/completion/${c.id}`,
      label: !c.enrolled
        ? "개인별 명단 미등록"
        : c.completion_pending
          ? `${c.completion_pending}명 검토 필요`
          : "수료 판정 확인됨",
      detail: c.source
        ? `원본 수료 ${c.source.completed}명 · 개인별 승인 자료는 별도입니다.`
        : `유효 수료 승인 ${c.completed}명 · 변경된 판정은 재검토합니다.`,
      tone: !c.enrolled
        ? "empty"
        : c.completion_pending
          ? "attention"
          : "ready",
    },
    {
      owner: "운영진 · 해당 시 입력",
      href: `${report}#report-scholarships`,
      label: !c.scholarship_count
        ? "지급내역 미등록"
        : c.scholarship_unpaid
          ? `${c.scholarship_unpaid}건 지급일 미입력`
          : `${c.scholarship_count}건 기록됨`,
      detail: "대상자·금액·지급일을 입력하면 출력에 반영됩니다.",
      tone: !c.scholarship_count
        ? "empty"
        : c.scholarship_unpaid
          ? "attention"
          : "ready",
    },
    {
      owner: "강사 제출 · 운영진 승인",
      href: `${report}#teaching`,
      label: !c.teaching_logs
        ? "강의실적 미등록"
        : c.teaching_pending
          ? `${c.teaching_pending}건 승인 대기`
          : `${c.teaching_logs}건 승인됨`,
      detail: "강사가 제출한 실제 강의시간과 내용을 확인합니다.",
      tone: !c.teaching_logs
        ? "empty"
        : c.teaching_pending
          ? "attention"
          : "ready",
    },
    {
      owner: "운영진 · 해당 시 입력",
      href: `${report}#report-fees`,
      label: !c.fee_count
        ? "지급내역 미등록"
        : c.fee_unpaid
          ? `${c.fee_unpaid}건 지급일 미입력`
          : `${c.fee_count}건 기록됨`,
      detail: "시수·단가·지급일을 입력합니다. 실제 이체는 별도입니다.",
      tone: !c.fee_count ? "empty" : c.fee_unpaid ? "attention" : "ready",
    },
  ];
  return DOCUMENTS.map(([kind, title], i) => ({ ...rows[i], kind, title }));
}

export function attendancePreparation(c: CourseWorkspace) {
  if (c.status === "ARCHIVED") return [];
  const manage = `/admin/offerings/${c.id}/manage`;
  return [
    {
      label: "담당 강사", ready: c.instructors > 0, value: `${c.instructors}명 배정`,
      detail: "배정된 강사가 본인 계정에서 일정과 출결을 입력합니다.",
      href: `${manage}#instructors`, action: "강사 배정 확인",
    },
    {
      label: "수강 확정 명단", ready: c.enrolled > 0, value: `${c.enrolled}명 확정`,
      detail: "신청·선발 및 필요한 납부 절차를 마친 수강생이 출석부에 표시됩니다.",
      href: `${manage}#applications`, action: "신청·선발 확인",
    },
    {
      label: "수업 일정", ready: c.scheduled_sessions > 0, value: `${c.scheduled_sessions}회 등록`,
      detail: "담당 강사가 강사 공간 → 담당 과정 → 출석부에서 실제 교육 구간별로 등록합니다.",
      href: `${manage}#instructors`, action: "담당 강사 확인",
    },
  ];
}

export function nextCourseAction(
  c: CourseWorkspace,
  today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }),
) {
  const base = `/admin/offerings/${c.id}`;
  if (c.status === "ARCHIVED")
    return {
      label: "원본·보고서 검토",
      href: `${base}/reports`,
      detail: "보관된 원본과 보고서 내용을 확인하세요.",
    };
  if (c.status === "DRAFT")
    return {
      label: "개설 준비 확인",
      href: `${base}/manage`,
      detail: "강사·운영 규정 확인 후 모집을 공개하세요.",
    };
  if (c.application_pending)
    return {
      label: `신청 ${c.application_pending}건 심사`,
      href: `${base}/manage#applications`,
      detail: "접수된 신청과 대기자를 확인하세요.",
    };
  if (!c.instructors)
    return {
      label: "담당 강사 배정",
      href: `${base}/manage#instructors`,
      detail: "출결과 강의실적을 입력할 강사를 배정하세요.",
    };
  if (!c.enrolled)
    return {
      label: "수강 확정 명단 준비",
      href: `${base}/manage#applications`,
      detail: "신청·선발 및 필요한 납부 절차를 마친 수강생이 출석부에 표시됩니다.",
    };
  if (!c.scheduled_sessions)
    return {
      label: "수업 일정 등록 확인",
      href: `${base}#attendance`,
      detail: "담당 강사가 출석부에 최종 시간표를 등록하면 회차별 기록을 시작할 수 있습니다.",
    };
  if (c.missing_attendance)
    return {
      label: "출결 미입력 확인",
      href: `${base}#attendance`,
      detail: `강사가 입력할 종료 수업 출결이 ${c.missing_attendance}건 있습니다.`,
    };
  if (
    c.completion_pending &&
    c.ended_sessions >= c.scheduled_sessions &&
    c.ends_on < today
  )
    return {
      label: "수료 검토하기",
      href: `/completion/${c.id}`,
      detail: `${c.completion_pending}명의 수료 판정을 확인하세요.`,
    };
  if (c.teaching_pending)
    return {
      label: "강의실적 승인",
      href: `${base}/reports#teaching`,
      detail: `${c.teaching_pending}건의 강의실적이 승인 대기 중입니다.`,
    };
  if (c.ended_sessions < c.scheduled_sessions)
    return {
      label: "수업 진행·출결 확인",
      href: `${base}#attendance`,
      detail: `등록된 ${c.scheduled_sessions}회 중 ${c.ended_sessions}회가 종료됐습니다. 종료된 수업부터 출결을 확인하세요.`,
    };
  return {
    label: c.report_revision ? "보고서 검토·출력" : "결과보고서 작성",
    href: `${base}/reports${c.report_revision ? "" : "#report-basic"}`,
    detail: c.report_revision
      ? "저장된 내용과 6종 출력 자료를 확인하세요."
      : "기본정보와 운영 결과부터 작성하세요.",
  };
}
