import Link from "next/link";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/portal/ui";
import { requireIdentity } from "@/lib/auth/session";
import { DOCUMENTS, type DocumentKind } from "@/lib/reports/types";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "결과보고서·증빙 안내 · U-LiVET",
  robots: { index: false, follow: false },
};

const GUIDE: Record<DocumentKind, { owner: string; description: string }> = {
  result: {
    owner: "과정 운영 담당자",
    description: "과정별 운영 개요, 교육 실적, 성과, 사진, 예산 집행과 개선 사항을 확인하고 결과보고서를 작성합니다.",
  },
  attendance: {
    owner: "담당 강사 확인 · 운영 담당자 대조",
    description: "회차별 QR 시작·종료 시각과 강사가 확정한 출결을 대조합니다. 인정시간과 휴강·보강 내역을 확인한 뒤 출석부를 출력합니다.",
  },
  completion: {
    owner: "수료 판정 · 별도 승인자 확인",
    description: "승인된 기준에 따른 출석률과 평가 결과, 최신 수료 승인 상태를 확인합니다. 수료 확정 후 명단의 교육시간과 이수시간을 대조합니다.",
  },
  scholarships: {
    owner: "과정 운영 담당자",
    description: "해당 과정의 승인된 장학 기준과 지급 근거를 확인한 뒤 대상, 금액, 지급계좌와 지급일을 기록합니다. 지급 완료 여부는 실제 지급 내역으로 확인합니다.",
  },
  teaching: {
    owner: "담당 강사 서명 · 운영 담당자 확인",
    description: "회차별 실제 강의 구간과 강사 본인의 전자서명을 확인합니다. 오전·점심·오후 강의 구간이 출결 및 강의실적과 일치하는지 대조합니다.",
  },
  fees: {
    owner: "과정 운영 담당자",
    description: "승인된 강사료 기준에 따라 강사구분, 실제 강의일·시수, 단가, 금액과 지급계좌를 확인합니다. 입력 자료와 실제 지급 근거를 대조한 뒤 출력합니다.",
  },
};

export default async function ReportGuide() {
  const me = await requireIdentity("/admin/reports/preview");
  if (!me.roles.some((role) => role.role === "COURSE_MANAGER")) notFound();

  return (
    <div className="page-shell">
      <PageIntro eyebrow="COURSE REPORTS" title="결과보고서·증빙 안내">
        과정별 실제 운영 기록을 확인하고 결과보고서와 첨부 증빙을 작성·출력합니다.
      </PageIntro>
      <section className="panel mb-8" aria-labelledby="report-start-title">
        <h2 id="report-start-title" className="section-title">과정을 선택해 보고서를 작성하세요</h2>
        <ol className="list-decimal space-y-3 pl-5 leading-7 text-slate-700">
          <li>공식 운영결과보고서 목록에서 담당 과정을 선택하고 운영 내용과 예산을 확인합니다.</li>
          <li>결과 보고(5종 증빙 포함)에서 해당 과정의 증빙·지급자료를 열어 누락된 실제 기록을 입력합니다.</li>
          <li>출결, 수료 승인과 지급 근거를 대조한 뒤 미리보기를 확인하고 필요한 문서를 출력합니다.</li>
        </ol>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/operation-documents/result" className="btn-primary">공식 운영결과보고서 열기</Link>
          <Link href="/operation-documents/result?view=evidence" className="btn-secondary">과정별 증빙·출력 열기</Link>
        </div>
      </section>
      <section aria-labelledby="report-documents-title">
        <h2 id="report-documents-title" className="section-title">문서별 확인 사항</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {DOCUMENTS.map(([key, label]) => (
            <article key={key} className="panel">
              <p className="text-sm font-semibold text-teal-800">{GUIDE[key].owner}</p>
              <h3 className="mb-3 mt-2 text-lg font-bold">{label}</h3>
              <p className="leading-7 text-slate-700">{GUIDE[key].description}</p>
            </article>
          ))}
        </div>
      </section>
      <p className="notice mt-6">
        기록이 없는 항목은 담당자에게 확인하고, 해당하지 않는 지급 항목에는 그 사유를 남겨 주세요.
        보고서 입력이나 출력만으로 수료 승인·장학금·강사료 지급이 완료되지는 않습니다.
      </p>
    </div>
  );
}
