import { notFound } from "next/navigation";
import { getOperationContext } from "@/lib/operation-documents/data";
import {
  initialDocument,
  type OperationDocument,
} from "@/lib/operation-documents/model";
import { documentLabel } from "@/lib/operation-documents/schema";
import { DocumentPreview } from "@/components/operation-documents/document-preview";
import { OperationPrintControls } from "@/components/operation-documents/document-editor";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import { getSessionIdentity } from "@/lib/auth/session";
import { getManagedReport } from "@/lib/reports/data";
import { ReportDocuments } from "@/components/reports/report-documents";
export const dynamic = "force-dynamic";
export default async function Print({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; kind: string }>;
  searchParams: Promise<{ submission?: string }>;
}) {
  const { id, kind } = await params,
    query = await searchParams;
  if (kind !== "plan" && kind !== "result") notFound();
  const context = await getOperationContext(id);
  let doc = initialDocument(context, kind);
  if (query.submission) {
    if (!UUID.test(query.submission)) notFound();
    const { data, error } = await (
      await createServerSupabaseClient()
    ).rpc("life_operation_submission", { f: id, s: query.submission });
    if (error || !data || data.kind !== kind) notFound();
    doc = data as OperationDocument;
  }
  const identity = kind === "result" && !query.submission && context.manager ? await getSessionIdentity() : null;
  const includeLedger = identity?.roles.some((role) => role.role === "COURSE_MANAGER" && role.org_id === context.course.org_id);
  const report = includeLedger ? await getManagedReport(id) : null;
  return (
    <>
      <OperationPrintControls
        title={`${doc.content.fields.year}년 ${doc.content.fields.title} ${documentLabel(kind)} v${doc.revision}`}
      />
      <DocumentPreview
        kind={kind}
        content={doc.content}
        budget={doc.budget}
        status={doc.status}
        revision={doc.revision}
      />
      {report?.bundle && <ReportDocuments offering={report.offering} bundle={report.bundle} document="teaching" />}
    </>
  );
}
