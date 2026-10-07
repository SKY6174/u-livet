import Link from "next/link";
import { PageIntro, Empty } from "@/components/portal/ui";
import { dateTime, statusLabel } from "@/lib/portal/data";
import { APPLICATION_STATUSES, type Filters, type ManagementBoard, type ManagedApplication, type ManagedLearner } from "@/lib/management/data";

export function ApplicationRows({ items }: { items: ManagedApplication[] }) {
  return <div className="space-y-4">{items.map(a => <article key={a.id} className="panel">
    <h3 className="text-lg font-bold"><Link className="underline" href={`/admin/applications/${a.id}`}>{a.name} · {a.course_name}</Link></h3>
    <p className="mt-3">{statusLabel[a.status] ?? a.status} · {dateTime(a.submitted_at)}{!a.active && " · 삭제된 계정"}</p>
    <p className="mt-2 text-sm text-slate-600">{a.enrollment_status === "ACTIVE" ? "수강 중" : a.enrollment_status === "WITHDRAWN" ? "수강 취소" : "수강 미확정"}</p>
  </article>)}</div>;
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
