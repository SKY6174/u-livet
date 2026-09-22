import { notFound } from "next/navigation";
import { getOperationContext } from "@/lib/operation-documents/data";
import { DocumentEditor } from "@/components/operation-documents/document-editor";
export const dynamic = "force-dynamic";
export const metadata = { title: "과정 운영 문서 · U-LIFE" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; kind: string }>;
}) {
  const { id, kind } = await params;
  if (kind !== "plan" && kind !== "result") notFound();
  return <DocumentEditor initial={await getOperationContext(id)} kind={kind} />;
}
