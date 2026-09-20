import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Users,
  CalendarDays,
  Files,
} from "lucide-react";
import { getManagedCourse } from "@/lib/course-workspace/data";
import { nextCourseAction } from "@/lib/course-workspace/progress";
import { CourseHeader } from "@/components/course-workspace/course-header";
import { DocumentStatus } from "@/components/course-workspace/document-status";
import { Empty } from "@/components/portal/ui";
import { dateTime } from "@/lib/portal/data";
import { money } from "@/lib/reports/types";

export default async function CourseOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { offering: o, workspace: c } = await getManagedCourse(id);
  if (!c)
    return (
      <div className="page-shell">
        <CourseHeader offering={o} active="overview" />
        <Empty title="운영 현황을 불러오지 못했습니다">
          잠시 후 새로고침해 주세요. 저장된 보고서는 결과보고서 메뉴에서 확인할
          수 있습니다.
        </Empty>
      </div>
    );
  const next = nextCourseAction(c);
  const base = `/admin/offerings/${id}`;
  return (
    <div className="page-shell">
      <CourseHeader offering={o} active="overview" operator={c.operator} />
      <section className="mb-6 flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-teal-900 p-6 text-white">
        <div>
          <p className="text-xs font-semibold uppercase tracking-label-compact text-teal-200">
            다음 할 일
          </p>
          <h2 className="mt-2 text-xl font-bold">{next.label}</h2>
          <p className="mt-2 text-sm text-teal-100">{next.detail}</p>
        </div>
        <Link
          href={next.href}
          className="inline-flex items-center gap-3 rounded-xl bg-white px-5 py-3 text-sm font-bold text-teal-900 hover:bg-teal-50"
        >
          바로가기
          <ArrowRight size={16} />
        </Link>
      </section>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [
            c.source ? "모집 / 수료 · 원본" : "등록 / 수료 승인",
            `${c.source?.enrolled ?? c.enrolled} / ${c.source?.completed ?? c.completed}명`,
          ],
          [
            c.source ? "교육 운영 · 원본" : "등록된 교육 일정",
            `${c.source?.classes ?? c.scheduled_sessions}회 · ${c.source?.hours ?? c.education_hours}시간`,
          ],
          [
            "예산 집행 · 보고서",
            c.report_revision ? `${money(c.budget_spent)}원` : "작성 전",
          ],
          ["원본 PDF 보관", `${c.document_kinds.length} / 6종`],
        ].map(([label, value]) => (
          <div
            className="rounded-2xl border border-slate-200 bg-white p-5"
            key={label}
          >
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-2 break-words text-lg font-bold sm:text-xl">
              {value}
            </p>
          </div>
        ))}
      </div>
      {c.source && (
        <p className="mb-8 rounded-xl border border-teal-100 bg-teal-50 px-5 py-4 text-sm leading-relaxed text-teal-900">
          기존 운영 결과보고서에서 가져온 과정입니다. 위 원본 인원·시간 집계와
          아래 개인별 전산 자료는 구분하여 관리합니다.{" "}
          <Link
            href={`${base}/reports#source-report`}
            className="font-semibold underline"
          >
            원본 및 확인사항 보기
          </Link>
        </p>
      )}
      <section className="mb-8">
        <h2 className="mb-4 text-xl font-bold">과정 운영 흐름</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "개설·신청",
              icon: Users,
              detail:
                c.status === "ARCHIVED"
                  ? "보관된 과정 정보"
                  : `신청 대기 ${c.application_pending}건 · 배정 강사 ${c.instructors}명`,
              href: `${base}/manage`,
            },
            {
              title: "수업·출결",
              icon: CalendarDays,
              detail: "강사 입력 → 운영진 확인",
              href: "#attendance",
            },
            {
              title: "수료 검토",
              icon: ClipboardCheck,
              detail: c.enrolled
                ? `수료 승인 ${c.completed}명 · 검토 ${c.completion_pending}명`
                : "개인별 자료 미등록",
              href:
                c.status === "ARCHIVED" && !c.enrolled
                  ? `${base}/reports#attachments`
                  : `/completion/${id}`,
            },
            {
              title: "보고서·출력",
              icon: Files,
              detail: c.report_revision
                ? `저장 버전 ${c.report_revision} · 6종 출력`
                : "운영 결과 작성 시작",
              href: `${base}/reports`,
            },
          ].map((step, i) => (
            <Link
              className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-teal-500"
              key={step.title}
              href={step.href}
            >
              <div className="flex items-center justify-between">
                <step.icon size={20} className="text-teal-700" />
                <span className="text-xs font-semibold text-slate-400">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-4 font-bold group-hover:text-teal-800">
                {step.title} →
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                {step.detail}
              </p>
            </Link>
          ))}
        </div>
      </section>
      <div className="mb-8 grid gap-5 lg:grid-cols-2">
        <section className="panel scroll-mt-6" id="attendance">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">수업·출결 현황</h2>
            <span className="text-xs font-semibold text-teal-700">
              강사 입력
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            강사가 강의 운영 메뉴에서 입력한 출결이 출석부와 수료 판정에
            연결됩니다.
          </p>
          {!c.scheduled_sessions || !c.enrolled ? (
            <p className="notice mt-4">
              {c.source
                ? "개인별 학습자·회차 자료가 등록되지 않았습니다. 원본 출석부가 있다면 보고서에 첨부해 보관하세요."
                : "학습자 등록과 수업 일정이 준비되면 출결 현황이 표시됩니다."}
            </p>
          ) : (
            <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">종료 수업</dt>
                <dd className="mt-1 text-xl font-bold">{c.ended_sessions}회</dd>
              </div>
              <div>
                <dt className="text-slate-500">입력된 출결</dt>
                <dd className="mt-1 text-xl font-bold">
                  {c.attendance_recorded}건
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">미입력</dt>
                <dd
                  className={`mt-1 text-xl font-bold ${c.missing_attendance ? "text-amber-800" : "text-teal-800"}`}
                >
                  {c.missing_attendance}건
                </dd>
              </div>
            </dl>
          )}
          <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold">
            <Link
              href={`${base}/reports/print?document=attendance`}
              target="_blank"
              rel="noreferrer"
              className="text-teal-800"
            >
              출석부 확인 →
            </Link>
            <Link
              href={`${base}/${c.status === "ARCHIVED" ? "reports#attachments" : "manage#instructors"}`}
              className="text-slate-600"
            >
              {c.status === "ARCHIVED" ? "원본 자료 연결" : "담당 강사 확인"} →
            </Link>
          </div>
        </section>
        <section className="panel">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">보고서·정산 현황</h2>
            <span className="text-xs font-semibold text-teal-700">
              운영진 입력
            </span>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">강의실적 확인</dt>
              <dd className="font-semibold">
                {c.teaching_pending
                  ? `${c.teaching_pending}건 승인 대기`
                  : `${c.teaching_logs}건 등록`}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">강사료 기록</dt>
              <dd className="font-semibold">
                {c.fee_count
                  ? `${c.fee_count}건 · ${money(c.fee_total)}원`
                  : "미등록"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">장학금 기록</dt>
              <dd className="font-semibold">
                {c.scholarship_count
                  ? `${c.scholarship_count}건`
                  : c.source
                    ? "원본 집계만 보관"
                    : "미등록"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">보고서 최근 저장</dt>
              <dd className="text-right font-semibold">
                {c.report_updated_at
                  ? dateTime(c.report_updated_at)
                  : "작성 전"}
              </dd>
            </div>
          </dl>
          <Link
            href={`${base}/reports`}
            className="mt-5 inline-block text-sm font-semibold text-teal-800"
          >
            보고서 작성·지급내역 보완 →
          </Link>
        </section>
      </div>
      <DocumentStatus course={c} compact />
    </div>
  );
}
