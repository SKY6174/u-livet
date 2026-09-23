import { getOperationContext } from "@/lib/operation-documents/data";
import { initialDocument } from "@/lib/operation-documents/model";
import { DocumentPreview } from "@/components/operation-documents/document-preview";
import { notFound, redirect } from "next/navigation";
import { Empty } from "@/components/portal/ui";
import { ReportDocuments } from "@/components/reports/report-documents";
import { PrintToolbar } from "@/components/reports/print-toolbar";
import { getManagedReport } from "@/lib/reports/data";
import { DOCUMENTS, type DocumentKind } from "@/lib/reports/types";
import { getAttendanceBook } from "@/lib/attendance/data";
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
  if (document === "result") redirect(`/operation-documents/${id}/result/print`);
  if (!bundle)
    return (
      <div className="page-shell">
        <Empty title="보고서를 불러오지 못했습니다">
          잠시 후 다시 시도해 주세요.
        </Empty>
      </div>
    );
  const [context, attendance] = await Promise.all([
    ["all", "scholarships"].includes(document) ? getOperationContext(id) : Promise.resolve(null),
    ["all", "attendance"].includes(document) ? getAttendanceBook(id,"manager") : Promise.resolve(null),
  ]);
  const official = context ? initialDocument(context, "result") : null;
  return (
    <>
      <PrintToolbar
        document={document}
        reveal={query.reveal === "1"}
      />
      {document === "all" && official && <>
        <DocumentPreview kind="result" content={official.content} budget={official.budget} status={official.status} revision={official.revision} />
        {DOCUMENTS.filter(([kind]) => kind !== "result").map(([kind]) => <ReportDocuments key={kind} offering={offering} bundle={bundle} document={kind} attendanceBook={attendance?.book} reveal={query.reveal === "1"} officialScholarships={official.budget.scholarships} />)}
      </>}
      {document !== "all" && <ReportDocuments offering={offering} bundle={bundle} document={document as DocumentKind} attendanceBook={attendance?.book} reveal={query.reveal === "1"} officialScholarships={official?.budget.scholarships} />}

    </>
  );
}
