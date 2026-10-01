import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Award, CalendarDays, Clock3, HeartPulse, Lightbulb, Sparkles, Users } from "lucide-react";
import type { CatalogCourse } from "@/lib/course-guide/model";
import { modeLabel } from "@/lib/portal/data";

function academyStyle(academy: string) {
  if (academy.startsWith("라이프케어")) return { Icon: HeartPulse, badge: "bg-teal-50 text-teal-800", accent: "bg-teal-600" };
  if (academy.startsWith("로컬창업")) return { Icon: Lightbulb, badge: "bg-amber-50 text-amber-800", accent: "bg-amber-500" };
  return { Icon: Sparkles, badge: "bg-indigo-50 text-indigo-800", accent: "bg-indigo-500" };
}
export function GuideCard({ course: c, index, canEdit = false }: { course: CatalogCourse; index: number; canEdit?: boolean }) {
  const { Icon, badge, accent } = academyStyle(c.academy);
  return (
    <article data-course-card className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-teal-300 hover:shadow-lg motion-reduce:transform-none motion-reduce:transition-none">
      <div className={`h-1 ${accent}`} />
      {c.card_image_url && <div className="relative h-32 overflow-hidden bg-slate-100"><Image src={c.card_image_url} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw" className="object-cover" unoptimized /></div>}
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-5 flex items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${badge}`}><Icon size={14} aria-hidden="true" />{c.academy}</span>
          <span className="text-xs tabular-nums text-slate-400">{String(index + 1).padStart(2, "0")}</span>
        </div>
        <h2 className="min-h-14 break-keep text-lg font-bold leading-7 tracking-tight text-slate-900 group-hover:text-teal-800">{c.name}</h2>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{c.summary}</p>
        <dl className="mt-5 space-y-2.5 border-t border-slate-100 pt-4 text-sm text-slate-600">
          <div className="flex items-start gap-2"><dt><CalendarDays size={16} className="mt-0.5 text-slate-400" aria-hidden="true" /><span className="sr-only">교육기간</span></dt><dd className="text-[13px] tabular-nums">{c.period_label}</dd></div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <div className="flex items-center gap-2"><dt><Users size={16} className="text-slate-400" aria-hidden="true" /><span className="sr-only">정원</span></dt><dd>{c.capacity}명</dd></div>
            {c.teaching_hours !== null && <div className="flex items-center gap-2"><dt><Clock3 size={16} className="text-slate-400" aria-hidden="true" /><span className="sr-only">교육시수</span></dt><dd>{c.teaching_hours}시간</dd></div>}
            <div><dt className="sr-only">운영방식</dt><dd>{modeLabel[c.mode]}</dd></div>
          </div>
        </dl>
        <div className="mt-auto pt-5">
          <div className="flex min-h-16 items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5">
            <Award size={16} className={c.certificate ? "mt-0.5 shrink-0 text-teal-700" : "mt-0.5 shrink-0 text-slate-400"} aria-hidden="true" />
            <div><p className="text-slate-500">관련 자격증</p><p className={c.certificate ? "font-semibold text-slate-800" : "text-slate-400"}>{c.certificate ?? "미기재"}</p></div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-sm font-semibold text-teal-800">
            <Link href={c.href} className="inline-flex items-center gap-1 after:absolute after:inset-0 after:content-[''] hover:underline">과정 자세히 보기<ArrowUpRight size={18} aria-hidden="true" /></Link>
            {canEdit && c.org_id && <Link href={`/admin/courses/guides/${c.id}`} className="relative z-10 rounded-lg border border-teal-200 px-3 py-1.5 text-teal-800 hover:bg-teal-50">수정</Link>}
          </div>
        </div>
      </div>
    </article>
  );
}
export function GuideList({ courses, editableOrgs = [] }: { courses: CatalogCourse[]; editableOrgs?: string[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm" role="region" aria-label="교육과정 목록" tabIndex={0}>
      <table className="w-full min-w-[980px] text-left text-sm">
        <caption className="sr-only">교육과정의 기간, 정원, 교육시수 및 관련 자격증 비교</caption>
        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500"><tr>{["순번", "교육과정", "교육기간", "운영방식", "정원 · 시수", "관련 자격증", "안내", ...(editableOrgs.length ? ["관리"] : [])].map((label) => <th key={label} scope="col" className="whitespace-nowrap px-5 py-4 font-semibold">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{courses.map((c, index) => (
          <tr key={c.id} className="transition hover:bg-teal-50/40">
            <td className="px-5 py-5 tabular-nums text-slate-400">{String(index + 1).padStart(2, "0")}</td>
            <th scope="row" className="max-w-xs px-5 py-5 font-normal"><span className={`mb-2 inline-block rounded px-2 py-0.5 text-xs font-medium ${academyStyle(c.academy).badge}`}>{c.academy}</span><Link href={c.href} className="block break-keep font-semibold text-slate-900 hover:text-teal-800 hover:underline">{c.name}</Link></th>
            <td className="whitespace-nowrap px-5 py-5 text-slate-600">{c.period_label}</td>
            <td className="whitespace-nowrap px-5 py-5 text-slate-600">{modeLabel[c.mode]}</td>
            <td className="whitespace-nowrap px-5 py-5 text-slate-600">{c.capacity}명{c.teaching_hours !== null ? ` · ${c.teaching_hours}시간` : ""}</td>
            <td className="max-w-48 break-keep px-5 py-5 text-slate-700">{c.certificate ?? <span className="text-slate-400">미기재</span>}</td>
            <td className="px-5 py-5"><Link href={c.href} className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-teal-800 hover:underline" aria-label={`${c.name} 자세히 보기`}>상세<ArrowUpRight size={16} aria-hidden="true" /></Link></td>
            {editableOrgs.length > 0 && <td className="px-5 py-5">{c.org_id && editableOrgs.includes(c.org_id) && <Link href={`/admin/courses/guides/${c.id}`} className="font-semibold text-teal-800 hover:underline" aria-label={`${c.name} 수정`}>수정</Link>}</td>}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
