import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { getCourseCatalog } from "@/lib/course-guide/data";
import { LearnerDocumentEditor } from "@/components/learner-documents/editor";
import { isDocumentType } from "@/lib/learner-documents/model";
import { getLearnerDocumentProfile } from "@/lib/learner-documents/profile";
import { UUID } from "@/lib/portal/data";
import { Empty } from "@/components/portal/ui";
import {
  getLearnerDocumentEligibility,
  getMyLearnerDocuments,
} from "@/lib/learner-document-workflow/data";

export const metadata: Metadata = {
  title: "수강생 작성 서류 | U-LiVET",
  robots: { index: false, follow: false },
};

export default async function LearnerDocumentsPage({ searchParams }: {
  searchParams: Promise<{ type?: string | string[]; course?: string | string[] }>;
}) {
  const query = await searchParams;
  if (query.course !== undefined && (typeof query.course !== "string" || query.course.length > 100
    || (!UUID.test(query.course) && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(query.course)))) notFound();
  const requestedType = typeof query.type === "string" && isDocumentType(query.type) ? query.type : "application";
  const selection = new URLSearchParams({ type: requestedType });
  if (typeof query.course === "string") selection.set("course", query.course);
  const identity = await requireIdentity(`/mypage/documents?${selection}`);
  const [catalog, requests, eligibility, profile] = await Promise.all([
    getCourseCatalog(),
    getMyLearnerDocuments(),
    getLearnerDocumentEligibility(),
    getLearnerDocumentProfile(),
  ]);
  const courses = catalog.courses.map(({ id, name, offeringId, tuition }) => ({
    id,
    name,
    offeringId,
    tuition,
  }));
  const availableOfferings = new Set(courses.map(course => course.offeringId).filter(Boolean));
  const initialCourse = courses.find(course => course.id === query.course || course.offeringId === query.course);
  if (query.course && !initialCourse) {
    if (!catalog.unavailable) notFound();
    return <div className="page-shell"><Empty title="선택한 과정을 불러오지 못했습니다.">잠시 후 다시 시도해 주세요.</Empty>
      <Link href="/mypage/documents" className="btn-secondary mt-4">수강생 서류 작성으로 이동</Link></div>;
  }
  const type = requestedType === "refund" && !eligibility.some(item => item.refund_allowed && availableOfferings.has(item.offering_id))
    ? "application"
    : requestedType === "scholarship" && !eligibility.some(item => item.scholarship_allowed && availableOfferings.has(item.offering_id))
      ? "application"
      : requestedType;
  return <LearnerDocumentEditor type={type} name={identity.name} email={identity.email} courses={courses}
    requests={requests} eligibility={eligibility} profile={profile} profileUnavailable={profile.unavailable}
    initialCourse={initialCourse} />;
}
