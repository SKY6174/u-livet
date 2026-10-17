import { createServerSupabaseClient } from "@/lib/supabase/server";
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
  const [catalog, requests, eligibility, profile, admissions] = await Promise.all([
    getCourseCatalog(),
    getMyLearnerDocuments(),
    getLearnerDocumentEligibility(),
    getLearnerDocumentProfile(),
    (await createServerSupabaseClient()).from("life_catalog").select("id,status,apply_from,apply_until,starts_on,academic_sealed"),
  ]);
  const now = Date.now(), today = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
  const canApply = new Set((admissions.data ?? []).filter(o => o.status === "PUBLISHED" && !o.academic_sealed && now >= Date.parse(o.apply_from) && now < Date.parse(o.apply_until) && today < o.starts_on).map(o => o.id));
  const courses = catalog.unavailable ? [] : catalog.courses.flatMap(({ id, name, offeringId, tuition, period_label }) =>
    offeringId && UUID.test(offeringId) ? [{ id, name, offeringId, tuition, periodLabel: period_label, canApply: canApply.has(offeringId) }] : []);
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
    coursesUnavailable={catalog.unavailable}
    initialCourse={initialCourse} />;
}
