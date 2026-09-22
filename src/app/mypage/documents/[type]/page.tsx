import { notFound, redirect } from "next/navigation";
import { isDocumentType } from "@/lib/learner-documents/model";

type Props = { params: Promise<{ type: string }>; searchParams: Promise<{ course?: string }> };
export default async function LearnerDocumentPage({ params, searchParams }: Props) {
  const { type } = await params;
  if (!isDocumentType(type)) notFound();
  const { course } = await searchParams;
  const query = new URLSearchParams({ type });
  if (typeof course === "string" && course.length <= 100) query.set("course", course);
  redirect(`/mypage/documents?${query}`);
}
