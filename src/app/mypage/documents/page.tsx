import type { Metadata } from "next";
import { requireIdentity } from "@/lib/auth/session";
import { getCourseCatalog } from "@/lib/course-guide/data";
import { LearnerDocumentEditor } from "@/components/learner-documents/editor";
import { isDocumentType } from "@/lib/learner-documents/model";
import { getMyLearnerDocuments } from "@/lib/learner-document-workflow/data";

export const metadata: Metadata = {
  title: "수강생 작성 서류 | U-LIFE",
  robots: { index: false, follow: false },
};

export default async function LearnerDocumentsPage({ searchParams }: {
  searchParams: Promise<{ type?: string; course?: string }>;
}) {
  const identity = await requireIdentity("/mypage/documents");
  const [catalog, requests, query] = await Promise.all([
    getCourseCatalog(),
    getMyLearnerDocuments(),
    searchParams,
  ]);
  const courses = catalog.courses.map(({ id, name, offeringId, tuition }) => ({
    id,
    name,
    offeringId,
    tuition,
  }));
  const type = query.type && isDocumentType(query.type) ? query.type : "application";
  return <LearnerDocumentEditor type={type} name={identity.name} email={identity.email} courses={courses}
    requests={requests} initialCourse={courses.find(course => course.id === query.course || course.offeringId === query.course)} />;
}
