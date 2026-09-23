"use client";

/**
 * @file src/components/operation-documents/document-list-view.tsx
 * @description 2026년 RISE사업 평생직업교육과정 16개 과정의 운영계획서 및 결과보고서를
 *              카드형과 리스트형(테이블)으로 탐색하고 관리할 수 있는 클라이언트 컴포넌트입니다.
 *              검색 기능(과정명, ID, 강사명 등), 아카데미별 필터링, 상태별 필터링을 지원합니다.
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import { CalendarDays, LayoutGrid, List, Search } from "lucide-react";
import { STATUS_LABELS, RESULT_STATUS_LABELS } from "@/lib/operation-documents/model";

/**
 * 과정 문서 목록에서 표현할 각 과정의 표준 데이터 타입
 */
export type DocumentCourseItem = {
  /** 과정 고유 ID (DB UUID 또는 원문 이관 식별자) */
  id: string;
  /** 실제 Supabase offering 등록 여부 */
  registered: boolean;
  /** 정렬 순번 (1 ~ 16) */
  sort_order: number;
  /** 사업 프로그램 ID (예: C1-POPUP-01, C1-SMART-01) */
  program_id: string;
  /** 과정 공식 명칭 */
  name: string;
  /** 소속 아카데미 구분 (스마트테크, 라이프케어, 로컬창업, 팝업) */
  academy: string;
  /** 모집 정원 (명) */
  capacity: number | null;
  /** 총 교육 시수 (시간) */
  teaching_hours: number | null;
  /** 교육 시작일 (YYYY-MM-DD) */
  starts_on: string;
  /** 교육 종료일 (YYYY-MM-DD) */
  ends_on: string;
  /** 기간 표시용 텍스트 (예: 2026-10-06 ~ 2026-10-29) */
  period_label: string;
  /** 교육 시간 요약 (예: 화·목 18:00~22:00) */
  time_label: string;
  /** 강의실 및 교육 장소 */
  location: string;
  /** 강사진 명단 */
  teachers: string;
  /** 책임강사 성명 */
  responsible: string;
  /** 원문 계획서에 기재된 담당 교수 */
  source_coordinator: string;
  /** 보조강사 명단 */
  assistants: string;
  /** 전담 보조인력 성명 */
  support_staff: string;
  /** 운영계획서 진행 상태 (DRAFT | REVIEW | SUBMITTED) */
  plan_status: keyof typeof STATUS_LABELS | null;
  /** 결과보고서 진행 상태 (DRAFT | REVIEW | SUBMITTED) */
  result_status: keyof typeof RESULT_STATUS_LABELS | null;
  /** 모집 및 수료 인원 실적 표시 (예: "14 / 14명" 또는 "미등록") */
  enrolled_completed: string;
  /** 결과보고서 원문 보유 여부. DB 제출 상태와는 별개입니다. */
  has_source_report: boolean;
};

interface DocumentListViewProps {
  /** 문서 구분 ('plan': 운영계획서, 'result': 결과보고서) */
  kind: "plan" | "result";
  /** 표시할 16개 과정 데이터 목록 */
  courses: DocumentCourseItem[];
}

export function DocumentListView({ kind, courses }: DocumentListViewProps) {
  // 보기 모드 상태: 'cards' (카드형), 'list' (리스트형 테이블)
  const [view, setView] = useState<"cards" | "list">("cards");
  // 검색어 상태 (프로그램 ID, 과정명, 강사명 등)
  const [query, setQuery] = useState("");
  // 아카데미 필터 상태 (전체 또는 특정 아카데미)
  const [academy, setAcademy] = useState("");
  // 문서 진행 상태 필터 ('all', 'DRAFT', 'REVIEW', 'SUBMITTED', 'PENDING')
  const [statusFilter, setStatusFilter] = useState("all");

  const isResult = kind === "result";
  const label = isResult ? "결과보고서" : "운영계획서";

  // 상태 배지 한글 명칭 반환 함수
  const getStatusLabel = (item: DocumentCourseItem) => {
    if (!item.registered) return "DB 이관 대기";
    const statusKey = isResult ? item.result_status : item.plan_status;
    if (!statusKey) return "작성 시작";
    if (isResult) {
      return RESULT_STATUS_LABELS[statusKey] || "작성 시작";
    }
    return STATUS_LABELS[statusKey] || "작성 시작";
  };

  // 상태 배지 스타일 클래스 반환 함수
  const getStatusBadgeClass = (item: DocumentCourseItem) => {
    if (!item.registered)
      return "bg-slate-100 text-slate-500 border-slate-300";
    const statusKey = isResult ? item.result_status : item.plan_status;
    switch (statusKey) {
      case "SUBMITTED":
        return "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold";
      case "REVIEW":
        return "bg-amber-100 text-amber-800 border-amber-300 font-semibold";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  // 목록에 존재하는 고유 아카데미 목록 추출
  const academies = useMemo(() => {
    return Array.from(new Set(courses.map((c) => c.academy).filter(Boolean)));
  }, [courses]);

  // 상단 지표 카드 집계
  const stats = useMemo(() => {
    const total = courses.length;
    const submitted = courses.filter((c) =>
      isResult ? c.result_status === "SUBMITTED" : c.plan_status === "SUBMITTED",
    ).length;
    const reviewing = courses.filter((c) =>
      isResult ? c.result_status === "REVIEW" : c.plan_status === "REVIEW",
    ).length;
    const drafting = courses.filter((c) => {
      if (!c.registered) return false;
      const st = isResult ? c.result_status : c.plan_status;
      return !st || st === "DRAFT";
    }).length;
    const pending = courses.filter((c) => !c.registered).length;

    return { total, submitted, reviewing, drafting, pending };
  }, [courses, isResult]);

  // 검색어 및 필터 조건에 맞게 실시간 필터링
  const visibleCourses = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s/g, "");
    return courses.filter((c) => {
      // 1. 아카데미 필터
      if (academy && c.academy !== academy) return false;

      // 2. 상태 필터
      const st = isResult ? c.result_status : c.plan_status;
      if (statusFilter !== "all") {
        if (statusFilter === "PENDING") return !c.registered;
        if (!c.registered) return false;
        if (statusFilter === "DRAFT" && st && st !== "DRAFT") return false;
        if (statusFilter !== "DRAFT" && st !== statusFilter) return false;
      }

      // 3. 검색어 필터
      if (!q) return true;
      const combined = `${c.program_id} ${c.name} ${c.teachers} ${c.responsible} ${c.source_coordinator} ${c.assistants} ${c.support_staff} ${c.location}`
        .toLowerCase()
        .replace(/\s/g, "");
      return combined.includes(q);
    });
  }, [courses, query, academy, statusFilter, isResult]);

  return (
    <div className="space-y-6">
      {/* 1. 상단 운영 지표 통계 카드 (전체, 제출완료, 검토중, 작성준비) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">2026 전체 과정</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
            {stats.total}개
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-emerald-700">최종 제출 완료</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-900">
            {stats.submitted}개
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-amber-700">담당자 검토 중</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-amber-900">
            {stats.reviewing}개
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">작성 시작 / 초안</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-700">
            {stats.drafting}개
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">DB 이관 대기</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-700">
            {stats.pending}개
          </p>
        </div>
      </div>

      {/* 2. 검색 및 보기 옵션 컨트롤 바 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 통합 검색창 */}
        <label className="flex min-w-56 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm focus-within:border-teal-600 focus-within:ring-1 focus-within:ring-teal-600">
          <Search size={18} className="text-slate-400" />
          <span className="sr-only">과정 검색</span>
          <input
            className="w-full border-0 bg-transparent py-3 text-sm outline-none placeholder:text-slate-400"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="프로그램 ID·과정명·강사 검색"
          />
        </label>

        {/* 아카데미 분류 셀렉트 */}
        <label>
          <span className="sr-only">아카데미</span>
          <select
            className="w-full min-w-36 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 shadow-sm focus:border-teal-600 focus:outline-none"
            value={academy}
            onChange={(e) => setAcademy(e.target.value)}
          >
            <option value="">아카데미 전체</option>
            {academies.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        {/* 진행 상태 셀렉트 */}
        <label>
          <span className="sr-only">운영 상태</span>
          <select
            className="w-full min-w-36 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 shadow-sm focus:border-teal-600 focus:outline-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">상태 전체</option>
            <option value="DRAFT">작성 시작 / 준비</option>
            <option value="REVIEW">담당자 검토 중</option>
            <option value="SUBMITTED">최종 제출 완료</option>
            <option value="PENDING">DB 이관 대기</option>
          </select>
        </label>

        {/* 카드형 / 리스트형 토글 버튼 */}
        <div
          className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
          role="group"
          aria-label="보기 방식"
        >
          <button
            type="button"
            aria-pressed={view === "cards"}
            onClick={() => setView("cards")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              view === "cards"
                ? "bg-teal-800 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <LayoutGrid size={16} />
            카드형
          </button>
          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              view === "list"
                ? "bg-teal-800 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <List size={16} />
            리스트형
          </button>
        </div>
      </div>

      {/* 3. 검색 결과 요약 안내 */}
      <p role="status" className="text-sm font-medium text-slate-500">
        {visibleCourses.length}개 과정 · 2026년 운영 현황
      </p>

      {/* 검색 결과가 없을 때의 안내 */}
      {visibleCourses.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          검색 조건에 일치하는 과정이 없습니다. 검색어를 변경하거나 필터를 초기화해 보세요.
        </div>
      )}

      {/* 4. 카드형 뷰 (Card Grid) */}
      {view === "cards" && visibleCourses.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleCourses.map((c) => {
            const statusText = getStatusLabel(c);
            const badgeClass = getStatusBadgeClass(c);

            return (
              <article
                key={c.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                {/* 상단 뱃지: 아카데미 및 상태 */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="rounded bg-teal-50 px-2 py-1 font-semibold text-teal-800">
                    {c.academy}
                  </span>
                  <span className={`rounded border px-2 py-0.5 text-xs ${badgeClass}`}>
                    {statusText}
                  </span>
                </div>

                {/* 프로그램 ID 및 과정명 */}
                <p className="mt-4 text-xs font-semibold tracking-wide text-slate-400">
                  {c.program_id}
                </p>
                {isResult && c.has_source_report && (
                  <p className="mt-1 text-xs font-semibold text-teal-700">
                    원문 결과보고서 보유 · DB 제출 상태와 별도
                  </p>
                )}
                <h3 className="mt-1 text-lg font-bold leading-snug text-slate-900">
                  {c.name}
                </h3>

                {/* 교육 기간 및 장소 */}
                <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                  <CalendarDays size={16} className="shrink-0 text-slate-400" />
                  {c.period_label}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {c.time_label} · {c.location}
                </p>

                {/* 정원 / 시수 / 모집수료 지표 */}
                <dl className="my-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">모집 정원</dt>
                    <dd className="mt-1 font-bold text-slate-800">
                      {c.capacity === null ? "확인 필요" : `${c.capacity}명`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">교육 시수</dt>
                    <dd className="mt-1 font-bold text-slate-800">
                      {c.teaching_hours === null
                        ? "확인 필요"
                        : `${c.teaching_hours}시간`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">모집 / 수료</dt>
                    <dd className="mt-1 font-bold text-slate-800">{c.enrolled_completed}</dd>
                  </div>
                </dl>

                {/* 강사진 및 운영 인력 정보 */}
                <dl className="mb-5 space-y-2 text-xs leading-5 text-slate-600">
                  <div>
                    <dt className="font-semibold text-slate-400">강사 · 운영계획</dt>
                    <dd className="text-slate-700">{c.teachers}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-400">책임강사</dt>
                    <dd className="text-sm font-bold text-teal-900">
                      {c.responsible || "미지정"}
                    </dd>
                    {!c.registered && c.source_coordinator && (
                      <dd className="text-slate-500">
                        원문 담당 교수: {c.source_coordinator}
                      </dd>
                    )}
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-400">보조강사 / 보조인력</dt>
                    <dd className="text-slate-600">
                      {c.assistants} / {c.support_staff}
                    </dd>
                  </div>
                </dl>

                {/* 문서 작성 및 검토 액션 버튼 */}
                <div className="mt-auto border-t border-slate-100 pt-4">
                  {c.registered ? (
                    <Link
                      className="flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50/60 p-3 text-sm font-semibold text-teal-900 transition hover:border-teal-400 hover:bg-teal-100/80"
                      href={`/operation-documents/${c.id}/${kind}`}
                    >
                      <span>{label} 작성·검토 →</span>
                      <span className="text-xs font-bold text-teal-800">
                        {statusText}
                      </span>
                    </Link>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                      과정·책임강사를 DB에 등록한 뒤 작성할 수 있습니다.
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 5. 리스트형 뷰 (Table) */}
      {view === "list" && visibleCourses.length > 0 && (
        <div
          role="region"
          aria-label="2026 과정 문서 리스트"
          tabIndex={0}
          className="relative overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <table className="w-full min-w-[1400px] text-left text-sm">
            <caption className="sr-only">2026년 과정 운영계획서 및 결과보고서 목록</caption>
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                {[
                  "순번",
                  "프로그램 ID",
                  "세부 프로그램",
                  "정원 / 시수",
                  "모집 / 수료",
                  "강사 · 운영계획",
                  "보조강사 / 보조인력",
                  "교육일정 · 장소",
                  "상태 / 관리",
                ].map((th) => (
                  <th key={th} scope="col" className="whitespace-nowrap p-4">
                    {th}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleCourses.map((c) => {
                const statusText = getStatusLabel(c);
                const badgeClass = getStatusBadgeClass(c);

                return (
                  <tr key={c.id} className="transition hover:bg-teal-50/40">
                    {/* 순번 */}
                    <td className="p-4 font-mono text-xs text-slate-400">
                      {c.sort_order}
                    </td>

                    {/* 프로그램 ID */}
                    <td className="whitespace-nowrap p-4 font-mono text-xs font-semibold text-slate-600">
                      {c.program_id}
                    </td>

                    {/* 세부 프로그램 명칭 */}
                    <th scope="row" className="min-w-64 p-4 font-semibold">
                      <span className="mb-1 block text-xs font-semibold text-teal-700">
                        {c.academy}
                      </span>
                      <span className="text-base font-bold text-slate-900">
                        {c.name}
                      </span>
                    </th>

                    {/* 정원 / 시수 */}
                    <td className="whitespace-nowrap p-4 font-medium text-slate-700">
                      {c.capacity === null ? "정원 확인 필요" : `${c.capacity}명`} /{" "}
                      {c.teaching_hours === null
                        ? "시수 확인 필요"
                        : `${c.teaching_hours}시간`}
                    </td>

                    {/* 모집 / 수료 */}
                    <td className="whitespace-nowrap p-4 font-medium text-slate-700">
                      {c.enrolled_completed}
                    </td>

                    {/* 강사진 및 책임강사 */}
                    <td className="min-w-52 p-4 text-xs leading-6">
                      <span className="text-slate-700">{c.teachers}</span>
                      <br />
                      <strong className="text-sm text-teal-950">
                        책임강사: {c.responsible || "미지정"}
                      </strong>
                      {!c.registered && c.source_coordinator && (
                        <span className="block text-slate-500">
                          원문 담당 교수: {c.source_coordinator}
                        </span>
                      )}
                    </td>

                    {/* 보조강사 / 보조인력 */}
                    <td className="min-w-44 p-4 text-xs leading-6 text-slate-600">
                      <span>보조강사: {c.assistants}</span>
                      <br />
                      <span>보조인력: {c.support_staff}</span>
                    </td>

                    {/* 교육일정 및 장소 */}
                    <td className="min-w-60 p-4 text-xs leading-6 text-slate-600">
                      <span className="font-semibold text-slate-800">
                        {c.period_label}
                      </span>
                      <br />
                      <span>{c.time_label}</span>
                      <br />
                      <span className="text-slate-500">{c.location}</span>
                    </td>

                    {/* 상태 및 액션 링크 */}
                    <td className="min-w-48 p-4">
                      <div className="flex flex-col gap-2">
                        <span className={`inline-block w-fit rounded border px-2 py-0.5 text-xs ${badgeClass}`}>
                          {statusText}
                        </span>
                        {c.registered ? (
                          <Link
                            className="inline-flex items-center gap-1 text-sm font-semibold text-teal-800 hover:text-teal-950 hover:underline"
                            href={`/operation-documents/${c.id}/${kind}`}
                          >
                            {label} 작성·검토 →
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-500">
                            과정·책임강사 등록 후 작성 가능
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
