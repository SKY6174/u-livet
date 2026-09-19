import Link from "next/link";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { dateTime } from "@/lib/portal/data";
import { PageIntro, Empty } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import { answerSurvey } from "@/app/performance-actions";
import type { MySurvey } from "@/lib/performance/types";
export default async function Surveys() {
  await requireIdentity("/mypage/surveys");
  const { data, error } = await (
    await createServerSupabaseClient()
  ).rpc("life_my_surveys");
  const rows = (data ?? []) as MySurvey[];
  return (
    <div className="page-shell">
      <Link className="text-sm text-teal-800 underline" href="/mypage">
        ← 나의 공간
      </Link>
      <PageIntro eyebrow="YOUR FEEDBACK" title="과정 만족도 조사">
        참여는 선택이며 수료·증명 발급에 영향을 주지 않습니다.
      </PageIntro>
      <p className="notice mb-6">
        참여 확인과 답변은 분리해 보관합니다. 담당자는 개인별 답변을 조회할 수
        없지만 완전한 익명성을 보장하는 방식은 아닙니다. 점수는 마감 후 승인된
        최소 응답수를 충족할 때만 공개됩니다.
      </p>
      {error ? (
        <Empty title="조사 목록을 불러오지 못했습니다" />
      ) : !rows.length ? (
        <Empty title="참여할 조사가 없습니다" />
      ) : (
        <div className="space-y-6">
          {rows.map((r) => (
            <article key={r.id} className="panel">
              <h2 className="text-xl font-bold">{r.name}</h2>
              <p className="mt-2 text-sm text-slate-500">
                마감 {dateTime(r.closes_at)} · 공개 최소 {r.min_responses}명
              </p>
              {r.submitted_at ? (
                <p className="notice mt-4">
                  {dateTime(r.submitted_at)} 참여 완료 · 감사합니다.
                </p>
              ) : r.closed ? (
                <p className="notice mt-4">응답기간이 끝났습니다.</p>
              ) : !r.policy_valid ? (
                <p className="notice mt-4">
                  조사 안내문 확인이 필요해 현재 응답할 수 없습니다.
                </p>
              ) : (
                <div className="mt-6">
                  <ActionForm action={answerSurvey} label="만족도 응답 제출">
                    <input type="hidden" name="r" value={r.id} />
                    <input type="hidden" name="policy" value={r.policy_id} />
                    <div className="rounded-xl bg-slate-50 p-4">
                      <h3 className="font-semibold">
                        {r.policy_title} · {r.policy_version}
                      </h3>
                      <p className="mt-3 whitespace-pre-wrap text-sm">
                        {r.policy_body}
                      </p>
                    </div>
                    {[
                      ["overall", "전반적인 교육 만족도"],
                      ["content", "교육내용의 적절성"],
                      ["usefulness", "현장 활용 가능성"],
                    ].map(([name, label]) => (
                      <fieldset key={name} className="rounded-xl border p-4">
                        <legend className="px-2 font-semibold">{label}</legend>
                        <div className="flex flex-wrap gap-x-6 gap-y-3">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <label key={n} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={name}
                                value={n}
                                required
                              />
                              {n}점
                            </label>
                          ))}
                        </div>
                        <p className="mt-3 text-xs text-slate-500">
                          1점 매우 낮음 · 3점 보통 · 5점 매우 높음
                        </p>
                      </fieldset>
                    ))}
                    <label className="flex items-start gap-3">
                      <input
                        className="mt-1"
                        type="checkbox"
                        name="confirmed"
                        required
                      />
                      <span>
                        조사 안내와 참여·답변 보관 방식을 확인하고 자발적으로
                        응답합니다.
                      </span>
                    </label>
                  </ActionForm>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
