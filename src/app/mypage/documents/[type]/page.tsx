import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireIdentity } from "@/lib/auth/session";
import { getCourseCatalog } from "@/lib/course-guide/data";
import { LearnerDocumentEditor } from "@/components/learner-documents/editor";
import { DOCUMENT_TITLES, isDocumentType } from "@/lib/learner-documents/model";

type Props = { params: Promise<{ type: string }>; searchParams: Promise<{ course?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type } = await params;
  return { title: isDocumentType(type) ? `${DOCUMENT_TITLES[type]} | U-LIFE` : "수강생 서식 | U-LIFE", robots: { index: false, follow: false } };
}
export default async function LearnerDocumentPage({ params, searchParams }: Props) {
  const { type } = await params;
  if (!isDocumentType(type)) notFound();
  const identity = await requireIdentity(`/mypage/documents/${type}`);
  const [catalog, query] = await Promise.all([getCourseCatalog(), searchParams]);
  const courses = catalog.courses.map(({ id, name }) => ({ id, name }));
  return <LearnerDocumentEditor key={type} type={type} name={identity.name} email={identity.email} courses={courses}
    initialCourse={courses.find(course => course.id === query.course)?.name} />;
}
