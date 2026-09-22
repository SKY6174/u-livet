import Link from "next/link";
import { getManagedReport } from "@/lib/reports/data";
import { getCourseWorkspaces } from "@/lib/course-workspace/data";
import { emptyReport } from "@/lib/reports/types";
import { Empty } from "@/components/portal/ui";
import { CourseHeader } from "@/components/course-workspace/course-header";
import { DocumentStatus } from "@/components/course-workspace/document-status";
import { ReportEditor } from "@/components/reports/report-editor";
import { ReportFiles } from "@/components/reports/report-files";
import { SourceReportSummary } from "@/components/reports/source-report-summary";
import { ActionForm } from "@/components/portal/action-form";
import { approveTeaching } from "@/app/certificate-actions";
import { dateTime } from "@/lib/portal/data";
export const dynamic = "force-dynamic";
export default async function CourseReports({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ offering: o, bundle: b }, summary] = await Promise.all([
    getManagedReport(id),
    getCourseWorkspaces(id),
  ]);
  if (!b)
    return (
      <div className="page-shell">
        <CourseHeader offering={o} active="reports" />
        <Empty title="보고서를 불러오지 못했습니다">
          잠시 후 새로고침해 주세요.
        </Empty>
      </div>
    );
  const p = b.report?.payload ?? emptyReport(o);
  const source = o.status === "ARCHIVED" ? p.sourceReport : undefined;
  const original = b.files.find((file) => file.kind === "result");
  const workspace = summary.courses[0];
  return (
    <div className="page-shell space-y-8">
      <CourseHeader offering={o} active="reports" operator={p.operator} />
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-slate-500">
          {b.report
            ? `최근 저장 ${dateTime(b.report.updated_at)} · 버전 ${b.report.revision}`
            : "아직 저장되지 않은 초안입니다."}
        </p>
        <nav
          aria-label="보고서 바로가기"
          className="flex flex-wrap gap-4 font-semibold text-teal-800"
        >
          <a href="#report-basic">내용 작성</a>
          <a href="#report-fees">지급내역</a>
          <a href="#teaching">강의실적 승인</a>
          <a href="#attachments">원본·사진</a>
        </nav>
      </div>
      {source && (
        <SourceReportSummary
          source={source}
          originalUrl={
            original
              ? `/api/course-reports/${id}/files/${original.id}`
              : undefined
          }
        />
      )}
      {summary.unavailable || !workspace ? (
        <Empty title="보고서 준비 현황을 불러오지 못했습니다">
          저장된 내용은 아래에서 확인할 수 있습니다.
        </Empty>
      ) : (
        <DocumentStatus course={workspace} />
      )}
      <div className="rounded-xl bg-slate-100 p-4 text-sm leading-relaxed text-slate-600">
        강사가 입력한 출결·강의실적과 유효한 수료 승인 기록을 출력에 반영합니다.
        운영진은 아래에서 운영 결과와 지급내역을 보완합니다.{" "}
        <Link
          className="font-semibold text-teal-800 underline"
          href={`/admin/offerings/${id}`}
        >
          과정 운영 현황 보기
        </Link>
      </div>
      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5"><h2 className="font-bold">공식 운영결과보고서 작성·최종 제출</h2><p className="my-3 text-sm text-slate-600">책임강사가 내용을 작성하고 담당자가 예산을 보완하여 제출합니다. 아래 자료는 출결·지급 증빙과 기존 보관 자료입니다.</p><Link className="btn-primary" href={`/operation-documents/${id}/result`}>공식 양식 작성·검토 →</Link></div>
      <details className="rounded-xl border bg-white p-5"><summary className="cursor-pointer font-semibold">기존 보고서 집계·지급자료 입력</summary><ReportEditor
        key={b.report?.revision ?? 0}
        offering={id}
        initial={p}
        revision={b.report?.revision ?? 0}
        members={b.members}
      /></details>
      <section className="panel scroll-mt-6" id="teaching">
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
