import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Award, BookOpen } from "lucide-react";
import { getCourseGuide } from "@/lib/course-guide/data";
import { getCourseIntroduction, modeLabel } from "@/lib/portal/data";
import { PageIntro } from "@/components/portal/ui";

export default async function CourseGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const course = await getCourseGuide((await params).id);
  if (!course) notFound();
  const offering = course.offering_id ? await getCourseIntroduction(course.offering_id) : null;
  return (
    <div className="page-shell">
      <Link href="/courses" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-teal-800"><ArrowLeft size={16} aria-hidden="true" />교육과정 목록</Link>
      <PageIntro eyebrow={`${course.year} · ${course.academy}`} title={course.name}>{course.summary}</PageIntro>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="panel"><h2 className="section-title flex items-center gap-2"><BookOpen size={20} className="text-teal-700" aria-hidden="true" />무엇을 배우나요?</h2><ol className="space-y-4">{course.curriculum.map((item, index) => <li key={item} className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-800">{index + 1}</span><span className="pt-0.5 leading-6 text-slate-700">{item}</span></li>)}</ol></section>
          <section className="panel"><h2 className="section-title flex items-center gap-2"><Award size={20} className="text-teal-700" aria-hidden="true" />관련 자격증</h2><p className="font-semibold text-slate-800">{course.certificate ?? "관련 자격증 미기재"}</p>{course.certificate && <p className="mt-3 text-sm text-slate-500">자격증 취득 요건과 응시 일정은 과정별 안내를 확인해 주세요.</p>}</section>
          {course.schedule_history.length > 0 && <section className="panel"><h2 className="section-title">일정 변경 안내</h2><ul className="space-y-2 text-sm text-slate-600">{course.schedule_history.map((entry) => <li key={entry}>{entry}</li>)}</ul></section>}
        </div>
        <aside className="panel">
          <h2 className="section-title">교육 안내</h2>
          <dl className="space-y-5 text-sm">{[["교육기간", course.period_label], ["요일 · 시간", course.time_label], ["교육장소", course.location], ["운영방식", modeLabel[course.mode]], ["모집정원", `${course.capacity}명`], ["교육시수", `${course.teaching_hours}시간`]].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1.5 font-medium leading-6 text-slate-900">{value}</dd></div>)}</dl>
          <p className="notice mt-6">수강료와 신청 일정은 별도 모집 안내를 확인해 주세요.</p>
          {offering && <Link href={`/offerings/${offering.id}`} className="btn-secondary mt-4 w-full justify-center gap-2">{offering.status === "ARCHIVED" ? "지난 운영 과정 보기" : "수강신청 안내 확인"}<ArrowUpRight size={16} aria-hidden="true" /></Link>}
        </aside>
      </div>
    </div>
  );
}
