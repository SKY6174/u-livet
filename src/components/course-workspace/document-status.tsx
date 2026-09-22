import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import { documentReadiness } from "@/lib/course-workspace/progress";
import type { CourseWorkspace } from "@/lib/course-workspace/types";

export function DocumentStatus({
  course,
  compact = false,
}: {
  course: CourseWorkspace;
  compact?: boolean;
}) {
  return (
    <section id="documents" className="scroll-mt-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">결과보고서 준비 현황</h2>
          <p className="mt-1 text-sm text-slate-500">
            저장된 자료 기준 · 원본 PDF {course.document_kinds.length}/6종 보관
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
        {documentReadiness(course).map((d, i) => (
          <article
            key={d.kind}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold">
                <span className="mr-2 text-xs text-slate-400">0{i + 1}</span>
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
                href={`/admin/offerings/${course.id}/reports/print?document=${d.kind}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-slate-600"
              >
                출력
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        자료 준비 상태는 제출 승인과 다릅니다. 개인별 자료가 없으면 해당
        출력에는 빈 명단이 표시됩니다. 장학금·강사료는 지급 대상이 있을 때
        입력하세요.
      </p>
    </section>
  );
}
