export const ANCHOR_ORG_ID = "10000000-0000-4000-8000-000000000001";
export const ANNUAL_MONTHS = Array.from({ length: 14 }, (_, index) => {
  const year = 2026 + Math.floor(index / 12);
  const month = index % 12 + 1;
  return { year, month, key: `${year}-${String(month).padStart(2, "0")}`, label: `'${String(year).slice(2)}.${month}월` };
});

export type NextYearDecision = "UNDECIDED" | "CONTINUE" | "REVISE" | "STOP";

export type MonitoringPlan = {
  org_id: string;
  guide_id: string;
  plan_due_on: string | null;
  plan_done_on: string | null;
  preparation_due_on: string | null;
  preparation_done_on: string | null;
  operation_plan_due_on: string | null;
  operation_plan_done_on: string | null;
  recruitment_due_on: string | null;
  recruitment_done_on: string | null;
  delivery_starts_on: string | null;
  delivery_ends_on: string | null;
  check_due_on: string | null;
  check_done_on: string | null;
  act_due_on: string | null;
  act_done_on: string | null;
  blocked: boolean;
  issue_note: string;
  action_note: string;
  next_year_decision: NextYearDecision;
  self_evaluation_target_count: 1 | 2;
  self_evaluation_first_on: string | null;
  self_evaluation_second_on: string | null;
  business_evaluation_on: string | null;
  revision: number;
  updated_at: string;
};

export type MonitoringGuide = {
  id: string;
  year: number;
  sort_order: number;
  name: string;
  academy: string;
  period_label: string;
  offering_id: string | null;
};

export type MonitoringDocument = {
  id: string;
  plan_status: string | null;
  result_status: string | null;
};

export type MonitoringActual = {
  id: string;
  status: string;
  starts_on: string;
  ends_on: string;
  scheduled_sessions: number;
  ended_sessions: number;
  enrolled: number;
  attendance_recorded: number;
  missing_attendance: number;
  completion_pending: number;
};

export type MonitoringSignal = "normal" | "late" | "blocked" | "unplanned";

export type MonitoringProgress = {
  P: { percent: number; reason: string };
  D: { percent: number; reason: string };
  C: { percent: number; reason: string };
  A: { percent: number; reason: string };
};

export function monitoringProgress(plan: MonitoringPlan | null, actual: MonitoringActual | null,
  document: MonitoringDocument | null): MonitoringProgress {
  const planApproved = document?.plan_status === "SUBMITTED";
  const recruitmentComplete = Boolean(plan?.recruitment_done_on ||
    actual?.status === "CLOSED" || actual?.status === "ARCHIVED");
  const pPercent = planApproved ? recruitmentComplete ? 100 : 50 : 0;

  const scheduled = Math.max(0, actual?.scheduled_sessions ?? 0);
  const enrolled = Math.max(0, actual?.enrolled ?? 0);
  const recorded = Math.max(0, actual?.attendance_recorded ?? 0);
  const expected = scheduled * enrolled;
  const dPercent = expected > 0 ? Math.min(100, Math.floor(recorded / expected * 100)) : 0;

  const reportSubmitted = document?.result_status === "REVIEW" || document?.result_status === "SUBMITTED";
  const target = plan?.self_evaluation_target_count === 2 ? 2 : 1;
  const held = Number(Boolean(plan?.self_evaluation_first_on)) + Number(Boolean(plan?.self_evaluation_second_on));
  const cPercent = reportSubmitted ? held >= target ? 100 : 75 : 0;
  const aComplete = Boolean(plan?.business_evaluation_on || held > 0);

  return {
    P: { percent: pPercent, reason: planApproved
      ? recruitmentComplete ? "운영계획서 승인·수강생 모집 완료" : "운영계획서 승인 완료 · 모집 진행 중"
      : "운영계획서 승인 대기" },
    D: { percent: dPercent, reason: expected > 0
      ? `출결 ${Math.min(recorded, expected)}/${expected}건 · 종료 ${actual?.ended_sessions ?? 0}/${scheduled}회`
      : "수강생 또는 운영회차 미등록" },
    C: { percent: cPercent, reason: reportSubmitted
      ? `결과보고서 제출 · 자체평가 ${held}/${target}회` : `결과보고서 제출 대기 · 자체평가 ${held}/${target}회` },
    A: { percent: aComplete ? 100 : 0, reason: `${plan?.business_evaluation_on
      ? "사업단 주관 성과평가 완료" : held > 0 ? "자체평가회 수행 완료" : "성과평가회 수행 대기"}${aComplete &&
      (plan?.next_year_decision === "UNDECIDED" || !plan?.action_note.trim()) ? " · 차년도 반영 기록 대기" : ""}` },
  };
}

export function parseGuidePeriod(label: string, year: number) {
  const exact = label.match(/^(\d{4})\.(\d{2})\.(\d{2})[–-](?:(\d{4})\.)?(\d{2})\.(\d{2})$/);
  if (exact) {
    const start = `${exact[1]}-${exact[2]}-${exact[3]}`;
    const end = `${exact[4] ?? exact[1]}-${exact[5]}-${exact[6]}`;
    if (Number(exact[1]) === year && !Number.isNaN(Date.parse(start)) && !Number.isNaN(Date.parse(end)))
      return { start, end, tentativeMonth: null };
  }
  const tentative = label.match(/^(\d{4})년\s*(\d{1,2})월\s*예정$/);
  return { start: null, end: null, tentativeMonth: tentative && Number(tentative[1]) === year ? Number(tentative[2]) : null };
}

export function monitoringSignal(plan: MonitoringPlan | null, actual: MonitoringActual | null, today: string,
  document?: MonitoringDocument | null) {
  if (plan?.blocked) return { signal: "blocked" as const, reason: plan.issue_note.trim() };
  if (!plan?.preparation_due_on || !plan.operation_plan_due_on || !plan.recruitment_due_on ||
      !plan.delivery_starts_on || !plan.delivery_ends_on || !plan.check_due_on || !plan.act_due_on)
    return { signal: "unplanned" as const, reason: "과정준비·운영계획서 제출·수강생모집과 D·C·A 목표일을 확정해 주세요." };
  const progress = monitoringProgress(plan, actual, document ?? null);
  const recruitmentComplete = Boolean(plan.recruitment_done_on ||
    actual?.status === "CLOSED" || actual?.status === "ARCHIVED");
  const milestones = [
    ["P 과정준비", plan.preparation_due_on, plan.preparation_done_on, Boolean(plan.preparation_done_on)],
    ["P 운영계획서 제출", plan.operation_plan_due_on, plan.operation_plan_done_on, document?.plan_status === "SUBMITTED"],
    ["P 수강생모집", plan.recruitment_due_on, plan.recruitment_done_on, recruitmentComplete],
    ["C 과정별 성과평가", plan.check_due_on, plan.check_done_on, progress.C.percent === 100],
    ["A 차년도 운영 반영", plan.act_due_on, plan.act_done_on, progress.A.percent === 100],
  ] as const;
  for (const [label, due, done, evidenced] of milestones) {
    if (done && done > due) return { signal: "late" as const, reason: `${label} 완료일이 목표일보다 늦었습니다.` };
    if (!evidenced && due < today) return { signal: "late" as const, reason: `${label} 목표일이 지났지만 완료 근거가 없습니다.` };
  }
  if ((!actual || actual.status === "DRAFT") && plan.delivery_starts_on < today)
    return { signal: "late" as const, reason: "D 운영 시작 목표일이 지났지만 과정이 개설되지 않았습니다." };
  if (actual && actual.starts_on > plan.delivery_starts_on)
    return { signal: "late" as const, reason: "실제 개강일이 D 운영 시작 목표일보다 늦습니다." };
  if (actual && actual.ends_on > plan.delivery_ends_on)
    return { signal: "late" as const, reason: "등록된 종료일이 D 운영 종료 목표일보다 늦습니다." };
  if (actual && actual.status !== "ARCHIVED" && plan.delivery_starts_on < today && actual.scheduled_sessions === 0)
    return { signal: "late" as const, reason: "D 운영 시작 목표일이 지났지만 수업 일정이 등록되지 않았습니다." };
  if (actual && plan.delivery_ends_on < today &&
    (progress.D.percent < 100 || actual.ended_sessions < actual.scheduled_sessions))
    return { signal: "late" as const, reason: "D 운영 종료 목표일이 지났지만 수업·출석부가 완료되지 않았습니다." };
  if (plan.act_done_on && (plan.next_year_decision === "UNDECIDED" || !plan.action_note.trim()))
    return { signal: "unplanned" as const, reason: "A 완료에 차년도 운영 판단과 반영 내용을 기록해 주세요." };
  if (plan.act_due_on < today && (plan.next_year_decision === "UNDECIDED" || !plan.action_note.trim()))
    return { signal: "late" as const, reason: "차년도 과정운영 판단과 반영 내용을 기록할 목표일이 지났습니다." };
  return { signal: "normal" as const, reason: "확정된 P·D·C·A 일정에서 확인된 지연이 없습니다." };
}

export function overlapsMonth(start: string | null, end: string | null, year: number, month: number) {
  if (!start || !end) return false;
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;
  return start <= monthEnd && end >= monthStart;
}
