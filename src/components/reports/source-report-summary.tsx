import { money, type SourceReport } from "@/lib/reports/types";

export function SourceReportSummary({
  source,
  originalUrl,
}: {
  source: SourceReport;
  originalUrl?: string;
}) {
  return (
    <section
      id="source-report"
      className="panel scroll-mt-6 border border-teal-200 bg-teal-50/40"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="section-title mb-2">보관된 원본 결과보고서</h2>
          <p className="text-sm text-slate-600">
            종료된 과정의 원본 집계입니다. 개인별 출결·수료 승인·지급 기록과는
            구분됩니다.
          </p>
        </div>
        {originalUrl && (
          <a
            className="btn-primary"
            href={originalUrl}
            target="_blank"
            rel="noreferrer"
          >
            원본 PDF 다운로드
          </a>
        )}
      </div>
      <dl className="my-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ["모집 / 수료", `${source.enrolled}명 / ${source.completed}명`],
          [
            "총 교육시간",
            `${source.classCount}회 · ${source.educationHours}시간`,
          ],
          ["장학금 대상", `${source.scholarshipRecipients}명`],
          ["장학금 합계", `${money(source.scholarshipAmount)}원`],
        ].map(([title, value]) => (
          <div key={title}>
            <dt className="text-sm text-slate-500">{title}</dt>
            <dd className="mt-1 text-lg font-bold">{value}</dd>
          </div>
        ))}
      </dl>
      <details className="rounded-xl border border-teal-100 bg-white/70 p-4 text-sm">
        <summary className="cursor-pointer font-semibold text-teal-900">
          원본 파일명·확인 사항 펼치기
        </summary>
        <p className="mt-3 break-all text-slate-500">{source.filename}</p>
        {source.notes && (
          <p className="mt-3 whitespace-pre-wrap leading-relaxed text-slate-600">
            {source.notes}
          </p>
        )}
      </details>
    </section>
  );
}
