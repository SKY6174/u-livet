import Link from "next/link";
import { PageIntro } from "@/components/portal/ui";
import { getLearnerDetail, requireManager } from "@/lib/management/data";
import { hasRole } from "@/lib/auth/workspace-navigation";
import { ApplicationRows } from "@/components/management/management-list";
export default async function Learner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireManager(`/admin/learners/${id}`);
  const p = await getLearnerDetail(id);
  return <div className="page-shell">
    <PageIntro eyebrow="LEARNER" title={`${p.name} · 수강생 상세`} />
    <section className="panel mb-6">
      <dl className="grid gap-4 sm:grid-cols-2"><div><dt>이메일</dt><dd className="break-all">{p.email ?? "미등록"}</dd></div><div><dt>연락처</dt><dd>{p.phone ?? "미등록"}</dd></div></dl>
      {!p.active && <p className="notice mt-4">삭제된 계정입니다. 신청·수강 이력은 보존되어 있습니다.</p>}
      {p.active && hasRole(me, "SYSTEM_ADMIN") && <Link className="btn-secondary mt-4" href={`/admin/accounts/${p.id}?group=learner`}>회원 정보 수정·계정 삭제</Link>}
    </section>
    <h2 className="section-title">담당 과정의 신청·수강 이력</h2><ApplicationRows items={p.applications} />
  </div>;
}
