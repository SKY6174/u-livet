"use client";
import { useState } from "react";
import Link from "next/link";
import type { CourseWorkspace } from "@/lib/course-workspace/types";

const states = [["all", "전체"], ["empty", "작성 전"], ["attention", "보완 필요"], ["saved", "내용 저장됨"]] as const;
export function ReportList({ courses }: { courses: CourseWorkspace[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const state = (course: CourseWorkspace) => !course.report_revision ? "empty" : course.report_missing.length ? "attention" : "saved";
  const visible = courses.filter((course) => (filter === "all" || state(course) === filter) &&
    `${course.name} ${course.academy} ${course.operator}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return (
    <section aria-label="과정별 결과보고서" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="보고서 상태 필터">
          {states.map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === value ? "bg-teal-800 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>
            {label} · {courses.filter((course) => value === "all" || state(course) === value).length}
          </button>)}
        </div>
        <label className="field w-full sm:w-80">보고서 검색
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="과정명·분야·담당자 검색" />
        </label>
      </div>
      <p className="text-sm text-slate-500" role="status">{visible.length}개 과정 · 저장된 보고서도 출력 전 내용을 확인해 주세요.</p>
      {!visible.length && <div className="panel text-center">{courses.length ? "조건에 맞는 보고서가 없습니다." : "아직 등록된 과정이 없습니다."}</div>}
      <div className="grid gap-5 lg:grid-cols-2">
        {visible.map((course) => {
          const report = `/admin/offerings/${course.id}/reports`;
          return (
            <article key={course.id} className="panel flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="badge">{states.find(([value]) => value === state(course))?.[1]}</span>
                <span className="text-xs text-slate-500">{course.academy} · {course.year_label}</span>
              </div>
              <h2 className="mt-4 text-lg font-bold"><Link href={report} className="hover:text-teal-800">{course.name}</Link></h2>
              <p className="mt-3 text-sm text-slate-500">{course.starts_on} ~ {course.ends_on}</p>
              <p className="mt-3 text-sm text-slate-600">운영 담당 {course.operator || "미입력"} · 원본 PDF {course.document_kinds.length}/6종</p>
              {course.report_missing.length > 0 && <p className="mt-3 text-sm text-amber-800">확인할 내용: {course.report_missing.join(" · ")}</p>}
              <div className="mt-auto flex flex-wrap gap-3 pt-6">
                <Link className="btn-primary" href={report}>{course.report_revision ? "기존 보고 내용 검토" : "증빙·지급자료 작성"}</Link>
                <Link className="btn-secondary" href={`${report}/print?document=all`} target="_blank" rel="noreferrer">6종 출력 미리보기</Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
