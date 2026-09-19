import Link from "next/link";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/portal/ui";
import { PrintToolbar } from "@/components/reports/print-toolbar";
import { ReportDocuments } from "@/components/reports/report-documents";
import { requireIdentity } from "@/lib/auth/session";
import { createReportPreview, PREVIEW_OFFERING } from "@/lib/reports/preview";
import { DOCUMENTS, type DocumentKind } from "@/lib/reports/types";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "결과보고서 양식 검토 · U-LIFE",
  robots: { index: false, follow: false },
};
const GUIDE: Record<DocumentKind, { owner: string; description: string }> = {
  result: { owner: "운영진 작성", description: "운영 개요·성과·사진·예산·품질 개선·총평" },
  attendance: { owner: "강사 입력", description: "회차별 인정시간·출석률·시작 및 종료 서명 칸" },
  completion: { owner: "수료 승인 연동", description: "교육시간·이수시간·출석률·최신 수료 승인 상태" },
  scholarships: { owner: "운영진 입력", description: "장학유형·지급률·금액·지급계좌·지급일" },
  teaching: { owner: "강사 제출 → 운영진 확인", description: "차수·강의시간·강사·제출 및 승인 상태·수기 서명" },
  fees: { owner: "운영진 입력", description: "강사구분·강의일·시수·단가·금액·지급계좌" },
};

export default async function ReportPreview({ searchParams }: {
  searchParams: Promise<{ document?: string }>;
}) {
  const me = await requireIdentity("/admin/reports/preview");
  if (!me.roles.some((role) => role.role === "COURSE_MANAGER")) notFound();
  const document = (await searchParams).document ?? "all";
  if (document !== "all" && !DOCUMENTS.some(([key]) => key === document)) notFound();
  return (
    <>
      <div className="page-shell no-print">
        <PageIntro eyebrow="REPORT REVIEW" title="결과보고서 양식 검토">
          {me.name} 님, 과정 개설 전에 여섯 양식의 구성과 출력 형태를 확인하세요.
        </PageIntro>
        <p className="notice mb-6">
          검토용 가상 예시입니다. 아래 이름·일정·인원·금액은 실제 운영 실적이
          아니며 저장되지 않습니다. 실제 보고서는 과정별 ‘결과보고서 · 출력’에서 작성합니다.
        </p>
        <nav aria-label="검토할 보고서 양식" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DOCUMENTS.map(([key, label], index) => (
            <Link key={key} href={`?document=${key}`} aria-current={document === key ? "page" : undefined}
              className={`panel block border-2 transition-colors hover:border-blue-400 ${document === key ? "border-blue-600 bg-blue-50" : "border-transparent"}`}>
              <span className="text-sm font-semibold text-blue-700">{GUIDE[key].owner}</span>
              <h2 className="mt-2 text-lg font-bold">{index + 1}. {label}</h2>
              <p className="mt-2 text-sm text-slate-600">{GUIDE[key].description}</p>
            </Link>
          ))}
        </nav>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Link href="?document=all" className={document === "all" ? "btn-primary" : "btn-secondary"}
            aria-current={document === "all" ? "page" : undefined}>6종 전체 보기</Link>
          <p className="text-sm text-slate-600">검토할 항목: 누락된 항목, 명칭, 인쇄 방향, 담당자별 입력 범위</p>
        </div>
      </div>
      <PrintToolbar preview document={document} reveal={false} />
      <ReportDocuments offering={PREVIEW_OFFERING} bundle={createReportPreview()}
        document={document as DocumentKind | "all"} />
    </>
  );
}
