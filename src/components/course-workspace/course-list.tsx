"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, CalendarDays, FileText } from "lucide-react";
import type { CourseWorkspace } from "@/lib/course-workspace/types";
import { nextCourseAction } from "@/lib/course-workspace/progress";

const states = [
  ["all", "전체"],
  ["active", "모집·운영"],
  ["DRAFT", "개설 준비"],
  ["ARCHIVED", "운영 완료·보관"],
] as const;
export function CourseList({ courses }: { courses: CourseWorkspace[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const matchesState = (c: CourseWorkspace, state: string) =>
    state === "all" ||
    (state === "active"
      ? ["PUBLISHED", "CLOSED"].includes(c.status)
      : c.status === state);
  const visible = courses.filter(
    (c) =>
      matchesState(c, filter) &&
      `${c.name} ${c.academy} ${c.year_label} ${c.operator}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <section id="course-list" className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["전체 과정", courses.length],
          [
            "모집·운영 중",
            courses.filter((c) => matchesState(c, "active")).length,
          ],
          [
            "운영 완료·보관",
            courses.filter((c) => c.status === "ARCHIVED").length,
          ],
          ["보고서 작성 전", courses.filter((c) => !c.report_revision).length],
        ].map(([label, count]) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-4"
          >
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold">
              {count}
              <span className="ml-1 text-sm font-normal text-slate-400">
                개
              </span>
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 pt-3">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="과정 상태 필터"
        >
          {states.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === value ? "bg-teal-800 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {label}{" "}
              <span className="ml-1 opacity-70">
                {courses.filter((c) => matchesState(c, value)).length}
              </span>
            </button>
          ))}
        </div>
        <label className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 sm:w-80">
          <Search size={17} className="shrink-0 text-slate-400" />
          <span className="sr-only">과정 검색</span>
          <input
            className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm outline-none"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="과정명·분야·담당자 검색"
          />
        </label>
      </div>
      <p className="text-sm text-slate-500" role="status">
        {visible.length}개 과정
      </p>
      {!visible.length && (
        <div className="panel py-12 text-center">
          <h2 className="font-bold">
            {courses.length
              ? "검색 조건에 맞는 과정이 없습니다"
              : "아직 등록된 과정이 없습니다"}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {courses.length
              ? "검색어 또는 상태 필터를 변경해 주세요."
              : "새 과정을 등록하면 운영과 보고서 작성을 시작할 수 있습니다."}
          </p>
          {courses.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
              className="btn-secondary mt-4"
            >
              검색 초기화
            </button>
          )}
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-2">
        {visible.map((c) => {
          const next = nextCourseAction(c);
          return (
            <article
              key={c.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <div className="flex-1 p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                  <span
                    className={`rounded-full border px-3 py-1 ${c.status === "ARCHIVED" ? "border-violet-200 bg-violet-50 text-violet-900" : c.status === "DRAFT" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-teal-200 bg-teal-50 text-teal-900"}`}
                  >
                    {c.status === "ARCHIVED"
                      ? "운영 완료 · 보고서 보관"
                      : c.status === "DRAFT"
                        ? "개설 준비"
                        : c.status === "PUBLISHED"
                          ? "모집 공개"
                          : "모집 종료"}
                  </span>
                  <span className="text-slate-400">{c.academy}</span>
                </div>
                <h2 className="mt-4 break-keep text-lg font-bold leading-snug">
                  <Link
                    href={`/admin/offerings/${c.id}`}
                    className="hover:text-teal-800"
                  >
                    {c.name}
                  </Link>
                </h2>
                <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <CalendarDays size={14} />
                  {c.starts_on} ~ {c.ends_on}
                </p>
                <dl className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">
                      {c.source ? "모집 / 수료 · 원본" : "등록 / 수료 승인"}
                    </dt>
                    <dd className="mt-1 font-semibold">
                      {c.source?.enrolled ?? c.enrolled} /{" "}
                      {c.source?.completed ?? c.completed}명
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">
                      교육시간{c.source ? " · 원본" : " · 일정"}
                    </dt>
                    <dd className="mt-1 font-semibold">
                      {c.source?.hours ?? c.education_hours}시간
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">결과보고서</dt>
                    <dd className="mt-1 font-semibold">
                      {c.report_revision
                        ? c.report_missing.length
                          ? "보완 필요"
                          : "저장됨"
                        : "작성 전"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>
                    {c.operator
                      ? `운영 담당 ${c.operator}`
                      : "운영 담당 미입력"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <FileText size={13} />
                    원본 PDF {c.document_kinds.length}/6종
                  </span>
                </div>
              </div>
              <div className="border-t border-slate-100 px-5 py-4 sm:px-6">
                <p className="mb-3 text-xs text-slate-500">
                  다음 작업 · {next.detail}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link
                    className="btn-primary gap-2"
                    href={`/admin/offerings/${c.id}`}
                  >
                    과정 운영
                    <ArrowRight size={16} />
                  </Link>
                  <Link
                    className="text-sm font-semibold text-teal-800"
                    href={next.href}
                  >
                    {next.label} →
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
