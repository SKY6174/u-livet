export const ANCHOR_ORG_ID = "10000000-0000-4000-8000-000000000001";

export type MonitoringPlan = {
  org_id: string;
  guide_id: string;
  plan_due_on: string | null;
  plan_done_on: string | null;
  delivery_starts_on: string | null;
  delivery_ends_on: string | null;
  check_due_on: string | null;
  check_done_on: string | null;
  act_due_on: string | null;
  act_done_on: string | null;
  blocked: boolean;
  issue_note: string;
  action_note: string;
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
  missing_attendance: number;
  completion_pending: number;
};

export type MonitoringSignal = "normal" | "late" | "blocked" | "unplanned";

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
  if (!plan?.plan_due_on || !plan.delivery_starts_on || !plan.delivery_ends_on || !plan.check_due_on || !plan.act_due_on)
    return { signal: "unplanned" as const, reason: "P·D·C·A 목표일을 확정해 주세요." };
  const milestones = [
    ["P 계획", plan.plan_due_on, plan.plan_done_on],
    ["C 점검", plan.check_due_on, plan.check_done_on],
    ["A 개선", plan.act_due_on, plan.act_done_on],
  ] as const;
  for (const [label, due, done] of milestones) {
    if (done && done > due) return { signal: "late" as const, reason: `${label} 완료일이 목표일보다 늦었습니다.` };
    if (!done && due < today) return { signal: "late" as const, reason: `${label} 목표일이 지났습니다.` };
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
    (actual.ended_sessions < actual.scheduled_sessions ||
      (actual.status !== "ARCHIVED" && document?.result_status !== "SUBMITTED")))
    return { signal: "late" as const, reason: "D 운영 종료 목표일이 지났지만 수업·결과보고가 완료되지 않았습니다." };
  return { signal: "normal" as const, reason: "확정된 P·D·C·A 일정에서 확인된 지연이 없습니다." };
}

export function overlapsMonth(start: string | null, end: string | null, year: number, month: number) {
  if (!start || !end) return false;
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;
  return start <= monthEnd && end >= monthStart;
}
