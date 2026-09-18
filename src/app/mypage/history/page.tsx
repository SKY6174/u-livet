import Link from "next/link";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { dateTime } from "@/lib/portal/data";
import { Empty, PageIntro } from "@/components/portal/ui";
import { outcomeLabels, type HistoryRow } from "@/lib/portal/evaluation";
export default async function History() {
  await requireIdentity("/mypage/history");
  const { data, error } = await (
    await createServerSupabaseClient()
  ).rpc("life_completion_history");
  const rows = (data ?? []) as HistoryRow[];
  return (
    <div className="page-shell">
      <PageIntro eyebrow="LEARNING RECORD" title="수강이력·수료 현황">
        사업단이 검토한 수료 상태를 확인하고 이수증·디지털배지로 연결하세요.
      </PageIntro>
      <Link className="btn-secondary mb-6" href="/mypage/certificates">
        증명 신청·발급 →
      </Link>
      <Link className="btn-secondary mb-6 ml-3" href="/mypage/badges">
        나의 디지털배지 →
      </Link>
      {error ? (
        <Empty title="수강이력을 불러오지 못했습니다" />
      ) : !rows.length ? (
        <Empty title="수강이력이 없습니다" />
      ) : (
        <div className="space-y-5">
          {rows.map((r) => (
            <article className="panel" key={r.offering_id}>
              <div className="flex flex-wrap justify-between gap-3">
                <h2 className="text-lg font-semibold">{r.name}</h2>
                <span className="badge">
                  {!r.outcome
                    ? "수료 검토 전"
                    : r.stale
                      ? "자료 변경 · 재검토 필요"
                      : r.approved_at
                        ? "수료 확정"
                        : outcomeLabels[r.outcome]}
                </span>
              </div>
              {r.reasons?.length ? (
                <ul className="my-4 list-inside list-disc text-sm">
                  {r.reasons.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : null}
              {r.approved_at && !r.stale && (
                <p className="my-3 text-sm text-teal-800">
                  확정일 {dateTime(r.approved_at)}
                </p>
              )}
              <Link
                href={`/learning/${r.offering_id}`}
                className="mt-4 inline-block text-sm text-teal-800"
              >
                강의실 보기 →
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
