"use client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { BUDGET_FIELDS, BUDGET_KEYS, budgetTotal, won, type OperationCourse, type WorkbookSummary } from "@/lib/course-budget/model";
import { COMPARISON_FIELDS, COMPARISON_KEYS, compareExecution, executionSum, type ExecutionComparison } from "@/lib/course-budget/comparison";
import { ActionForm } from "@/components/portal/action-form";
import { saveCourseBudget } from "@/app/admin/courses/budget-actions";
import type { ExecutionSource } from "./execution-panel";

const ExecutionPanel = dynamic(() => import("./execution-panel").then(m => m.ExecutionPanel), { loading: () => <p role="status">엑셀 조회 화면을 준비하고 있습니다…</p> });

function ComparisonTotals({ courses, comparison, label }: { courses: OperationCourse[]; comparison: ExecutionComparison; label: string }) {
  const connected = courses.filter(c => comparison.entries[c.id]?.total != null).length;
  return <>
    <tr className="border-t border-current/10">
      <th rowSpan={2} colSpan={2} scope="rowgroup" className="p-3 text-left">{label}</th>
      <th scope="row" className="p-3 text-left">예산</th>
      {COMPARISON_KEYS.map(k => <td key={k} className="p-3 tabular-nums">{won(k === "banners" || courses.every(c => c.budget[k] === null) ? null : courses.reduce((sum, c) => sum + (c.budget[k] ?? 0), 0))}</td>)}
      <td className="p-3 tabular-nums">{won(courses.reduce((sum, c) => sum + budgetTotal(c.budget), 0))}</td><td rowSpan={2} />
    </tr>
    <tr className="border-t border-current/10">
      <th scope="row" className="whitespace-nowrap p-3 text-left">집행 <span className="block text-xs font-normal">{connected}/{courses.length}개 연결</span></th>
      {COMPARISON_KEYS.map(k => <td key={k} className="p-3 tabular-nums">{won(executionSum(courses, comparison, k))}</td>)}
      <td className="p-3 tabular-nums">{won(executionSum(courses, comparison, "total"))}</td>
    </tr>
  </>;
}

export function BudgetPanel({ courses, org, workbooks, year }: { courses: OperationCourse[]; org: string; workbooks: WorkbookSummary[]; year: number }) {
  const [selected, setSelected] = useState("");
  const [source, setSource] = useState<ExecutionSource>({ input: null, saved: false, busy: false, message: "" });
  const editor = useRef<HTMLElement>(null);
  useEffect(() => { if (selected) { editor.current?.scrollIntoView({ block: "center" }); editor.current?.querySelector<HTMLInputElement>('input[name="program_id"]')?.focus({ preventScroll: true }); } }, [selected]);
  const comparison = useMemo(() => compareExecution(courses, source.input), [courses, source.input]);
  const course = courses.find(c => c.id === selected);
  const academies = Array.from(new Set(courses.map(c => c.academy)));
  return <section className="space-y-5" aria-label="예산 및 집행현황">
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{year} 예산 및 집행현황</h2><span className="shrink-0 text-sm text-slate-500">단위: 원</span></div>
    {source.input && <p className="break-words text-xs text-slate-500">집행 자료: {source.input.file_name} · {source.input.sheet_name} · {source.saved ? "저장된 자료" : "저장 전 미리보기"}</p>}
    {source.busy && <p role="status" className="text-sm text-teal-800">집행 자료를 처리하고 있습니다…</p>}
    {!source.input && source.message && <p role="status" className="text-sm text-amber-800">{source.message} 아래 ‘집행 엑셀 자료’에서 확인해 주세요.</p>}
    {comparison.notices.length > 0 && <ul className="space-y-1 rounded-xl bg-amber-50 p-4 text-xs leading-6 text-amber-900" aria-label="집행 자료 확인 사항">{comparison.notices.map(notice => <li key={notice}>{notice}</li>)}</ul>}
    {course && <section ref={editor} key={`${org}:${course.id}:${course.budget.revision}`} className="rounded-2xl border border-teal-200 bg-teal-50/50 p-5" aria-label={`${course.name} 예산 수정`}>
      <div className="mb-4 flex justify-between gap-3"><h3 className="font-bold">{course.name} · 예산 수정</h3><button type="button" onClick={() => setSelected("")} className="text-sm text-slate-600">닫기</button></div>
      <ActionForm action={saveCourseBudget} label="예산 저장" resetOnSuccess={false}>
        <input type="hidden" name="org" value={org} /><input type="hidden" name="guide" value={course.id} /><input type="hidden" name="revision" value={course.budget.revision} />
        <label className="block max-w-sm text-sm font-semibold">프로그램 ID<input className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm mt-2" name="program_id" maxLength={40} defaultValue={course.budget.program_id} placeholder="예: C1-S3T4-2" /></label>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">{BUDGET_KEYS.map(key => <label key={key} className="text-sm font-semibold">{BUDGET_FIELDS[key]}<span className="ml-1 font-normal text-slate-500">(원)</span><input name={key} type="number" min={0} max={999999999999} step={1} className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm mt-2 text-right tabular-nums" defaultValue={course.budget[key] ?? ""} placeholder="미편성" /></label>)}</div>
        <p className="text-xs text-slate-500">빈칸은 미편성으로 저장됩니다. 0원은 숫자 0을 입력하세요.</p>
      </ActionForm>
    </section>}
    <div role="region" aria-label="과정별 예산 및 집행현황표" tabIndex={0} className="relative overflow-x-auto rounded-2xl border bg-white">
      <table className="w-full min-w-[1400px] text-right text-sm">
        <caption className="sr-only">{year}년 과정별 예산과 집행 비교, 아카데미 소계와 총계</caption>
        <thead className="bg-slate-50 text-xs text-slate-500"><tr><th scope="col" className="p-4 text-left">프로그램 ID</th><th scope="col" className="p-4 text-left">세부 프로그램</th><th scope="col" className="p-4 text-left">구분</th>{COMPARISON_KEYS.map(k => <th key={k} scope="col" className="whitespace-nowrap p-4">{COMPARISON_FIELDS[k]}</th>)}<th scope="col" className="p-4">총액</th><th scope="col" className="p-4">관리</th></tr></thead>
        {academies.map(academy => {
          const rows = courses.filter(c => c.academy === academy);
          return <Fragment key={academy}>
            <tbody><tr className="bg-teal-50"><th colSpan={12} className="p-3 text-left text-xs font-bold text-teal-900">{academy} · {rows.length}개 과정</th></tr></tbody>
            {rows.map(c => {
              const execution = comparison.entries[c.id];
              return <tbody key={c.id} className={`border-t border-slate-200 ${selected === c.id ? "bg-amber-50/50" : ""}`}>
                <tr>
                  <td rowSpan={2} className="whitespace-nowrap p-3 text-left font-mono text-xs">{c.budget.program_id || "미입력"}</td>
                  <th rowSpan={2} scope="rowgroup" className="min-w-52 p-3 text-left font-semibold">{c.name}{execution?.issue && <span className="mt-1 block text-xs font-normal text-amber-800">{execution.issue}</span>}</th>
                  <th scope="row" className="p-3 text-left text-xs font-semibold text-slate-600">예산</th>
                  {COMPARISON_KEYS.map(k => <td key={k} className="p-3 tabular-nums">{won(k === "banners" ? null : c.budget[k])}</td>)}
                  <td className="p-3 font-bold tabular-nums">{won(budgetTotal(c.budget))}</td>
                  <td rowSpan={2} className="p-3"><button type="button" className="whitespace-nowrap rounded-lg border border-teal-200 px-3 py-2 text-xs font-bold text-teal-800 hover:bg-teal-50" onClick={() => setSelected(c.id)}>수정<span className="sr-only"> · {c.name}</span></button></td>
                </tr>
                <tr className="border-t border-slate-100 bg-slate-50/80">
                  <th scope="row" className="p-3 text-left text-xs font-semibold text-teal-800">집행</th>
                  {COMPARISON_KEYS.map(k => <td key={k} className="p-3 tabular-nums text-slate-600">{won(execution?.values[k] ?? null)}</td>)}
                  <td className="p-3 font-bold tabular-nums text-teal-900">{won(execution?.total ?? null)}</td>
                </tr>
              </tbody>;
            })}
            <tbody className="bg-slate-100 font-semibold"><ComparisonTotals courses={rows} comparison={comparison} label="소계" /></tbody>
          </Fragment>;
        })}
        <tfoot className="bg-teal-900 font-bold text-white"><ComparisonTotals courses={courses} comparison={comparison} label="총계" /></tfoot>
      </table>
    </div>
    <p className="text-xs leading-6 text-slate-500">—: 미편성 또는 집행 자료 없음 · 집행 소계와 총계는 연결된 과정만 합산합니다.</p>
    <details className="rounded-2xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer font-bold text-teal-900">집행 엑셀 자료 · 선택 및 저장</summary><div className="mt-5"><ExecutionPanel workbooks={workbooks} org={org} onSourceChange={setSource} /></div></details>
    <details className="text-xs leading-6 text-slate-500"><summary className="cursor-pointer">초기 예산 자료 기준</summary><p className="mt-2">최초 자료의 건강식생활지도사 보조인력 1,023,300원을 포함한 항목 합계는 115,036,420원으로, 원문 총계 115,036,320원과 100원 차이가 있습니다. 초기 프로그램 ID: 라이프케어 C1-S3T4-2, 팝업 C1-S3T4-3, 로컬창업 C1-S4T5-3(제공 자료의 강조 행).</p></details>
  </section>;
}
