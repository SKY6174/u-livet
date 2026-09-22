import type { Offering } from "@/lib/portal/types";
import { emptyReport, type ReportBundle } from "@/lib/reports/types";

// This fixture is rendered in memory only. It is never saved as course activity.
export const PREVIEW_OFFERING: Offering = {
  id: "report-preview",
  org_id: "preview",
  project_year_id: "preview",
  course_version_id: "preview",
  name: "[검토용 예시] 반려동물수제간식만들기",
  title: "반려동물수제간식만들기",
  academy: "로컬창업 · 가상 예시",
  summary: "반려동물 간식 재료 이해와 위생 관리, 조리 실습을 진행하는 예시입니다.",
  curriculum: "1회: 재료·위생 기초 및 실습\n2회: 제품 만들기와 포장 실습",
  mode: "OFFLINE",
  location: "실습실 (예시)",
  capacity: 3,
  tuition: 0,
  selection_method: "REVIEW",
  status: "DRAFT",
  apply_from: "2026-08-01T00:00:00+09:00",
  apply_until: "2026-08-04T18:00:00+09:00",
  starts_on: "2026-08-05",
  ends_on: "2026-08-07",
  year_label: "2026년 · 검토용, 제출 불가",
  enrollment_policy_id: null,
  completion_policy_id: null,
  academic_revision: 1,
  academic_sealed: false,
};

export function createReportPreview(): ReportBundle {
  const recordedAt = "2026-08-08T09:00:00+09:00";
  const payload = emptyReport(PREVIEW_OFFERING);
  Object.assign(payload, {
    operator: "운영 담당자 (예시)",
    professor: "담당 교수 (예시)",
    reportDate: "2026-08-08",
    method: "기초 이론 설명 후 소그룹 조리 실습을 진행합니다.",
    promotion: "모집·홍보 방법과 참여자 모집 결과를 작성합니다.",
    other: "운영 중 특이사항과 현장 의견을 기록합니다.",
    strengths: "실습 참여도와 교육 목표 달성 사례를 정리합니다.",
    improvements: "수업 시간 배분과 준비물 안내의 개선점을 기록합니다.",
    followUp: "차기 과정에 반영할 조치와 담당자, 일정을 작성합니다.",
    certificates: 0,
    employed: 0,
    surveyResponses: 3,
    satisfaction: 90,
  });
  payload.budgets = [
    { category: "강사료 (예시)", planned: 600000, spent: 600000, note: "6시간 × 100,000원" },
    { category: "재료비 (예시)", planned: 100000, spent: 90000, note: "예시 금액" },
  ];
  payload.scholarships = [{
    personId: "sample-learner-1", category: "수료장학금 (예시)", rate: 100,
    amount: 10000, bank: "", account: "", holder: "예시 학습자 1", paidOn: "",
    note: "구성 검토용 · 실제 지급 내역 아님",
  }];
  payload.fees = [{
    name: "예시 강사", kind: "외부강사 (예시)", birthDate: "",
    dates: "8/5, 8/7 (예시)", hours: 6, rate: 100000, bank: "", account: "",
    holder: "", paidOn: "", note: "운영진 입력 예시 · 미지급",
  }];
  const sessions = [5, 7].map((date, index) => ({
    id: `sample-session-${index + 1}`, title: `실습 ${index + 1} (예시)`,
    starts_at: `2026-08-0${date}T${index === 0 ? "09" : "14"}:00:00+09:00`,
    ends_at: `2026-08-0${date}T17:00:00+09:00`,
    status: "SCHEDULED", replaces_id: null, reason: "가상 예시",
  }));
  return {
    report: { payload, revision: 1, updated_at: recordedAt },
    sessions,
    members: [1, 2, 3].map((number) => ({
      person_id: `sample-learner-${number}`, name: `예시 학습자 ${number}`,
      enrollment_status: "ACTIVE", stale: false,
      run: number === 1 ? {
        id: "sample-completion", input_revision: 1, outcome: "READY", reasons: [],
        calculated_by: "sample-operator", calculated_at: recordedAt,
        evidence: { attendance_percent: 100, sessions: [], assignments: [], quizzes: [] },
      } : null,
      approval: number === 1 ? { approved_at: recordedAt } : null,
    })),
    attendance: sessions.flatMap((session, index) =>
      [1, 2, 3].filter((number) => !(number === 3 && index === 1)).map((number) => ({
        session_id: session.id, person_id: `sample-learner-${number}`,
        credited_minutes: number === 2 && index === 1 ? 0 : index === 0 ? 420 : 180,
        reason: "강사 입력 예시", revision: 1, recorded_at: recordedAt,
      })),
    ),
    teaching: sessions.map((session, index) => ({
      id: `sample-teaching-${index + 1}`, session_id: session.id,
      person_id: "sample-instructor", name: "예시 강사", minutes: index === 0 ? 420 : 180,
      topic: session.title, confirmed_at: recordedAt, revision: 1, current: index === 0,
      segments: index === 0 ? [
        { starts_at:"2026-08-05T09:00:00+09:00",ends_at:"2026-08-05T12:00:00+09:00" },
        { starts_at:"2026-08-05T13:00:00+09:00",ends_at:"2026-08-05T17:00:00+09:00" },
      ] : [{ starts_at:session.starts_at, ends_at:session.ends_at }],
    })),
    files: [],
  };
}
