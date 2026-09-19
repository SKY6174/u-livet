import Link from "next/link";
import { getManagedReport } from "@/lib/reports/data";
import {
  DOCUMENTS,
  emptyReport,
  isCompleted,
  attendanceSummary,
  feeAmount,
  money,
} from "@/lib/reports/types";
import { PageIntro, Empty } from "@/components/portal/ui";
import { ReportEditor } from "@/components/reports/report-editor";
import { ReportFiles } from "@/components/reports/report-files";
import { ActionForm } from "@/components/portal/action-form";
import { approveTeaching } from "@/app/certificate-actions";
import { dateTime } from "@/lib/portal/data";
export const dynamic = "force-dynamic";
export default async function CourseReports({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    { offering: o, bundle: b } = await getManagedReport(id);
  if (!b)
    return (
      <div className="page-shell">
        <Link href={`/admin/offerings/${id}`}>← 과정 관리</Link>
        <Empty title="보고서 관리 기능을 불러오지 못했습니다">
          보고서 데이터베이스 설정 또는 연결 상태를 확인해 주세요.
        </Empty>
      </div>
    );
  const p = b.report?.payload ?? emptyReport(o),
    active = b.members.filter((m) => m.enrollment_status === "ACTIVE"),
    missing = active.reduce(
      (n, m) => n + attendanceSummary(b, m.person_id).missing,
      0,
    );
  return (
    <div className="page-shell space-y-8">
      <Link
        className="text-sm font-semibold text-teal-800"
        href={`/admin/offerings/${id}`}
      >
        ← 과정 관리
      </Link>
      <PageIntro eyebrow="COURSE REPORTS" title={o.name}>
        {o.starts_on} ~ {o.ends_on} · 운영 담당 {p.operator} · 과정별 운영
        기록과 결과보고서를 관리합니다.
      </PageIntro>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["등록 학습자", `${active.length}명`],
          ["수료 승인", `${b.members.filter(isCompleted).length}명`],
          ["출결 미입력", `${missing}건`],
          [
            "강사료 합계",
            `${money(p.fees.reduce((n, r) => n + feeAmount(r), 0))}원`,
          ],
        ].map(([label, value]) => (
          <div className="panel" key={label}>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="section-title mb-2">결과보고서 6종 출력</h2>
            <p className="text-sm text-slate-600">
              저장된 내용으로 미리보기·인쇄·PDF 저장을 할 수 있습니다.
            </p>
          </div>
          <Link
            className="btn-primary"
            href={`/admin/offerings/${id}/reports/print?document=all`}
          >
            6종 전체 미리보기
          </Link>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {DOCUMENTS.map(([key, label], i) => (
            <Link
              key={key}
              className="rounded-xl border p-4 transition hover:border-teal-700 hover:bg-teal-50"
              href={`/admin/offerings/${id}/reports/print?document=${key}`}
            >
              <span className="text-xs font-bold text-teal-700">0{i + 1}</span>
              <h3 className="mt-2 font-semibold">{label} →</h3>
              <p className="mt-2 text-xs text-slate-500">
                {b.files.some((f) => f.kind === key)
                  ? "원본 보관됨"
                  : "원본 미등록"}{" "}
                · 개별 PDF 저장
              </p>
            </Link>
          ))}
        </div>
        <p className="mt-5 text-sm text-slate-500">
          {b.report
            ? `최근 저장: ${dateTime(b.report.updated_at)} · 버전 ${b.report.revision}`
            : "보고서 초안이 아직 저장되지 않았습니다."}
        </p>
        {missing > 0 && (
          <p className="notice mt-4">
            강사가 입력하지 않은 출결이 {missing}건 있습니다. 출석률은 잠정
            수치입니다.
          </p>
        )}
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel">
          <h2 className="font-bold">강사 입력 · 출결·실강의시간</h2>
          <p className="my-3 text-sm text-slate-600">
            강사가 본인의 강의실에서 출결과 강의실적을 입력하면 보고서에
            연결됩니다. 휴대폰 웹에서도 사용할 수 있습니다.
          </p>
          <p className="text-sm">
            강사 메뉴: 강의 운영 → 출결·시험 관리 / 실제 강의실적
          </p>
        </div>
        <div className="panel">
          <h2 className="font-bold">운영진 확인 · 수료·지급내역</h2>
          <p className="my-3 text-sm text-slate-600">
            수료는 승인 기록을 사용합니다. 장학금과 강사료는 아래에서 운영진이
            입력합니다.
          </p>
          <Link
            className="text-sm font-semibold text-teal-800 underline"
            href={`/completion/${id}`}
          >
            수료 판정·승인 확인 →
          </Link>
        </div>
      </div>
      <ReportEditor
        key={b.report?.revision ?? 0}
        offering={id}
        initial={p}
        revision={b.report?.revision ?? 0}
        members={b.members}
      />
      <section className="panel">
        <h2 className="section-title">
          강사 강의실적 확인 · {b.teaching.length}건
        </h2>
        {!b.teaching.length ? (
          <p className="notice">강사가 실제 강의실적을 제출하면 표시됩니다.</p>
        ) : (
          <div className="space-y-4">
            {b.teaching.map((l) => (
              <div
                className="flex flex-wrap justify-between gap-4 border-t pt-4"
                key={l.id}
              >
                <div>
                  <p className="font-semibold">
                    {l.name} ·{" "}
                    {b.sessions.find((s) => s.id === l.session_id)?.title} ·{" "}
                    {l.minutes}분
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                    {l.topic}
                  </p>
                </div>
                {l.current ? (
                  <span className="badge self-start">승인 완료</span>
                ) : (
                  <ActionForm
                    action={approveTeaching}
                    label="강의실적 확인·승인"
                  >
                    <input type="hidden" name="log" value={l.id} />
                    <input type="hidden" name="revision" value={l.revision} />
                    <label className="flex gap-2 text-sm">
                      <input type="checkbox" name="reviewed" required />
                      실제 강의시간과 내용을 확인했습니다.
                    </label>
                  </ActionForm>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      <ReportFiles offering={id} files={b.files} />
    </div>
  );
}
