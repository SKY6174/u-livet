import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID, dateTime } from "@/lib/portal/data";
import { outcomeLabels } from "@/lib/portal/evaluation";
import { PageIntro, Empty } from "@/components/portal/ui";
type Completion = { person_id: string; name: string; outcome: string | null; reasons: string[] | null; approved_at: string | null; stale: boolean };
export default async function InstructorCompletion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireIdentity(`/instructor/offerings/${id}/completion`);
  if (!UUID.test(id)) notFound();
  const { data, error } = await (await createServerSupabaseClient()).rpc("life_instructor_completion", { f: id });
  if (error?.message === "FORBIDDEN") notFound();
  return <div className="page-shell">
    <PageIntro eyebrow="COMPLETION STATUS" title="수강생 이수 확인">출결·과제·시험을 확인하고, 사업단이 검토한 수료 결과를 확인합니다.</PageIntro>
    <p className="notice mb-6">강사는 출결과 평가 근거를 확인합니다. 최종 수료 승인과 증명서 발급은 사업단 담당자가 진행하며, QR 입실만으로 수료가 인정되지는 않습니다.</p>
    <div className="mb-6 flex flex-wrap gap-3"><Link className="btn-secondary" href={`/instructor/offerings/${id}/attendance`}>출석부 확인</Link><Link className="btn-secondary" href={`/instructor/offerings/${id}/evaluation`}>시험·평가 확인</Link><Link className="btn-secondary" href={`/quality/${id}`}>종강 만족도 조사</Link></div>
    {error || !Array.isArray(data) ? <Empty title="이수 현황을 불러오지 못했습니다">잠시 후 다시 확인하거나 사업단에 문의해 주세요.</Empty> : !data.length ? <Empty title="수강 확정자가 없습니다" /> : <div className="grid gap-4 md:grid-cols-2">{(data as Completion[]).map(row => <article key={row.person_id} className="panel">
      <h2 className="text-lg font-bold">{row.name}</h2>
      <span className="badge mt-3">{!row.outcome ? "판정 전" : row.stale ? "근거 변경·재검토 필요" : row.approved_at && row.outcome === "READY" ? "수료 승인 완료" : outcomeLabels[row.outcome] ?? "확인 필요"}</span>
      {row.approved_at && !row.stale && <p className="mt-3 text-sm">승인 {dateTime(row.approved_at)}</p>}
      {!!row.reasons?.length && <ul className="mt-3 list-inside list-disc text-sm text-slate-600">{row.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
    </article>)}</div>}
  </div>;
}
