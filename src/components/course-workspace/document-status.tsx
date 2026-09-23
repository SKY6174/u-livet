import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import { documentReadiness } from "@/lib/course-workspace/progress";
import type { CourseWorkspace, DocumentReadiness } from "@/lib/course-workspace/types";
import { RESULT_STATUS_LABELS, STATUS_LABELS } from "@/lib/operation-documents/model";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type OperationStatus = {
  id: string;
  result_status: keyof typeof STATUS_LABELS | null;
};

export async function DocumentStatus({
  course,
  compact = false,
}: {
  course: CourseWorkspace;
  compact?: boolean;
}) {
  const { data, error } = await (await createServerSupabaseClient()).rpc("life_operation_list");
  const current = !error && Array.isArray(data)
    ? (data as OperationStatus[]).find((row) => row.id === course.id)
    : undefined;
  const status = current?.result_status;
  const readiness: DocumentReadiness[] = documentReadiness(course).map((row) =>
    row.kind === "result"
      ? {
          ...row,
          owner: "담당자 예산 확정 · 책임강사 작성·서명·제출",
          label: !current ? "상태 확인 불가" : status ? RESULT_STATUS_LABELS[status] : "공식 문서 작성 전",
          detail: !current
            ? "공식 결과보고서 상태를 불러오지 못했습니다. 작성 화면에서 확인해 주세요."
            : status === "SUBMITTED"
              ? "최종 제출본이 보관되어 있습니다."
              : status === "REVIEW"
                ? "예산이 확정되었습니다. 책임강사가 내용을 작성하고 서명하여 제출합니다."
                : status === "DRAFT"
                  ? "담당자가 예산·장학금 내역을 입력하고 확정해야 합니다."
                  : "담당자가 예산·장학금 내역을 먼저 입력해 주세요.",
          tone: status === "SUBMITTED" ? "ready" : status === "REVIEW" || !current ? "attention" : "empty",
        }
      : row,
  );
  return (
    <section id="documents" className="scroll-mt-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">결과보고서 준비 현황</h2>
          <p className="mt-1 text-sm text-slate-500">
            결과보고서 본문과 첨부 1~5 · 원본 PDF {course.document_kinds.length}/6종 보관
          </p>
        </div>
        {compact && (
          <Link
            href={`/admin/offerings/${course.id}/reports`}
            className="text-sm font-semibold text-teal-800"
          >
            작성·출력으로 이동 →
          </Link>
        )}
      </div>
      <div
        className={`grid gap-3 ${compact ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"}`}
      >
        {readiness.map((d, i) => (
          <article
            key={d.kind}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold">
                <span className="mr-2 text-xs text-slate-400">{i === 0 ? "본문" : `첨부 ${i}`}</span>
                {d.title}
              </h3>
              <FileText className="shrink-0 text-slate-300" size={18} />
            </div>
            <p className="mt-2 text-xs text-slate-500">{d.owner}</p>
            <p
              className={`mt-4 text-sm font-semibold ${d.tone === "attention" ? "text-amber-800" : d.tone === "ready" ? "text-teal-800" : "text-slate-500"}`}
            >
              {d.label}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              {d.detail}
            </p>
            {course.document_kinds.includes(d.kind) && (
              <p className="mt-2 text-xs font-semibold text-teal-700">
                원본 PDF 보관됨
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-sm font-semibold">
              <Link href={d.kind === "result" ? `/operation-documents/${course.id}/result` : d.href} className="text-teal-800">
                자료 확인·보완
              </Link>
              <Link
                href={d.kind === "result"
                  ? `/operation-documents/${course.id}/result/print`
                  : `/admin/offerings/${course.id}/reports/print?document=${d.kind}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-slate-600"
              >
                {d.kind === "attendance" ? "QR·확정 양식 출력" : d.kind === "teaching" ? "자동취합 양식 출력" : "출력"}
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        자료 준비 상태는 제출 승인과 다릅니다. 개인별 자료가 없으면 해당
        출력에는 빈 명단이 표시됩니다. 출석부·수료자명단·장학금 지급현황·강사
        강의날인부·강사료 지급현황은 결과보고서의 첨부 1~5로 함께 출력됩니다.
      </p>
    </section>
  );
}
