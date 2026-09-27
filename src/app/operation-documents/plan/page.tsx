import { DocumentList } from "@/components/operation-documents/document-list";

export const metadata = { title: "운영계획서 · U-LiVE" };

export default function Page() {
  return <DocumentList kind="plan" />;
}
