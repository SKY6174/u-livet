"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveMonitoringPlan } from "@/app/admin/monitoring/actions";
import type { MonitoringCourse } from "./course-monitoring-dashboard";
import {
  monitoringSignal, overlapsMonth, parseGuidePeriod,
  type MonitoringDocument, type MonitoringGuide, type MonitoringPlan,
  type MonitoringSignal,
} from "@/lib/course-monitoring/model";

const SIGNALS: { key: MonitoringSignal; label: string; dot: string; border: string; text: string }[] = [
  { key: "normal", label: "정상", dot: "bg-emerald-600", border: "border-emerald-200", text: "text-emerald-800" },
  { key: "late", label: "지연", dot: "bg-amber-500", border: "border-amber-200", text: "text-amber-800" },
  { key: "blocked", label: "애로", dot: "bg-red-600", border: "border-red-200", text: "text-red-800" },
  { key: "unplanned", label: "계획전", dot: "bg-slate-900", border: "border-slate-300", text: "text-slate-800" },
];

const DATE_FIELDS = [
  { key: "plan_due_on", label: "P 계획 목표일" },
  { key: "plan_done_on", label: "P 계획 완료일" },
  { key: "delivery_starts_on", label: "D 운영 시작 목표일" },
  { key: "delivery_ends_on", label: "D 운영 종료 목표일" },
  { key: "check_due_on", label: "C 점검 목표일" },
  { key: "check_done_on", label: "C 점검 완료일" },
  { key: "act_due_on", label: "A 개선 목표일" },
  { key: "act_done_on", label: "A 개선 완료일" },
] as const;
type DateKey = (typeof DATE_FIELDS)[number]["key"];
type Draft = {
  dates: Record<DateKey, string>;
  blocked: boolean;
  issueNote: string;
  actionNote: string;
};

function draftFor(guide: MonitoringGuide, plan: MonitoringPlan | null): Draft {
  const reference = parseGuidePeriod(guide.period_label, guide.year);
  const dates = {} as Record<DateKey, string>;
  for (const field of DATE_FIELDS) dates[field.key] = plan?.[field.key] ?? "";
  if (!plan) {
    dates.delivery_starts_on = reference.start ?? "";
    dates.delivery_ends_on = reference.end ?? "";
  }
  return { dates, blocked: plan?.blocked ?? false, issueNote: plan?.issue_note ?? "", actionNote: plan?.action_note ?? "" };
}

function dateLabel(value: string | null | undefined) {
  return value ? value.replaceAll("-", ".") : "미설정";
}

function DocumentStatus({ label, status }: { label: string; status: string | null | undefined }) {
  return <span className="text-xs text-slate-600">{label} {status === "REVIEW" ? "검토 완료" : status === "SUBMITTED" ? "제출" : status === "DRAFT" ? "작성 중" : status ?? "미작성"}</span>;
}

export function CourseMonitoringPlanDashboard({ guides, plans, documents, courses, today }: {
  guides: MonitoringGuide[];
  plans: MonitoringPlan[];
  documents: MonitoringDocument[];
  courses: MonitoringCourse[];
  today: string;
}) {
  const router = useRouter();
  const [localPlans, setLocalPlans] = useState(plans);
  const [academy, setAcademy] = useState("all");
  const [monthFilter, setMonthFilter] = useState(0);
  const [signalFilter, setSignalFilter] = useState<MonitoringSignal | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, startSave] = useTransition();

  const planByGuide = useMemo(() => new Map(localPlans.map((plan) => [plan.guide_id, plan])), [localPlans]);
  const actualById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const documentById = useMemo(() => new Map(documents.map((document) => [document.id, document])), [documents]);
  const academies = useMemo(() => Array.from(new Set(guides.map((guide) => guide.academy))), [guides]);
  const rows = useMemo(() => guides.map((guide) => {
    const plan = planByGuide.get(guide.id) ?? null;
    const actual = guide.offering_id ? actualById.get(guide.offering_id) ?? null : null;
    const document = actual ? documentById.get(actual.id) ?? null : null;
    return { guide, plan, actual, document,
      verdict: monitoringSignal(plan, actual, today, document), reference: parseGuidePeriod(guide.period_label, guide.year) };
  }), [guides, planByGuide, actualById, documentById, today]);
  const scoped = rows.filter(({ guide, plan, actual, reference }) => (academy === "all" || guide.academy === academy) &&
    (!monthFilter || overlapsMonth(plan?.delivery_starts_on ?? reference.start, plan?.delivery_ends_on ?? reference.end, guide.year, monthFilter) ||
      overlapsMonth(actual?.starts_on ?? null, actual?.ends_on ?? null, guide.year, monthFilter) ||
      reference.tentativeMonth === monthFilter ||
      [plan?.plan_due_on, plan?.check_due_on, plan?.act_due_on].some((date) => date?.startsWith(`${guide.year}-${String(monthFilter).padStart(2, "0")}-`))) &&
    (!query.trim() || `${guide.name} ${guide.academy}`.toLocaleLowerCase("ko-KR").includes(query.trim().toLocaleLowerCase("ko-KR"))));
  const visible = scoped.filter((row) => signalFilter === "all" || row.verdict.signal === signalFilter);
  const selected = rows.find((row) => row.guide.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId) document.getElementById("pdca-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedId]);

  function openEditor(guide: MonitoringGuide, plan: MonitoringPlan | null) {
    setSelectedId(guide.id);
    setDraft(draftFor(guide, plan));
    setSaveMessage("");
  }

  function save() {
    if (!selected || !draft) return;
    setSaveMessage("");
    startSave(async () => {
      const result = await saveMonitoringPlan({ guideId: selected.guide.id, revision: selected.plan?.revision ?? 0,
        dates: draft.dates, blocked: draft.blocked, issueNote: draft.issueNote, actionNote: draft.actionNote });
      if (!result.ok) { setSaveMessage(result.error); return; }
      setLocalPlans((current) => [...current.filter((plan) => plan.guide_id !== result.plan.guide_id), result.plan]);
      setSaveMessage("PDCA 계획과 진행 기록을 저장했습니다.");
      router.refresh();
    });
  }

  return <section aria-label="연간 일정과 PDCA 진행 신호등" className="mb-10 space-y-6">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-teal-800">Annual plan · PDCA</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">2026년 16개 과정 연간 일정</h2>
          <p className="mt-2 text-sm text-slate-600">월별 교육기간과 P 계획 · D 운영 · C 점검 · A 개선의 목표일을 함께 확인합니다.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">서울 기준 {dateLabel(today)}</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="진행 신호등">
        {SIGNALS.map((item) => {
          const count = scoped.filter((row) => row.verdict.signal === item.key).length;
          const active = signalFilter === item.key;
          return <button key={item.key} type="button" aria-pressed={active}
            onClick={() => setSignalFilter(active ? "all" : item.key)}
            className={`flex items-center gap-3 rounded-2xl border bg-white p-4 text-left transition hover:shadow-sm ${item.border} ${active ? "ring-2 ring-teal-700" : ""}`}>
            <span aria-hidden="true" className={`h-9 w-9 shrink-0 rounded-full border-4 border-white shadow ring-1 ring-slate-200 ${item.dot}`} />
            <span className="min-w-0"><span className={`block text-sm font-semibold ${item.text}`}>{item.label}</span>
              <strong className="text-2xl tabular-nums text-slate-900">{count}</strong><span className="ml-1 text-xs text-slate-500">개 과정</span></span>
          </button>;
        })}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">정상: 확정된 일정에서 지연 없음 · 지연: 목표일 미준수 · 애로: 담당자가 사유를 등록 · 계획전: P/D/C/A 목표일 미확정. 신호등을 누르면 해당 과정만 표시됩니다.</p>
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-5">
        <div className="mr-auto"><h3 className="font-bold text-slate-900">연간 일정표</h3>
          <p className="mt-1 text-xs text-slate-600">진한 D는 확정 목표, 옅은 D는 공개 안내 참고, 테두리 있는 ‘실제’는 등록된 운영기간입니다.</p></div>
        <label className="text-xs font-semibold text-slate-600">월
          <select value={monthFilter} onChange={(event) => setMonthFilter(Number(event.target.value))} className="mt-1 block min-w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value={0}>전체 월</option>{Array.from({ length: 12 }, (_, index) => <option key={index} value={index + 1}>{index + 1}월</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">분야
          <select value={academy} onChange={(event) => setAcademy(event.target.value)} className="mt-1 block min-w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="all">전체 분야</option>{academies.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">과정 검색
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="과정명 검색" className="mt-1 block w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        {signalFilter !== "all" && <button type="button" onClick={() => setSignalFilter("all")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">신호등 필터 해제</button>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1250px] border-collapse text-sm">
          <caption className="sr-only">2026년 과정별 월간 교육기간 및 PDCA 목표 일정</caption>
          <thead className="bg-slate-50 text-xs text-slate-600"><tr>
            <th scope="col" className="sticky left-0 z-10 w-64 min-w-64 border-r border-slate-200 bg-slate-50 px-4 py-3 text-left">과정 · 신호등</th>
            {Array.from({ length: 12 }, (_, index) => <th scope="col" key={index} className="w-[7%] border-r border-slate-100 px-1 py-3 text-center">{index + 1}월</th>)}
            <th scope="col" className="w-20 px-3 py-3 text-center">상세</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map(({ guide, plan, actual, verdict, reference }) => {
              const signal = SIGNALS.find((item) => item.key === verdict.signal)!;
              const start = plan?.delivery_starts_on ?? reference.start;
              const end = plan?.delivery_ends_on ?? reference.end;
              return <tr key={guide.id} className="hover:bg-slate-50/60">
                <th scope="row" className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3 text-left font-normal">
                  <span className="flex items-start gap-2"><span aria-hidden="true" className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${signal.dot}`} />
                    <span><span className="block break-keep font-semibold text-slate-900">{guide.name}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{guide.academy} · {signal.label}{actual ? " · 개설" : " · 미개설"}</span></span></span>
                </th>
                {Array.from({ length: 12 }, (_, index) => {
                  const month = index + 1;
                  const inDelivery = overlapsMonth(start, end, guide.year, month);
                  const tentative = !start && reference.tentativeMonth === month;
                  const markers = ([
                    ["P", plan?.plan_due_on], ["C", plan?.check_due_on], ["A", plan?.act_due_on],
                  ] as const).filter(([, date]) => date?.startsWith(`${guide.year}-${String(month).padStart(2, "0")}-`)).map(([phase]) => phase);
                  const inActual = overlapsMonth(actual?.starts_on ?? null, actual?.ends_on ?? null, guide.year, month);
                  return <td key={month} className="border-r border-slate-100 px-1 py-2 text-center">
                    <div title={inDelivery ? `${plan ? "D 목표" : "안내 참고"}: ${start} ~ ${end}` : tentative ? guide.period_label : markers.join(" · ")}
                      className={`min-h-6 rounded-md px-0.5 py-1 text-[10px] font-semibold ${inDelivery ? plan ? "bg-teal-700 text-white" : "bg-teal-100 text-teal-900" : tentative ? "border border-dashed border-teal-300 bg-teal-50 text-teal-800" : "text-slate-500"}`}>
                      {inDelivery ? "D" : tentative ? "예정" : markers.join("·")}
                      {inDelivery && markers.length > 0 && <span className={`block whitespace-nowrap ${plan ? "text-white" : "text-slate-700"}`}>{markers.join("·")}</span>}
                    </div>
                    {inActual && <div title={`실제 운영: ${actual?.starts_on} ~ ${actual?.ends_on}`} className="mt-1 rounded border border-teal-700 bg-white px-0.5 py-0.5 text-[9px] font-semibold text-teal-800">실제</div>}
                  </td>;
                })}
                <td className="px-2 py-2 text-center"><button type="button" onClick={() => openEditor(guide, plan)}
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50">PDCA</button></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-600" role="status">표시 과정 {visible.length} / {guides.length}개 · 목표 일정 미확정 과정은 공개 안내 기간을 참고로 표시합니다.</p>
      {!visible.length && <p className="px-5 pb-5 text-sm text-slate-600">조건에 맞는 과정이 없습니다. 필터를 변경해 주세요.</p>}
    </div>

    {selected && draft && <div id="pdca-editor" className="rounded-2xl border border-teal-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-teal-800">Course PDCA</p>
          <h3 className="mt-1 text-xl font-bold">{selected.guide.name}</h3>
          <p className="mt-1 text-sm text-slate-600">{selected.verdict.reason}</p></div>
        <button type="button" onClick={() => { setSelectedId(null); setDraft(null); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">닫기</button>
      </div>
      <div className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><strong className="block text-slate-900">P 계획</strong><span className="text-slate-600">목표 {dateLabel(selected.plan?.plan_due_on)} · 완료 {dateLabel(selected.plan?.plan_done_on)}</span></div>
        <div><strong className="block text-slate-900">D 운영</strong><span className="text-slate-600">목표 {dateLabel(selected.plan?.delivery_starts_on)} ~ {dateLabel(selected.plan?.delivery_ends_on)}</span></div>
        <div><strong className="block text-slate-900">C 점검</strong><span className="text-slate-600">목표 {dateLabel(selected.plan?.check_due_on)} · 완료 {dateLabel(selected.plan?.check_done_on)}</span></div>
        <div><strong className="block text-slate-900">A 개선</strong><span className="text-slate-600">목표 {dateLabel(selected.plan?.act_due_on)} · 완료 {dateLabel(selected.plan?.act_done_on)}</span></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-700">
        <span>공개 안내: {selected.guide.period_label}</span>
        <span>실제 개설: {selected.actual ? `${dateLabel(selected.actual.starts_on)} ~ ${dateLabel(selected.actual.ends_on)}` : "미등록"}</span>
        {selected.actual && <span>수업 종료 {selected.actual.ended_sessions}/{selected.actual.scheduled_sessions}회 · 출결 미입력 {selected.actual.missing_attendance}건</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
        <DocumentStatus label="운영 계획서" status={selected.document?.plan_status} />
        <DocumentStatus label="운영 결과보고서" status={selected.document?.result_status} />
        {selected.actual ? <Link href={`/admin/offerings/${selected.actual.id}`} className="text-xs font-semibold text-teal-800 hover:underline">과정 운영 보기 →</Link>
          : <Link href="/admin/course-plan/opening" className="text-xs font-semibold text-teal-800 hover:underline">과정 개설로 이동 →</Link>}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {DATE_FIELDS.map((field) => <label key={field.key} className="text-xs font-semibold text-slate-600">{field.label}
          <input type="date" value={draft.dates[field.key]} onChange={(event) => setDraft((current) => current ? {
            ...current, dates: { ...current.dates, [field.key]: event.target.value },
          } : current)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" />
        </label>)}
      </div>
      <p className="mt-3 text-xs text-slate-600">D 운영 목표일은 공개 안내의 정확한 기간이 있는 경우에만 입력 제안됩니다. P·C·A 목표일은 담당자가 확인해 확정하세요. 목표 순서는 P → D → C → A입니다.</p>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700"><span className="flex items-center gap-2"><input type="checkbox" checked={draft.blocked}
          onChange={(event) => setDraft((current) => current ? { ...current, blocked: event.target.checked } : current)} />애로 등록</span>
          <textarea value={draft.issueNote} onChange={(event) => setDraft((current) => current ? { ...current, issueNote: event.target.value } : current)}
            maxLength={1000} rows={3} placeholder="애로 사유를 구체적으로 적어 주세요." className="mt-2 block w-full rounded-lg border border-slate-300 p-3 text-sm font-normal" />
        </label>
        <label className="text-sm font-semibold text-slate-700">조치·개선 기록
          <textarea value={draft.actionNote} onChange={(event) => setDraft((current) => current ? { ...current, actionNote: event.target.value } : current)}
            maxLength={2000} rows={3} placeholder="담당자 조치와 개선 결과를 적어 주세요." className="mt-2 block w-full rounded-lg border border-slate-300 p-3 text-sm font-normal" />
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" disabled={saving} onClick={save} className="btn-primary disabled:opacity-50">{saving ? "저장 중…" : "PDCA 계획·기록 저장"}</button>
        <span role="status" className="text-sm text-slate-700">{saveMessage}</span>
      </div>
    </div>}
  </section>;
}
