import Link from "next/link";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { dateTime } from "@/lib/portal/data";
import { Empty, PageIntro } from "@/components/portal/ui";
import { outcomeLabels, type HistoryRow } from "@/lib/portal/evaluation";
import { LearningRecordJourney } from "@/components/student-learning/learning-record-journey";
export default async function History() {
  await requireIdentity("/mypage/history");
  const { data, error } = await (
    await createServerSupabaseClient()
  ).rpc("life_completion_history");
  const rows = (data ?? []) as HistoryRow[];
  const completed = rows.filter((row) => row.approved_at && !row.stale);
  const unconfirmed = rows.length - completed.length;
  return (
    <div className="page-shell">
      <PageIntro eyebrow="LEARNING RECORD" title="수강이력·수료 현황">
        U-LiVET에서 수강한 과정과 사업단이 확정한 수료 상태를 확인하세요.
      </PageIntro>
      {error ? (
        <div role="status" className="panel">
          <Empty title="수강이력을 불러오지 못했습니다" />
          <Link className="btn-secondary mt-4" href="/mypage/history">다시 불러오기</Link>
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3" aria-label="수강이력 요약">
            {[
              ["전체 수강이력", rows.length],
              ["수료 확정", completed.length],
              ["수료 미확정", unconfirmed],
            ].map(([label, count]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-600">{label}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{count}<span className="ml-1 text-sm font-normal">과정</span></p>
              </div>
            ))}
          </div>
          <div className="mb-6 flex flex-wrap gap-3">
            <Link className="btn-primary" href="/mypage/certificates">사업단 이수증 신청·발급</Link>
            <Link className="btn-secondary" href="/mypage/badges">나의 디지털배지</Link>
          </div>
          {!rows.length ? (
            <div className="panel">
              <Empty title="수강이력이 없습니다" />
              <Link className="btn-secondary mt-4" href="/courses">교육과정 둘러보기</Link>
            </div>
          ) : (
            <div className="space-y-5">
              {rows.map((r) => (
                <article className="panel" key={r.offering_id}>
                  <div className="flex flex-wrap justify-between gap-3">
                    <h2 className="text-lg font-semibold">{r.name}</h2>
                    <span className="badge">
                      {r.stale
                        ? "자료 변경 · 재검토 필요"
                        : r.approved_at
                          ? "수료 확정"
                          : r.outcome
                            ? outcomeLabels[r.outcome]
                            : "수료 검토 전"}
                    </span>
                  </div>
                  {r.reasons?.length ? (
                    <ul className="my-4 list-inside list-disc text-sm">
                      {r.reasons.map((s) => <li key={s}>{s}</li>)}
                    </ul>
                  ) : null}
                  {r.approved_at && !r.stale && (
                    <p className="my-3 text-sm text-teal-800">확정일 {dateTime(r.approved_at)}</p>
                  )}
                  <Link href={`/learning/${r.offering_id}`} className="mt-4 inline-block text-sm font-semibold text-teal-800 hover:underline">
                    강의실 보기 →
                  </Link>
                </article>
              ))}
            </div>
          )}
        </>
      )}
      <LearningRecordJourney />
    </div>
  );
}
