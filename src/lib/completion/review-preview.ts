import type { CompletionRow, CompletionRun } from "@/lib/portal/evaluation";

const CALCULATED_AT = "2026-09-24T10:30:00+09:00";
const APPROVED_AT = "2026-09-24T14:10:00+09:00";

function makeRun(
  id: string,
  outcome: CompletionRun["outcome"],
  attendancePercent: number,
  creditedMinutes: [number, number],
  reasons: string[] = [],
): CompletionRun {
  return {
    id,
    input_revision: 3,
    outcome,
    reasons,
    calculated_by: "sample-calculator",
    calculated_at: CALCULATED_AT,
    evidence: {
      attendance_percent: attendancePercent,
      sessions: [
        {
          session_id: "sample-session-1",
          title: "1회차 · 기초 이론",
          minutes: 150,
          credited_minutes: creditedMinutes[0],
        },
        {
          session_id: "sample-session-2",
          title: "2회차 · 실습",
          minutes: 150,
          credited_minutes: creditedMinutes[1],
        },
      ],
      assignments: [
        {
          assignment_id: "sample-assignment",
          title: "실습 과제",
          revision: 1,
          score: outcome === "INELIGIBLE" ? 68 : 88,
        },
      ],
      quizzes: [
        {
          quiz_id: "sample-quiz",
          title: "과정 평가",
          status: "SUBMITTED",
          score: outcome === "INELIGIBLE" ? 72 : 91,
        },
      ],
    },
  };
}

export function createCompletionReviewPreview(): CompletionRow[] {
  return [
    {
      person_id: "sample-learner-1",
      name: "예시 수강생 1 · 수료 확정",
      enrollment_status: "ACTIVE",
      run: makeRun("sample-run-1", "READY", 90, [150, 120]),
      approval: { approved_at: APPROVED_AT },
      stale: false,
      attendance_percent: 90,
      attendance_threshold: 80,
      attendance_complete: true,
      attendance_eligible: true,
      refund: null,
      refund_document: null,
    },
    {
      person_id: "sample-learner-2",
      name: "예시 수강생 2 · 승인 대기",
      enrollment_status: "ACTIVE",
      run: makeRun("sample-run-2", "READY", 85, [150, 105]),
      approval: null,
      stale: false,
      attendance_percent: 85,
      attendance_threshold: 80,
      attendance_complete: true,
      attendance_eligible: true,
      refund: null,
      refund_document: null,
    },
    {
      person_id: "sample-learner-3",
      name: "예시 수강생 3 · 출석 기준 미달",
      enrollment_status: "ACTIVE",
      run: makeRun("sample-run-3", "INELIGIBLE", 70, [150, 60], [
        "출석률 또는 승인된 항목별 최소 점수에 미달합니다.",
      ]),
      approval: null,
      stale: false,
      attendance_percent: 70,
      attendance_threshold: 80,
      attendance_complete: true,
      attendance_eligible: false,
      refund: null,
      refund_document: null,
    },
    {
      person_id: "sample-learner-4",
      name: "예시 수강생 4 · 중도 환불",
      enrollment_status: "WITHDRAWN",
      run: makeRun("sample-run-4", "NEEDS_REVIEW", 50, [150, 0], [
        "수강등록이 활성 상태가 아닙니다.",
      ]),
      approval: null,
      stale: false,
      attendance_percent: 50,
      attendance_threshold: 80,
      attendance_complete: true,
      attendance_eligible: false,
      refund: { status: "PAID", requested_at: "2026-09-20T09:00:00+09:00" },
      refund_document: {
        status: "COMPLETED",
        submitted_at: "2026-09-19T11:20:00+09:00",
      },
    },
    {
      person_id: "sample-learner-5",
      name: "예시 수강생 5 · 출결 입력 중",
      enrollment_status: "ACTIVE",
      run: null,
      approval: null,
      stale: false,
      attendance_percent: 60,
      attendance_threshold: 80,
      attendance_complete: false,
      attendance_eligible: false,
      refund: null,
      refund_document: null,
    },
    {
      person_id: "sample-learner-6",
      name: "예시 수강생 6 · 재산출 필요",
      enrollment_status: "ACTIVE",
      run: makeRun("sample-run-6", "READY", 83.33, [150, 100]),
      approval: null,
      stale: true,
      attendance_percent: 83.33,
      attendance_threshold: 80,
      attendance_complete: true,
      attendance_eligible: true,
      refund: null,
      refund_document: null,
    },
  ];
}
