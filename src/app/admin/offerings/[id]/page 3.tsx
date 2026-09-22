import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import {
  getOffering,
  getPolicies,
  statusLabel,
  dateTime,
} from "@/lib/portal/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageIntro, Empty } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import {
  decideApplication,
  publishOffering,
  assignInstructor,
} from "@/app/actions";
import { configureFinance } from "@/app/finance-actions";
import type { FinanceConfig } from "@/lib/finance/types";
import type { RosterRow } from "@/lib/portal/types";
export default async function ManageOffering(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const me = await requireIdentity("/admin");
  const o = await getOffering(params.id);
  if (
    !o ||
    !me.roles.some((r) => r.org_id === o.org_id && r.role === "COURSE_MANAGER")
  )
    notFound();
  const [{ data, error }, policies, instructors, financeResult] =
    await Promise.all([
      (await createServerSupabaseClient()).rpc("life_roster", { f: o.id }),
      getPolicies(),
      (await createServerSupabaseClient()).rpc("life_instructors", { f: o.id }),
      (await createServerSupabaseClient()).rpc("life_offering_finance", {
        f: o.id,
      }),
    ]);
  const finance = financeResult.data as FinanceConfig | null;
  return (
    <div className="page-shell">
      <PageIntro eyebrow="OFFERING MANAGEMENT" title={o.name}>
        {statusLabel[o.status]} · 정원 {o.capacity}명
      </PageIntro>
      <section className="panel mb-8">
        <h2 className="section-title">수강료·환불 규정</h2>
        <p className="mb-4">
          현재 수강료 {o.tuition.toLocaleString("ko-KR")}원
          {finance ? ` · ${finance.title} ${finance.version}` : ""}
        </p>
        {o.status === "DRAFT" ? (
          <details>
            <summary className="cursor-pointer font-semibold">
              유료 과정 설정
            </summary>
            <div className="mt-4">
              <ActionForm
                action={configureFinance}
                label="수강료·납부 안내 저장"
              >
                <input type="hidden" name="f" value={o.id} />
                <label className="field">
                  수강료 (원)
                  <input
                    type="number"
                    name="tuition"
                    min={1}
                    max={100000000}
                    defaultValue={o.tuition || undefined}
                    required
                  />
                </label>
                <label className="field">
                  환불 규정
                  <select
                    name="policy"
                    required
                    defaultValue={finance?.policy_id ?? ""}
                  >
                    <option value="" disabled>
                      승인 규정 선택
                    </option>
                    {policies
                      .filter(
                        (p) => p.org_id === o.org_id && p.kind === "REFUND",
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} · {p.version}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field">
                  선발 후 납부기한 (시간)
                  <input
                    type="number"
                    name="hours"
                    min={1}
                    max={720}
                    defaultValue={finance?.reservation_hours}
                    required
                  />
                </label>
                <p className="text-sm text-slate-600">
                  실제 납부기한은 교육 시작 자정을 넘지 않습니다. 기한까지
                  좌석을 예약합니다.
                </p>
                <label className="field">
                  기관이 승인한 납부 안내
                  <textarea
                    name="instructions"
                    maxLength={3000}
                    defaultValue={finance?.instructions}
                    required
                    rows={3}
                  />
                </label>
                <p className="notice">
                  환불 규정과 조항별 계산 기준이 등록되어 있어야 저장할 수
                  있습니다. 공개 후에는 수강료·규정을 변경할 수 없습니다.
                </p>
              </ActionForm>
            </div>
          </details>
        ) : (
          <p className="whitespace-pre-wrap text-sm">
            {finance?.instructions ?? "무료 과정입니다."}
          </p>
        )}
      </section>
      <section className="panel mb-8">
        <h2 className="section-title">담당 강사 배정</h2>
        <p className="mb-4 text-sm text-slate-600">
          기관에서 승인한 강사에게 이 기수의 자료·과제·평가 권한을 부여합니다.
        </p>
        {instructors.error ? (
          <p role="alert">강사 목록을 불러오지 못했습니다.</p>
        ) : !(instructors.data ?? []).length ? (
          <p className="notice">기관에서 승인한 활성 강사가 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {(
              instructors.data as {
                person_id: string;
                name: string;
                assigned: boolean;
              }[]
            ).map((i) => (
              <div
                key={i.person_id}
                className="flex flex-wrap items-center justify-between gap-4 border-t pt-4"
              >
                <p>
                  {i.name} · {i.assigned ? "배정됨" : "미배정"}
                </p>
                <ActionForm
                  action={assignInstructor}
                  label={i.assigned ? "기수 배정 해제" : "기수에 배정"}
                >
                  <input type="hidden" name="offering" value={o.id} />
                  <input type="hidden" name="person" value={i.person_id} />
                  <input
                    type="hidden"
                    name="enabled"
                    value={String(!i.assigned)}
                  />
                </ActionForm>
              </div>
            ))}
          </div>
        )}
      </section>
      {o.status === "DRAFT" && (
        <section className="panel mb-8">
          <h2 className="section-title">모집 공개</h2>
          <p className="mb-4 text-sm text-slate-600">
            과정 내용과 아래 승인 정책을 확인한 뒤 공개하세요. 정책 원문은
            승인된 버전으로 보존됩니다.
          </p>
          <p className="mb-4 whitespace-pre-wrap">{o.curriculum}</p>
          <ActionForm action={publishOffering} label="과정 승인·모집 공개">
            <input type="hidden" name="offering" value={o.id} />
            {[
              ["enrollment_policy", "ENROLLMENT", "모집·수집이용 정책"],
              ["completion_policy", "COMPLETION", "수료기준"],
            ].map(([name, kind, label]) => (
              <label key={name} className="field">
                {label}
                <select name={name} required defaultValue="">
                  <option value="" disabled>
                    승인 정책 선택
                  </option>
                  {policies
                    .filter((p) => p.org_id === o.org_id && p.kind === kind)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} · {p.version}
                      </option>
                    ))}
                </select>
              </label>
            ))}
          </ActionForm>
        </section>
      )}
      <h2 className="section-title">신청 심사</h2>
      {error ? (
        <Empty title="신청 내역을 불러오지 못했습니다" />
      ) : !data?.length ? (
        <Empty title="접수된 신청이 없습니다" />
      ) : (
        <div className="space-y-4">
          {(data as RosterRow[]).map((r) => (
            <article
              key={r.application_id}
              className="panel flex flex-wrap justify-between gap-5"
            >
              <div>
                <h3 className="font-bold">{r.name}</h3>
                <p className="mt-2 text-sm">
                  {statusLabel[r.status]} · {dateTime(r.submitted_at)}
                </p>
              </div>
              {["SUBMITTED", "WAITLISTED"].includes(r.status) && (
                <ActionForm action={decideApplication} label="심사 결과 저장">
                  <input
                    type="hidden"
                    name="application"
                    value={r.application_id}
                  />
                  <label className="field">
                    결정
                    <select name="decision" required>
                      <option value="ACCEPTED">
                        {o.tuition > 0 ? "선발 · 납부 대기" : "수강 확정"}
                      </option>
                      <option value="REJECTED">미선정</option>
                    </select>
                  </label>
                </ActionForm>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
