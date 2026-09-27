import { DocumentList } from "@/components/operation-documents/document-list";

export const metadata = { title: "결과보고서 · U-LiVE" };

export default async function Page({ searchParams }: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  return <DocumentList kind="result" view={view === "evidence" ? "evidence" : "official"} />;
}
