"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CourseMonitoringPlanDashboard } from "./course-monitoring-plan-dashboard";
import type { MonitoringDocument, MonitoringGuide, MonitoringPlan } from "@/lib/course-monitoring/model";

export type MonitoringCourse = {
  id: string;
  org_id: string;
  name: string;
  academy: string;
  year_label: string;
  status: string;
  capacity: number;
  starts_on: string;
  ends_on: string;
  application_pending: number;
  enrolled: number;
  scheduled_sessions: number;
  ended_sessions: number;
  attendance_expected: number;
  attendance_recorded: number;
  missing_attendance: number;
  teaching_pending: number;
  completion_pending: number;
  completed: number;
  source_enrolled: number | null;
};

type Organization = { id: string; name: string };
type AnnualMonitoring = {
  guides: MonitoringGuide[];
  plans: MonitoringPlan[];
  documents: MonitoringDocument[];
  today: string;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "개설 준비",
  PUBLISHED: "모집 공개",
  CLOSED: "모집 종료",
  ARCHIVED: "운영 완료·보관",
};

const YEAR_PATTERN = /\d{4}/;
const yearOf = (course: MonitoringCourse) => course.year_label.match(YEAR_PATTERN)?.[0] ?? course.starts_on.slice(0, 4);
const courseYearAndField = (course: MonitoringCourse) => {
  const phase = course.year_label.match(/\d+차년도/)?.[0];
  const academy = course.academy.replace(/\s*아카데미\s*$/, "").trim();
  const year = `${yearOf(course)}${phase ? `(${phase})` : ""}`;
  return academy ? `${year}∙${academy}` : year;
};
const attentionCount = (course: MonitoringCourse) =>
  course.application_pending + course.missing_attendance + course.teaching_pending + course.completion_pending;
const statusOrder = (status: string) => status === "PUBLISHED" || status === "CLOSED" ? 0 : status === "DRAFT" ? 1 : 2;

export function CourseMonitoringDashboard({ courses, organizations, annual }: {
  courses: MonitoringCourse[];
  organizations: Organization[];
  annual?: AnnualMonitoring;
}) {
  const [organization, setOrganization] = useState("all");
  const [year, setYear] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const organizationNames = useMemo(() => new Map(organizations.map((item) => [item.id, item.name])), [organizations]);
  const years = useMemo(() => Array.from(new Set(courses.map(yearOf))).sort((a, b) => b.localeCompare(a)), [courses]);
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return courses.filter((course) =>
      (organization === "all" || course.org_id === organization) &&
      (year === "all" || yearOf(course) === year) &&
      (status === "all" || (status === "active" ? ["PUBLISHED", "CLOSED"].includes(course.status) : course.status === status)) &&
      (!term || `${course.name} ${course.academy}`.toLocaleLowerCase().includes(term)),
    ).sort((a, b) => statusOrder(a.status) - statusOrder(b.status) || attentionCount(b) - attentionCount(a) || a.name.localeCompare(b.name, "ko"));
  }, [courses, organization, year, status, query]);
  const totals = visible.reduce((sum, course) => ({
    applications: sum.applications + course.application_pending,
    enrolled: sum.enrolled + course.enrolled,
    missing: sum.missing + course.missing_attendance,
    completion: sum.completion + course.completion_pending,
  }), { applications: 0, enrolled: 0, missing: 0, completion: 0 });

  const summaryCards = <div aria-label="과정 운영 현황 요약" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {([
        ["표시 과정", visible.length, "개"],
        ["신청 대기·대기자", totals.applications, "명"],
        ["수강 확정", totals.enrolled, "명"],
        ["출결 미입력", totals.missing, "건"],
        ["수료 검토 대기", totals.completion, "명"],
      ] as const).map(([label, value, unit]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-semibold text-slate-600">{label}</p>
        <p className={`mt-2 text-2xl font-bold tabular-nums ${value > 0 && (label === "출결 미입력" || label === "수료 검토 대기") ? "text-amber-800" : "text-slate-900"}`}>{value.toLocaleString("ko-KR")}<span className="ml-1 text-sm font-normal text-slate-500">{unit}</span></p>
      </div>)}
    </div>;

  return <>
    {annual && <CourseMonitoringPlanDashboard {...annual} courses={courses} summaryCards={summaryCards} />}
    <section aria-label="과정별 운영 현황" className="space-y-6">
    {!annual && summaryCards}

    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      {organizations.length > 1 && <label className="min-w-40 flex-1 text-xs font-semibold text-slate-600">담당 기관
        <select value={organization} onChange={(event) => setOrganization(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900">
          <option value="all">전체 기관</option>
          {organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>}
      <label className="min-w-36 flex-1 text-xs font-semibold text-slate-600">사업연도
        <select value={year} onChange={(event) => setYear(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900">
          <option value="all">전체 연도</option>
          {years.map((value) => <option key={value} value={value}>{value}년</option>)}
        </select>
      </label>
      <label className="min-w-40 flex-1 text-xs font-semibold text-slate-600">운영 상태
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900">
          <option value="all">전체 상태</option>
          <option value="active">모집 공개·종료</option>
          <option value="DRAFT">개설 준비</option>
          <option value="ARCHIVED">운영 완료·보관</option>
        </select>
      </label>
      <label className="min-w-52 flex-[2] text-xs font-semibold text-slate-600">과정 검색
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="과정명·분야" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900" />
      </label>
    </div>

    {!visible.length ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
      <h2 className="font-bold">{courses.length ? "조건에 맞는 과정이 없습니다" : "등록된 과정이 없습니다"}</h2>
      <p className="mt-2 text-sm text-slate-600">{courses.length ? "필터를 변경해 주세요." : "과정을 등록하면 신청·출결 현황이 여기에 표시됩니다."}</p>
      {courses.length > 0 && <button type="button" className="btn-secondary mt-4" onClick={() => { setOrganization("all"); setYear("all"); setStatus("all"); setQuery(""); }}>필터 초기화</button>}
    </div> : <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
        <caption className="sr-only">과정별 신청, 수업·출결, 수료 현황</caption>
        <thead className="bg-slate-50 text-xs text-slate-600"><tr>
          {(["과정", "신청·수강", "수업·출결", "수료", "바로가기"] as const).map((label) => <th key={label} scope="col" className="px-5 py-4 font-semibold">{label}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-slate-100">
          {visible.map((course) => {
            const base = `/admin/offerings/${course.id}`;
            return <tr key={course.id} className="align-top hover:bg-teal-50/40">
              <th scope="row" className="w-[28%] min-w-64 px-5 py-5 font-normal">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${course.status === "ARCHIVED" ? "bg-slate-100 text-slate-700" : course.status === "DRAFT" ? "bg-amber-50 text-amber-800" : "bg-teal-50 text-teal-800"}`}>{STATUS_LABELS[course.status] ?? course.status}</span>
                <Link href={base} className="mt-2 block break-keep font-bold text-slate-900 hover:text-teal-800 hover:underline">{course.name}</Link>
                <p className="mt-1 whitespace-nowrap text-xs text-slate-500">{organizationNames.get(course.org_id) ?? "담당 기관"}</p>
                <p className="whitespace-nowrap text-xs text-slate-500">{courseYearAndField(course)}</p>
                <p className="mt-1 text-xs text-slate-500">{course.starts_on} ~ {course.ends_on}</p>
              </th>
              <td className="min-w-44 px-5 py-5">
                <p>신청 대기·대기자 <strong className="tabular-nums">{course.application_pending}명</strong></p>
                <p className="mt-2">수강 확정 <strong className="tabular-nums">{course.enrolled} / {course.capacity}명</strong></p>
                {course.source_enrolled !== null && <p className="mt-2 text-xs text-slate-500">원본 기록 수강 {course.source_enrolled}명 · 전산 인원과 별도</p>}
              </td>
              <td className="min-w-56 px-5 py-5">
                <p>수업 {course.ended_sessions} / {course.scheduled_sessions}회 종료</p>
                {course.attendance_expected > 0 ? <>
                  <p className="mt-2">출결 입력 <strong className="tabular-nums">{course.attendance_recorded} / {course.attendance_expected}건</strong></p>
                  <p className="mt-1 text-xs text-slate-600">입력률 {Math.min(100, Math.round(course.attendance_recorded / course.attendance_expected * 100))}%</p>
                  <progress aria-label={`${course.name} 출결 입력률`} className="mt-2 h-2 w-full accent-teal-700" value={Math.min(course.attendance_recorded, course.attendance_expected)} max={course.attendance_expected} />
                  <p className={`mt-1 text-xs ${course.missing_attendance ? "font-semibold text-amber-800" : "text-slate-500"}`}>미입력 {course.missing_attendance}건 · 결석과 별도</p>
                </> : <p className="mt-2 text-xs text-slate-500">종료 수업 출결 집계 대상 없음</p>}
                {course.teaching_pending > 0 && <p className="mt-2 text-xs font-semibold text-amber-800">강의일지 미확정 {course.teaching_pending}건</p>}
              </td>
              <td className="min-w-36 px-5 py-5">
                <p>수료 승인 <strong className="tabular-nums">{course.completed}명</strong></p>
                <p className={`mt-2 ${course.completion_pending ? "font-semibold text-amber-800" : ""}`}>검토 대기 {course.completion_pending}명</p>
              </td>
              <td className="min-w-40 px-5 py-5"><div className="flex flex-col items-start gap-2 font-semibold text-teal-800">
                <Link href={base} className="hover:underline">운영 개요 →</Link>
                {course.status !== "ARCHIVED" && <Link href={`${base}/manage#applications`} className="hover:underline">신청 처리 →</Link>}
                <Link href={`${base}#attendance`} className="hover:underline">출결 현황 →</Link>
                <Link href={`/completion/${course.id}`} className="hover:underline">수료 검토 →</Link>
                {course.status === "ARCHIVED" && <Link href={`${base}/reports`} className="hover:underline">원본 보고서 →</Link>}
              </div></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>}
    <p className="text-xs leading-5 text-slate-500">신청 대기·대기자는 제출·대기 상태의 신청 건수입니다. 출결 미입력은 결석 수가 아니며, 수료 승인은 별도로 진행됩니다.</p>
    </section>
  </>;
}
