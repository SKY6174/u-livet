import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowUpRight, Award, BookOpen } from "lucide-react";
import { canEditGuide, getCourseGuide } from "@/lib/course-guide/data";
import { getSessionIdentity } from "@/lib/auth/session";
import { dateTime, getCourseIntroduction, getPolicies, modeLabel } from "@/lib/portal/data";
import { PageIntro } from "@/components/portal/ui";
import { ScholarshipNotice } from "@/components/portal/scholarship-notice";
import { DocumentPopup } from "@/components/instructor-documents/document-popup";
import { applicationDocumentHref } from "@/lib/learner-documents/model";

export default async function CourseGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const course = await getCourseGuide((await params).id);
  if (!course) notFound();
  const [offering, identity] = await Promise.all([
    course.offering_id ? getCourseIntroduction(course.offering_id) : Promise.resolve(null),
    getSessionIdentity(),
  ]);
  const completion = offering?.completion_policy_id
    ? (await getPolicies("COMPLETION", offering.completion_policy_id))
      .find((policy) => !policy.title.startsWith("[검증용]"))
    : null;
  const information = [
    ["교육기간", course.period_label],
    ["요일 · 시간", course.time_label],
    ["교육장소", course.location],
    ["운영방식", modeLabel[course.mode]],
    ["모집정원", `${course.capacity}명`],
    ["교육시수", `${course.teaching_hours}시간`],
    ["수강료", !offering ? "모집 공고 준비 중" : offering.tuition === null ? "수강료 미기재" : offering.tuition === 0 ? "무료" : `${offering.tuition.toLocaleString("ko-KR")}원`],
    ["접수기간", !offering ? "모집 공고 준비 중" : offering.status === "ARCHIVED" ? "접수 종료" : `${dateTime(offering.apply_from)} ~ ${dateTime(offering.apply_until)}`],
  ];
  return (
    <div className="page-shell">
      <PageIntro eyebrow={`${course.year} · ${course.academy}`} title={course.name}>{course.summary}</PageIntro>
      {canEditGuide(identity, course.org_id) && <Link href={`/admin/courses/guides/${course.id}`} className="btn-secondary mb-6">과정 수정</Link>}
      {course.card_image_url && <div className="relative mb-6 h-48 overflow-hidden rounded-2xl bg-slate-100 sm:h-64"><Image src={course.card_image_url} alt="" fill sizes="(max-width: 1024px) 100vw, 1200px" className="object-cover" unoptimized /></div>}
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="order-2 min-w-0 space-y-6 lg:order-1">
          <section className="panel"><h2 className="section-title flex items-center gap-2"><BookOpen size={20} className="text-teal-700" aria-hidden="true" />무엇을 배우나요?</h2><ol className="space-y-4">{course.curriculum.map((item, index) => <li key={item} className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-800">{index + 1}</span><span className="pt-0.5 leading-6 text-slate-700">{item}</span></li>)}</ol></section>
          <section className="panel"><h2 className="section-title flex items-center gap-2"><Award size={20} className="text-teal-700" aria-hidden="true" />관련 자격증</h2><p className="font-semibold text-slate-800">{course.certificate ?? "관련 자격증 미기재"}</p>{course.certificate && <p className="mt-3 text-sm text-slate-500">자격증 취득 요건과 응시 일정은 과정별 안내를 확인해 주세요.</p>}</section>
          <section className="panel">
            <h2 className="section-title">이수요건</h2>
            {completion ? <>
              <p className="mb-3 text-sm text-slate-500">승인된 수료기준 · {completion.title} · {completion.version}</p>
              <p className="whitespace-pre-wrap leading-7">{completion.body}</p>
            </> : <p className="text-slate-600">승인된 이수요건을 확인 중입니다. 모집 공고에서 확정 기준을 확인해 주세요.</p>}
          </section>
          <ScholarshipNotice />
          {course.schedule_history.length > 0 && <section className="panel"><h2 className="section-title">일정 변경 안내</h2><ul className="space-y-2 text-sm text-slate-600">{course.schedule_history.map((entry) => <li key={entry}>{entry}</li>)}</ul></section>}
        </div>
        <aside className="panel order-1 lg:order-2">
          <h2 className="section-title">교육 안내</h2>
          <dl className="space-y-5 text-sm">{information.map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1.5 whitespace-pre-line font-medium leading-6 text-slate-900">{value}</dd></div>)}</dl>
          <DocumentPopup href={applicationDocumentHref(course.id)} windowName="learner-documents" className="btn-primary mt-4 w-full justify-center">수강신청원서 작성</DocumentPopup>
          {offering && <Link href={`/offerings/${offering.id}`} className="btn-secondary mt-4 w-full justify-center gap-2">{offering.status === "ARCHIVED" ? "지난 운영 과정 보기" : "수강신청 안내 확인"}<ArrowUpRight size={16} aria-hidden="true" /></Link>}
        </aside>
      </div>
    </div>
  );
}
