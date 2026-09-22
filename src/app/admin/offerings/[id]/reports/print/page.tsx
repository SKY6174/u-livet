import { notFound } from "next/navigation";
import { Empty } from "@/components/portal/ui";
import { ReportDocuments } from "@/components/reports/report-documents";
import { PrintToolbar } from "@/components/reports/print-toolbar";
import { getManagedReport } from "@/lib/reports/data";
import { DOCUMENTS, type DocumentKind } from "@/lib/reports/types";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ document?: string }>;
}) {
  const query = await searchParams;
  const name =
    DOCUMENTS.find((d) => d[0] === query.document)?.[1] ?? "결과보고서 6종";
  return { title: `${name} · U-LIFE` };
}
export default async function PrintReport({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ document?: string; reveal?: string }>;
}) {
  const { id } = await params,
    query = await searchParams,
    document = query.document ?? "all";
  if (document !== "all" && !DOCUMENTS.some((d) => d[0] === document))
    notFound();
  const { offering, bundle } = await getManagedReport(id);
  if (!bundle)
    return (
      <div className="page-shell">
        <Empty title="보고서를 불러오지 못했습니다">
          잠시 후 다시 시도해 주세요.
        </Empty>
      </div>
    );
  return (
    <>
      <PrintToolbar
        document={document}
        reveal={query.reveal === "1"}
      />
      <ReportDocuments
        offering={offering}
        bundle={bundle}
        document={document as DocumentKind | "all"}
        reveal={query.reveal === "1"}
      />
    </>
  );
}
