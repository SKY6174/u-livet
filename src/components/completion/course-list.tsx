import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { formatDateRange } from "@/lib/date-format";
import { statusLabel } from "@/lib/portal/data";
import type { CompletionCourse } from "@/lib/completion/offerings";

export function CompletionCourseList({ courses, manager }: { courses: CompletionCourse[]; manager: boolean }) {
  return <div role="region" aria-label="수료 검토 과정 목록" tabIndex={0} className="overflow-x-auto rounded-2xl border border-slate-200 bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">
    <table className="w-full min-w-[1060px] text-left text-sm">
      <caption className="sr-only">운영 과정별 수료 검토 및 등록 상태</caption>
      <thead className="bg-slate-50 text-slate-600"><tr>{["순번", "과정", "사업연도", "교육기간", "정원", "상태", "관리"].map(label => <th key={label} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-200">
        {courses.map((course, index) => <tr key={course.id} className="hover:bg-teal-50/40">
          <td className="px-4 py-3 text-slate-500">{index + 1}</td>
          <th scope="row" className="min-w-64 max-w-md break-words px-4 py-3 font-semibold"><span className="mb-1 block text-xs font-normal text-teal-700">{course.academy}</span>{course.name}</th>
          <td className="px-4 py-3 text-slate-600">{course.yearLabel}</td>
          <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">{formatDateRange(course.startsOn, course.endsOn)}</td>
          <td className="whitespace-nowrap px-4 py-3">{course.capacity === null ? "미정" : `${course.capacity}명`}</td>
          <td className="px-4 py-3"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${course.registered ? "bg-teal-50 text-teal-800" : "bg-slate-100 text-slate-600"}`}>{course.registered ? statusLabel[course.status ?? ""] ?? "등록 완료" : "과정 등록 필요"}</span></td>
          <td className="px-4 py-3">{course.registered ? <Link className="btn-secondary gap-2 text-sm" href={`/completion/${course.id}`} aria-label={`${course.name} 수료 검토`}>수료 검토<ArrowRight size={15} aria-hidden="true" /></Link> : manager && course.sourceId ? <Link className="btn-secondary gap-2 text-sm" href={`/admin/courses?plan=${course.sourceId}#new-course`} aria-label={`${course.name} 과정 등록`}>과정 등록<Plus size={15} aria-hidden="true" /></Link> : <span className="text-xs text-slate-500">과정담당 등록 대기</span>}</td>
        </tr>)}
        {!courses.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">수료 검토 대상 과정이 없습니다.</td></tr>}
      </tbody>
    </table>
  </div>;
}
