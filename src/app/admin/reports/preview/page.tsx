import Link from "next/link";
import { MenuHint } from "@/components/navigation/menu-hint";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/portal/ui";
import { PrintToolbar } from "@/components/reports/print-toolbar";
import { ReportDocuments } from "@/components/reports/report-documents";
import { requireIdentity } from "@/lib/auth/session";
import { createReportPreview, PREVIEW_OFFERING } from "@/lib/reports/preview";
import { DOCUMENTS, type DocumentKind } from "@/lib/reports/types";
import type { AttendanceBook } from "@/lib/attendance/model";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "결과보고서 양식 검토 · U-LIFE",
  robots: { index: false, follow: false },
};
const GUIDE: Record<DocumentKind, { owner: string; description: string }> = {
  result: { owner: "운영진 작성", description: "운영 개요·성과·사진·예산·품질 개선·총평" },
  attendance: { owner: "QR 시작·종료 / 강사 확정", description: "전체 회차를 가로로 펼쳐 QR 시작·종료 시각과 별도 확정 인정시간을 확인" },
  completion: { owner: "수료 승인 연동", description: "교육시간·이수시간·출석률·최신 수료 승인 상태" },
  scholarships: { owner: "운영진 입력", description: "장학유형·지급률·금액·지급계좌·지급일" },
  teaching: { owner: "강사 서명 → 운영진 확인", description: "오전·점심·오후 실제 강의 구간과 본인 전자서명 자동 취합" },
  fees: { owner: "운영진 입력", description: "강사구분·강의일·시수·단가·금액·지급계좌" },
};

export default async function ReportPreview({ searchParams }: {
  searchParams: Promise<{ document?: string }>;
}) {
  const me = await requireIdentity("/admin/reports/preview");
  if (!me.roles.some((role) => role.role === "COURSE_MANAGER")) notFound();
  const document = (await searchParams).document ?? "all";
  if (document !== "all" && !DOCUMENTS.some(([key]) => key === document)) notFound();
  const bundle = createReportPreview();
  const attendanceBook: AttendanceBook = {
    offering: PREVIEW_OFFERING,
    viewer_id: "report-preview",
    generated_at: "2026-08-08T09:00:00+09:00",
    members: bundle.members.map(({ person_id, name }) => ({ person_id, name })),
    sessions: bundle.sessions,
    attendance: bundle.attendance,
    qr_checkins: bundle.sessions.map((session) => ({
      session_id: session.id,
      person_id: "sample-learner-1",
      checked_in_at: session.starts_at,
      checked_out_at: session.ends_at,
    })),
  };
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
              className={`group relative panel block border-2 transition-colors hover:z-10 hover:border-blue-400 focus-visible:z-10 ${document === key ? "border-blue-600 bg-blue-50" : "border-transparent"}`}>
              <span className="text-sm font-semibold text-blue-700">{GUIDE[key].owner}</span>
              <h2 className="mt-2 text-lg font-bold"><MenuHint label={`${index + 1}. ${label}`} description={GUIDE[key].description} /></h2>
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
      <ReportDocuments offering={PREVIEW_OFFERING} bundle={bundle}
        document={document as DocumentKind | "all"} attendanceBook={attendanceBook} />
    </>
  );
}
