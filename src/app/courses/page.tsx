import Link from "next/link";
import { LayoutGrid, List, Search } from "lucide-react";
import { editableGuideOrgs, getCourseCatalog } from "@/lib/course-guide/data";
import { getSessionIdentity } from "@/lib/auth/session";
import { catalogFilters, catalogHref, filterCatalog, type CatalogSearch } from "@/lib/course-guide/model";
import { GuideCard, GuideList } from "@/components/course-guide/catalog";
import { Empty, PageIntro } from "@/components/portal/ui";

export default async function Courses(props: { searchParams: Promise<CatalogSearch> }) {
  const filters = catalogFilters(await props.searchParams);
  const [{ courses, unavailable }, identity] = await Promise.all([getCourseCatalog(), getSessionIdentity()]);
  const editableOrgs = editableGuideOrgs(identity);
  const items = filterCatalog(courses, filters);
  return (
    <div className="page-shell">
      <PageIntro eyebrow="COURSES" title="교육과정 찾기">내가 원하는 배움, 나에게 맞는 일정으로 시작하세요.</PageIntro>
      <form action="/courses" className="mb-8 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <input type="hidden" name="view" value={filters.view} />
        <label className="field w-full flex-1 sm:min-w-[180px]">과정 검색<input name="q" placeholder="과정명, 관심 분야, 자격증" defaultValue={filters.q} maxLength={100} type="search" /></label>
        <label className="field">운영방식<select name="mode" defaultValue={filters.mode}><option value="">전체</option><option value="ONLINE">온라인</option><option value="OFFLINE">대면</option><option value="BLENDED">혼합</option></select></label>
        <button className="btn-primary gap-2"><Search size={17} aria-hidden="true" />검색</button>
      </form>
      {unavailable && <p role="alert" className="notice mb-5">일부 교육과정을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-500">{unavailable ? "불러온" : "총"} <strong className="text-lg font-bold text-slate-900">{items.length}</strong>개 과정</p>
        <nav aria-label="과정 보기 방식" className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {([["cards", "카드형", LayoutGrid], ["list", "리스트형", List]] as const).map(([view, label, Icon]) => <Link key={view} href={catalogHref(filters, view)} scroll={false} aria-current={filters.view === view ? "page" : undefined} className={`inline-flex min-h-12 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${filters.view === view ? "bg-teal-800 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}><Icon size={16} aria-hidden="true" />{label}</Link>)}
        </nav>
      </div>
      {items.length ? filters.view === "list" ? <GuideList courses={items} editableOrgs={editableOrgs} /> : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" data-course-grid>{items.map((course, index) => <GuideCard key={course.id} course={course} index={index} canEdit={!!course.org_id && editableOrgs.includes(course.org_id)} />)}</div>
      ) : <Empty title={unavailable ? "교육과정을 불러오지 못했습니다" : "조건에 맞는 교육과정이 없습니다"}>{unavailable ? "잠시 후 다시 확인해 주세요." : "다른 검색어를 입력하거나 운영방식을 전체로 변경해 보세요."}</Empty>}
    </div>
  );
}
