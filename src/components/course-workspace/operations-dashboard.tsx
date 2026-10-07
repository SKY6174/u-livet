"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, LayoutGrid, List, Search } from "lucide-react";
import { type OperationCourse, type WorkbookSummary } from "@/lib/course-budget/model";
import { BudgetPanel } from "./budget-panel";

const status = (c: OperationCourse) => c.workspace?.status ?? "DRAFT";
const stateLabel = (c: OperationCourse) => ({ DRAFT: "개설 준비", ARCHIVED: "운영 완료·보관", PUBLISHED: "모집 공개", CLOSED: "모집 종료" })[status(c)] ?? "개설 준비";
function CourseActions({ course: c, manager, org }: { course: OperationCourse; manager: boolean; org: string }) {
  return <div className="flex flex-wrap gap-3 text-sm font-semibold text-teal-800">
    {manager && (c.workspace ? <Link className="hover:underline" href={`/admin/offerings/${c.workspace.id}`}>과정 정보 관리 →</Link> : c.source_id && <Link className="hover:underline" href={`/admin/courses?org=${org}&plan=${c.source_id}#offering-draft`}>과정 개설 준비 →</Link>)}
    {manager && c.workspace && <Link className="hover:underline" href={`/admin/offerings/${c.workspace.id}/manage#instructors`}>강사 배정 →</Link>}
    {manager && c.workspace && <Link className="hover:underline" href={`/operation-documents/${c.workspace.id}/plan`}>운영계획서 작성 →</Link>}
    <Link className="hover:underline" href={`/courses/${c.id}`}>수강생 화면 보기</Link>
    {manager && c.workspace?.report_revision && <Link className="hover:underline" href={`/admin/offerings/${c.workspace.id}/reports`}>증빙·지급자료</Link>}
  </div>;
}
type OrganizationOption = { id: string; name: string };

export function OperationsDashboard({
  courses,
  workbooks,
  org,
  manager,
  responsibleNames,
  organizations,
  years,
  selectedYear,
}: {
  courses: OperationCourse[];
  workbooks: WorkbookSummary[];
  org: string;
  manager: boolean;
  responsibleNames: Record<string, string | null> | null;
  organizations: OrganizationOption[];
  years: number[];
  selectedYear: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState("courses");
  const [view, setView] = useState("cards");
  const [query, setQuery] = useState("");
  const [year, setYear] = useState(String(selectedYear));
  const [academy, setAcademy] = useState("");
  const [filter, setFilter] = useState("all");
  const matches = (c: OperationCourse) => filter === "all" || (filter === "active" ? ["PUBLISHED", "CLOSED"].includes(status(c)) : status(c) === filter);
  const responsibleLabel = (c: OperationCourse) => {
    if (c.workspace && responsibleNames === null) return c.initial_responsible_name
      ? `${c.initial_responsible_name} · 초기 지정 (현재 책임강사 확인 불가)`
      : "확인 불가";
    if (c.workspace && responsibleNames?.[c.workspace.id]) return responsibleNames[c.workspace.id];
    if (!c.initial_responsible_name) return c.workspace ? "미지정" : "과정 개설 전";
    const basis = c.initial_responsible_basis === "CENTER_DIRECTOR" ? "센터장" : "첫 교내 강사";
    return `${c.initial_responsible_name} · ${basis}${c.initial_responsible_verified ? "" : " · 계정 인증 전"}${c.workspace ? " · 책임강사 지정 대기" : " · 과정 개설 전"}`;
  };
  const initialInstructorLabel = (c: OperationCourse) => c.initial_instructor_name
    ? `${c.initial_instructor_name}${c.initial_instructor_verified ? "" : " · 계정 인증 전"}`
    : "교내 강사 없음";
  const selectedYearNumber = Number(year);
  const academies = useMemo(
    () => Array.from(new Set(courses.map((course) => course.academy).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ko")),
    [courses],
  );
  const scopedCourses = useMemo(() => courses.filter((course) => !year || course.year === selectedYearNumber), [courses, selectedYearNumber, year]);
  const visible = scopedCourses.filter(c => matches(c) && (!academy || c.academy === academy) && `${c.name} ${c.budget.program_id} ${c.teachers} ${c.support_staff} ${responsibleLabel(c)} ${initialInstructorLabel(c)}`.toLowerCase().replace(/\s/g, "").includes(query.trim().toLowerCase().replace(/\s/g, "")));
  const stats = [
    [`${selectedYearNumber}년 과정`, `${scopedCourses.length}개`, "text-slate-900"],
    ["모집·운영 중", `${scopedCourses.filter((course) => ["PUBLISHED", "CLOSED"].includes(status(course))).length}개`, "text-teal-900"],
    ["개설 준비", `${scopedCourses.filter((course) => status(course) === "DRAFT").length}개`, "text-amber-900"],
    ["운영 완료·보관", `${scopedCourses.filter((course) => status(course) === "ARCHIVED").length}개`, "text-slate-700"],
    ["DB 이관 대기", `${scopedCourses.filter((course) => !course.workspace).length}개`, "text-slate-700"],
  ] as const;
  return <section className="space-y-6" aria-label={`${selectedYearNumber}년 과정 운영 및 예산`}>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {stats.map(([label, value, color]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className={`text-xs font-semibold ${label === "개설 준비" ? "text-amber-700" : label === "모집·운영 중" ? "text-teal-700" : "text-slate-500"}`}>{label}</p><p className={`mt-2 text-2xl font-bold tabular-nums ${color}`}>{value}</p></div>)}
    </div>
    <div role="group" aria-label="과정 관리 화면" className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
      {[["courses", "과정 목록"], ["budget", "예산 및 집행현황"]].map(([value, label]) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={`rounded-xl px-5 py-3 text-sm font-bold ${tab === value ? "bg-teal-800 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-teal-50"}`}>{label}</button>)}
      {manager && <Link className="ml-auto inline-flex min-h-11 items-center rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700" href={`/admin/courses?org=${org}&year=${year}&create=1#new-course`}>새 과정 등록</Link>}
    </div>
    {tab === "courses" && <>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-56 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm focus-within:border-teal-600 focus-within:ring-1 focus-within:ring-teal-600"><Search size={18} className="text-slate-400" /><span className="sr-only">과정 검색</span><input className="w-full border-0 bg-transparent py-3 text-sm outline-none placeholder:text-slate-400" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="프로그램 ID·과정명·강사 검색" /></label>
        <label><span className="sr-only">운영 기관</span><select className="w-full min-w-36 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 shadow-sm focus:border-teal-600 focus:outline-none" value={org} onChange={e => { if (e.target.value !== org) router.push(`/admin/courses?org=${e.target.value}&year=${year}`); }}>{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><span className="sr-only">사업연도</span><select className="w-full min-w-36 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 shadow-sm focus:border-teal-600 focus:outline-none" value={year} onChange={e => { const value = e.target.value; setYear(value); setAcademy(""); router.push(`/admin/courses?org=${org}&year=${value}`); }}>{years.map((value) => <option key={value} value={value}>{value}년{value >= 2025 && value <= 2029 ? ` (${value - 2024}차년도)` : ""}</option>)}</select></label>
        <label><span className="sr-only">아카데미</span><select className="w-full min-w-36 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 shadow-sm focus:border-teal-600 focus:outline-none" value={academy} onChange={e => setAcademy(e.target.value)}><option value="">아카데미 전체</option>{academies.map(a => <option key={a}>{a}</option>)}</select></label>
        <label><span className="sr-only">운영 상태</span><select className="w-full min-w-36 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 shadow-sm focus:border-teal-600 focus:outline-none" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">상태 전체</option><option value="DRAFT">개설 준비</option><option value="active">모집·운영</option><option value="ARCHIVED">운영 완료·보관</option></select></label>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="group" aria-label="보기 방식">{[["cards", "카드형", LayoutGrid], ["list", "리스트형", List]].map(([value, label, Icon]) => { const ViewIcon = Icon as typeof List; return <button key={String(value)} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${view === value ? "bg-teal-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`} type="button" aria-pressed={view === value} onClick={() => setView(String(value))}><ViewIcon size={16} />{String(label)}</button>; })}</div>
      </div>
      <p role="status" className="text-sm font-medium text-slate-500">{visible.length}개 과정 · {organizations.find((item) => item.id === org)?.name ?? "선택 기관"} · {year}년 운영 현황</p>
      {!visible.length && <div className="panel text-center">검색 조건에 맞는 과정이 없습니다.</div>}
      {view === "cards" ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visible.map(c => <article key={c.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap justify-between gap-2 text-xs"><span className="rounded bg-teal-50 px-2 py-1 font-semibold text-teal-800">{c.academy}</span><span className="rounded bg-slate-100 px-2 py-1 text-slate-600">{stateLabel(c)}</span></div>
        <p className="mt-5 text-xs font-semibold tracking-wide text-slate-500">{c.budget.program_id || "프로그램 ID 미입력"}</p>
        <h2 className="mt-1 text-lg font-bold leading-7">{c.name}</h2>
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-600"><CalendarDays size={16} className="shrink-0" />{c.period_label}</p>
        <p className="mt-1 text-xs text-slate-500">{c.time_label} · {c.location}</p>
        <dl className="my-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-sm"><div><dt className="text-xs text-slate-500">모집 정원</dt><dd className="mt-1 font-bold">{c.capacity}명</dd></div><div><dt className="text-xs text-slate-500">교육 시수</dt><dd className="mt-1 font-bold">{c.teaching_hours}시간</dd></div><div><dt className="text-xs text-slate-500">모집 / 수료</dt><dd className="mt-1 font-bold">{c.workspace ? `${c.workspace.source?.enrolled ?? c.workspace.enrolled} / ${c.workspace.source?.completed ?? c.workspace.completed}명` : "미등록"}</dd></div></dl>
        <dl className="mb-5 space-y-2 text-xs leading-5 text-slate-600"><div><dt className="font-semibold text-slate-400">강사 · 운영계획</dt><dd>{c.teachers}</dd></div><div><dt className="font-semibold text-slate-400">우선 승인 교내 강사</dt><dd>{initialInstructorLabel(c)}</dd></div><div><dt className="font-semibold text-slate-400">지정 책임강사</dt><dd className="text-sm font-semibold text-teal-900">{responsibleLabel(c)}</dd></div><div><dt className="font-semibold text-slate-400">보조강사 / 보조인력</dt><dd>{c.assistants} / {c.support_staff}</dd></div></dl>
        <div className="mt-auto border-t pt-4"><CourseActions course={c} manager={manager} org={org} /></div>
      </article>)}</div> : <div role="region" aria-label={`${year} 과정 리스트`} tabIndex={0} className="relative overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[1400px] text-left text-sm"><caption className="sr-only">{year}년 과정 운영 관리 목록</caption><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["순번", "프로그램 ID", "세부 프로그램", "정원 / 시수", "모집 / 수료", "강사 · 운영계획", "보조강사 / 보조인력", "교육일정 · 장소", "상태 / 관리"].map(t => <th key={t} scope="col" className="whitespace-nowrap p-4">{t}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visible.map(c => <tr key={c.id} className="hover:bg-teal-50/40"><td className="p-4 text-slate-400">{c.sort_order}</td><td className="whitespace-nowrap p-4 font-mono text-xs">{c.budget.program_id || "미입력"}</td><th scope="row" className="min-w-56 p-4 font-semibold"><span className="mb-1 block text-xs font-normal text-teal-700">{c.academy}</span>{c.name}</th><td className="whitespace-nowrap p-4">{c.capacity}명 / {c.teaching_hours}시간</td><td className="whitespace-nowrap p-4">{c.workspace ? `${c.workspace.source?.enrolled ?? c.workspace.enrolled} / ${c.workspace.source?.completed ?? c.workspace.completed}명` : "미등록"}</td><td className="min-w-48 p-4 text-xs leading-6">{c.teachers}<br /><span>우선 승인: {initialInstructorLabel(c)}</span><br /><strong className="text-teal-900">책임강사: {responsibleLabel(c)}</strong></td><td className="min-w-40 p-4 text-xs leading-6">{c.assistants}<br />{c.support_staff}</td><td className="min-w-56 p-4 text-xs leading-6">{c.period_label}<br />{c.time_label}<br />{c.location}</td><td className="min-w-44 p-4"><p className="mb-2 text-xs text-slate-500">{stateLabel(c)}</p><CourseActions course={c} manager={manager} org={org} /></td></tr>)}</tbody></table></div>}
    </>}
    {tab === "budget" && <BudgetPanel courses={scopedCourses} org={org} workbooks={workbooks} year={selectedYearNumber} />}
  </section>;
}
