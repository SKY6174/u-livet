import Link from "next/link";
import { PageIntro, Empty } from "@/components/portal/ui";
import { dateTime, statusLabel } from "@/lib/portal/data";
import { APPLICATION_STATUSES, type Filters, type ManagementBoard, type ManagedApplication, type ManagedLearner } from "@/lib/management/data";

export function ApplicationRows({ items }: { items: ManagedApplication[] }) {
  return <div role="region" aria-label="신청내역 목록" tabIndex={0} className="overflow-x-auto rounded-2xl border border-slate-200 bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">
    <table className="w-full min-w-[960px] text-left text-sm">
      <caption className="sr-only">신청자별 과정 신청 및 수강 상태</caption>
      <thead className="bg-slate-50 text-slate-600">
        <tr>{["신청자", "과정", "신청 상태", "신청일시", "수강 상태"].map(label => <th key={label} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">{label}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-200">
        {items.map(a => <tr key={a.id} className="hover:bg-teal-50/40">
          <th scope="row" className="min-w-32 px-4 py-3 font-semibold">
            <Link className="underline" href={`/admin/applications/${a.id}`} aria-label={`${a.name} · ${a.course_name} 신청 상세`}>{a.name}</Link>
            {!a.active && <span className="mt-1 block font-normal text-slate-600">삭제된 계정</span>}
          </th>
          <td className="min-w-64 max-w-md break-words px-4 py-3">{a.course_name}</td>
          <td className="whitespace-nowrap px-4 py-3">{statusLabel[a.status] ?? a.status}</td>
          <td className="whitespace-nowrap px-4 py-3 text-slate-600"><time dateTime={a.submitted_at}>{dateTime(a.submitted_at)}</time></td>
          <td className="whitespace-nowrap px-4 py-3 text-slate-600">{a.enrollment_status === "ACTIVE" ? "수강 중" : a.enrollment_status === "WITHDRAWN" ? "수강 취소" : "수강 미확정"}</td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}
export function ManagementList({ kind, data, filters }: { kind: "applications" | "learners"; data: ManagementBoard<ManagedApplication> | ManagementBoard<ManagedLearner>; filters: Filters }) {
  const path = `/admin/${kind}`;
  const pageHref = (page: number) => `${path}?${new URLSearchParams({ course: filters.course, q: filters.q, ...(kind === "applications" ? { status: filters.status } : {}), page: String(page) })}`;
  return <div className="page-shell">
    <PageIntro eyebrow="COURSE MANAGEMENT" title={kind === "applications" ? "신청내역 관리" : "수강생 관리"}>담당 기관의 과정에 접수된 신청과 수강 이력을 확인합니다.</PageIntro>
    <form className="panel mb-6 grid gap-4 md:grid-cols-4" action={path}>
      <label className="field">과정<select name="course" defaultValue={filters.course}><option value="">전체 담당 과정</option>{data.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      {kind === "applications" && <label className="field">신청 상태<select name="status" defaultValue={filters.status}><option value="">전체 상태</option>{APPLICATION_STATUSES.map(s => <option key={s} value={s}>{statusLabel[s] ?? s}</option>)}</select></label>}
      <label className="field">신청자 이름<input name="q" maxLength={100} defaultValue={filters.q} placeholder="이름 검색" /></label>
      <button className="btn-primary self-end" type="submit">검색</button>
    </form>
    <p className="mb-4 text-slate-600">총 {data.count}{kind === "applications" ? "건" : "명"} · {filters.page}페이지</p>
    {!data.items.length ? <Empty title="조건에 맞는 내역이 없습니다" /> : kind === "applications" ? <ApplicationRows items={data.items as ManagedApplication[]} /> : <div className="space-y-4">{(data.items as ManagedLearner[]).map(p => <article className="panel" key={p.id}>
      <h2 className="text-lg font-bold"><Link className="underline" href={`/admin/learners/${p.id}`}>{p.name}{!p.active && " · 삭제된 계정"}</Link></h2>
      <p className="mt-3">신청 {p.applications}건 · 수강 중 {p.enrollments}개 과정</p>
    </article>)}</div>}
    <nav aria-label="목록 페이지" className="mt-6 flex gap-4">
      {filters.page > 1 && <Link className="btn-secondary" href={pageHref(filters.page - 1)}>이전</Link>}
      {filters.page * 40 < data.count && <Link className="btn-secondary" href={pageHref(filters.page + 1)}>다음</Link>}
    </nav>
  </div>;
}
