"use client";
import { useEffect, useRef, useState } from "react";
import { BUDGET_FIELDS, BUDGET_KEYS, budgetTotal, won, type OperationCourse } from "@/lib/course-budget/model";
import { ActionForm } from "@/components/portal/action-form";
import { saveCourseBudget } from "@/app/admin/courses/budget-actions";

export function BudgetPanel({ courses, org }: { courses: OperationCourse[]; org: string }) {
  const [selected, setSelected] = useState("");
  const editor = useRef<HTMLElement>(null);
  useEffect(() => { if (selected) { editor.current?.scrollIntoView({ block: "center" }); editor.current?.querySelector<HTMLInputElement>('input[name="program_id"]')?.focus({ preventScroll: true }); } }, [selected]);
  const course = courses.find(c => c.id === selected);
  const academies = Array.from(new Set(courses.map(c => c.academy)));
  return <section className="space-y-5" aria-label="예산 현황">
    <div><h2 className="text-xl font-bold">2026 예산 현황</h2><p className="mt-2 text-sm text-slate-500">단위: 원 · 초기값은 제공된 예산 현황표 기준입니다. 프로그램 ID와 항목별 예산을 수정할 수 있습니다.</p></div>
    {course && <section ref={editor} key={`${org}:${course.id}:${course.budget.revision}`} className="rounded-2xl border border-teal-200 bg-teal-50/50 p-5" aria-label={`${course.name} 예산 수정`}>
      <div className="mb-4 flex justify-between gap-3"><h3 className="font-bold">{course.name} · 예산 수정</h3><button type="button" onClick={() => setSelected("")} className="text-sm text-slate-600">닫기</button></div>
      <ActionForm action={saveCourseBudget} label="예산 저장" resetOnSuccess={false}>
        <input type="hidden" name="org" value={org} /><input type="hidden" name="guide" value={course.id} /><input type="hidden" name="revision" value={course.budget.revision} />
        <label className="block max-w-sm text-sm font-semibold">프로그램 ID<input className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm mt-2" name="program_id" maxLength={40} defaultValue={course.budget.program_id} placeholder="예: C1-S3T4-2" /></label>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">{BUDGET_KEYS.map(key => <label key={key} className="text-sm font-semibold">{BUDGET_FIELDS[key]}<span className="ml-1 font-normal text-slate-500">(원)</span><input name={key} type="number" min={0} max={999999999999} step={1} className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm mt-2 text-right tabular-nums" defaultValue={course.budget[key] ?? ""} placeholder="미편성" /></label>)}</div>
        <p className="text-xs text-slate-500">빈칸은 미편성으로 저장됩니다. 0원은 숫자 0을 입력하세요.</p>
      </ActionForm>
    </section>}
    <div role="region" aria-label="과정별 예산 현황표" tabIndex={0} className="relative overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[1250px] text-right text-sm"><caption className="sr-only">2026년 항목별 예산, 아카데미 소계와 총계</caption><thead className="bg-slate-50 text-xs text-slate-500"><tr><th scope="col" className="p-4 text-left">프로그램 ID</th><th scope="col" className="p-4 text-left">세부 프로그램</th>{BUDGET_KEYS.map(k => <th key={k} scope="col" className="whitespace-nowrap p-4">{BUDGET_FIELDS[k]}</th>)}<th scope="col" className="p-4">총액</th><th scope="col" className="p-4">관리</th></tr></thead>
      {academies.map(academy => { const rows = courses.filter(c => c.academy === academy); return <tbody key={academy} className="divide-y divide-slate-100"><tr className="bg-teal-50"><th colSpan={10} className="p-3 text-left text-xs font-bold text-teal-900">{academy} · {rows.length}개 과정</th></tr>{rows.map(c => <tr key={c.id} className={selected === c.id ? "bg-amber-50" : "hover:bg-slate-50"}><td className="whitespace-nowrap p-3 text-left font-mono text-xs">{c.budget.program_id || "미입력"}</td><th scope="row" className="min-w-52 p-3 text-left font-medium">{c.name}</th>{BUDGET_KEYS.map(k => <td key={k} className="p-3 tabular-nums">{won(c.budget[k])}</td>)}<td className="p-3 font-bold tabular-nums">{won(budgetTotal(c.budget))}</td><td className="p-3"><button type="button" className="whitespace-nowrap rounded-lg border border-teal-200 px-3 py-2 text-xs font-bold text-teal-800 hover:bg-teal-50" onClick={() => { setSelected(c.id); }}>수정<span className="sr-only"> · {c.name}</span></button></td></tr>)}<tr className="bg-slate-50 font-semibold"><th colSpan={2} className="p-3 text-left">소계</th>{BUDGET_KEYS.map(k => <td key={k} className="p-3 tabular-nums">{won(rows.reduce((sum, c) => sum + (c.budget[k] ?? 0), 0))}</td>)}<td className="p-3 tabular-nums">{won(rows.reduce((sum, c) => sum + budgetTotal(c.budget), 0))}</td><td /></tr></tbody>; })}
      <tfoot className="bg-teal-900 font-bold text-white"><tr><th colSpan={2} className="p-4 text-left">총계</th>{BUDGET_KEYS.map(k => <td key={k} className="p-4 tabular-nums">{won(courses.reduce((sum, c) => sum + (c.budget[k] ?? 0), 0))}</td>)}<td className="p-4 tabular-nums">{won(courses.reduce((sum, c) => sum + budgetTotal(c.budget), 0))}</td><td /></tr></tfoot></table></div>
    <p className="text-xs leading-6 text-slate-500">—: 원문 미편성 · 총액은 항목별 입력값을 합산합니다. 최초 자료의 건강식생활지도사 보조인력 1,023,300원을 포함한 항목 합계는 115,036,420원으로, 원문 총계 115,036,320원과 100원 차이가 있습니다. 초기 프로그램 ID: 라이프케어 C1-S3T4-2, 팝업 C1-S3T4-3, 로컬창업 C1-S4T5-3(제공 자료의 강조 행).</p>
  </section>;
}
