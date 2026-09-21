import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID, dateTime } from "@/lib/portal/data";
import { PageIntro } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import {
  openSurvey,
  finalizeSurvey,
  qualityFeedback,
  reviewCourse,
  addImprovement,
  reportImprovement,
  verifyImprovement,
} from "@/app/performance-actions";
import { qualityLabel, type QualityBoard } from "@/lib/performance/types";
export default async function Quality({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireIdentity("/quality/" + id);
  if (!UUID.test(id)) notFound();
  const { data, error } = await (
    await createServerSupabaseClient()
  ).rpc("life_quality_board", { f: id });
  if (error || !data) notFound();
  const b = data as QualityBoard;
  const feedback = b.feedback.find((f) => f.person_id === me.id),
    latest = b.reviews[0];
  return (
    <div className="page-shell">
      <Link
        className="text-sm text-teal-800 underline"
        href={
          b.manager || me.roles.some((r) => r.role === "PERFORMANCE")
            ? "/performance/" + b.offering.year_id
            : "/instructor"
        }
      >
        ← {b.manager ? "사업연도 성과 관리" : "My Room"}
      </Link>
      <PageIntro eyebrow="COURSE QUALITY" title={b.offering.name}>
        종강 {b.offering.ends_on} · 만족도와 강사 의견을 검토하고 다음 기수의
        개선을 확인합니다.
      </PageIntro>
      {!b.manager && <div className="notice mb-6">매 강좌 종료 후 개설된 만족도 조사를 수강생에게 안내해 주세요. 수강생은 ‘나의 학습 → 만족도 조사’에서 본인의 설문에 참여합니다. 조사가 없다면 사업단에 개설을 요청해 주세요.</div>}
      <section className="panel mb-6">
        <h2 className="section-title">만족도 조사</h2>
        {b.survey ? (
          <>
            <p>
              대상 {b.survey.invited}명 · 응답 {b.survey.responses}명 · 공개
              최소 {b.survey.min_responses}명
            </p>
            <p className="mt-2 text-sm text-slate-500">
              마감 {dateTime(b.survey.closes_at)} ·{" "}
              {b.survey.closed ? "마감됨" : "응답 중"}
            </p>
            {b.manager && b.survey.closed && !b.survey.finalized && (
              <div className="mt-5">
                <ActionForm action={finalizeSurvey} label="마감 결과 확정">
                  <input type="hidden" name="r" value={b.survey.id} />
                  <p className="text-sm text-slate-600">
                    진행 중인 제출 처리가 끝난 후 결과를 한 번 확정합니다. 최소
                    응답수 미달이면 점수는 계속 비공개입니다.
                  </p>
                </ActionForm>
              </div>
            )}
            {b.survey.released ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {[
                  ["전반적 만족", b.survey.overall],
                  ["교육내용", b.survey.content],
                  ["현장 활용", b.survey.usefulness],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl bg-teal-50 p-4"
                  >
                    <p className="text-sm">{label}</p>
                    <strong className="mt-2 block text-2xl text-teal-800">
                      {value}{" "}
                      <small className="text-sm font-normal">/ 5점</small>
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="notice mt-4">
                마감·결과 확정 전이거나 최소 응답수에 미달하여 점수를 공개하지
                않습니다.
              </p>
            )}
          </>
        ) : b.manager && b.survey_policies.length ? (
          <ActionForm action={openSurvey} label="만족도 조사 개설">
            <input type="hidden" name="f" value={id} />
            <label className="field">
              승인된 조사 기준
              <select name="policy" required>
                {b.survey_policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} · {p.version} · 최소 {p.min_responses}명
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              마감시각 (한국시간, 현재 이후 90일 이내)
              <input type="datetime-local" name="closes" required />
            </label>
            <p className="text-sm text-slate-600">
              종강 다음 날부터 개설할 수 있습니다. 현재 등록자를 대상으로
              고정하며 개설 후 마감시각·공개 기준을 변경할 수 없습니다.
            </p>
            <details>
              <summary className="cursor-pointer">조사 안내문 확인</summary>
              {b.survey_policies.map((p) => (
                <p key={p.id} className="mt-3 whitespace-pre-wrap text-sm">
                  {p.title}: {p.body}
                </p>
              ))}
            </details>
          </ActionForm>
        ) : (
          <p className="notice">
            개설된 조사가 없습니다. 승인된 조사 안내문과 공개 기준을 등록한 후
            사업단이 개설합니다.
          </p>
        )}
        <p className="mt-4 text-sm text-slate-500">
          설문 참여는 수료·증명 조건이 아닙니다. 개별 응답이나 참여자 명단을
          제공하지 않습니다.
        </p>
      </section>
      <section className="panel mb-6">
        <h2 className="section-title">강사 개선 의견</h2>
        {b.feedback.map((f) => (
          <div key={f.person_id} className="mb-4 border-b pb-4">
            <p className="text-sm font-semibold">
              {f.name} · v{f.revision} · {dateTime(f.updated_at)}
            </p>
            <p className="mt-2 whitespace-pre-wrap">{f.note}</p>
          </div>
        ))}
        {!b.feedback.length && (
          <p className="mb-4 text-sm text-slate-500">등록된 의견이 없습니다.</p>
        )}
        {b.teacher && (
          <ActionForm action={qualityFeedback} label="내 개선 의견 저장">
            <input type="hidden" name="f" value={id} />
            <input
              type="hidden"
              name="revision"
              value={feedback?.revision ?? 0}
            />
            <label className="field">
              교육 운영 결과와 개선 제안
              <textarea
                name="note"
                defaultValue={feedback?.note ?? ""}
                required
                rows={4}
                maxLength={3000}
              />
            </label>
          </ActionForm>
        )}
      </section>
      <section className="panel mb-6">
        <h2 className="section-title">사업단 과정 검토</h2>
        {b.manager && (
          <ActionForm action={reviewCourse} label="새 검토 이력 저장">
            <input type="hidden" name="f" value={id} />
            <input
              type="hidden"
              name="revision"
              value={latest?.revision ?? 0}
            />
            <label className="field">
              검토 결정
              <select name="decision">
                {["KEEP", "REVISE", "MERGE", "RETIRE"].map((v) => (
                  <option key={v} value={v}>
                    {qualityLabel(v)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              검토 근거·개선 방향
              <textarea name="summary" required rows={3} maxLength={3000} />
            </label>
            <p className="text-sm text-slate-500">
              당시 만족도·강사 의견과 함께 보존합니다. 통합·폐지 검토가 기존
              수강이력이나 증명을 삭제하지 않습니다.
            </p>
          </ActionForm>
        )}
        <ol className="mt-6 space-y-4">
          {b.reviews.map((r) => (
            <li key={r.id} className="rounded-lg bg-slate-50 p-4">
              <strong>
                v{r.revision} · {qualityLabel(r.decision)}
              </strong>
              <span className="ml-3 text-sm text-slate-500">
                {dateTime(r.created_at)}
              </span>
              <p className="mt-2 whitespace-pre-wrap">{r.summary}</p>
              <p className="mt-2 text-sm">
                검토 당시 만족도:{" "}
                {r.survey_snapshot?.released
                  ? `${r.survey_snapshot.overall} / 5점`
                  : "점수 비공개 또는 미조사"}
              </p>
            </li>
          ))}
        </ol>
      </section>
      <section className="space-y-5">
        <h2 className="section-title">다음 기수 개선 과제</h2>
        {b.improvements.map((i) => (
          <article key={i.id} className="panel">
            <span className="badge">
              {qualityLabel(i.status)} · v{i.revision}
            </span>
            <p className="mt-3 whitespace-pre-wrap font-semibold">{i.plan}</p>
            <p className="mt-2 text-sm text-slate-600">
              담당 {i.owner_name} · 기한 {i.due_on}
            </p>
            {i.target_name && (
              <p className="mt-3">반영 기수: {i.target_name}</p>
            )}
            {i.evidence_reference && (
              <p className="mt-2 break-words text-sm">
                반영 근거: {i.evidence_reference}
              </p>
            )}
            {i.verification_note && (
              <p className="mt-2 break-words text-sm">
                확인 의견: {i.verification_note}
              </p>
            )}
            {i.status === "OPEN" && i.owner_id === me.id && (
              <div className="mt-5">
                <ActionForm
                  action={reportImprovement}
                  label="다음 기수 반영 보고"
                  disabled={!b.targets.length}
                >
                  <input type="hidden" name="i" value={i.id} />
                  <input type="hidden" name="revision" value={i.revision} />
                  <label className="field">
                    반영한 다음 기수
                    <select name="target" required>
                      {b.targets.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    반영 증빙 문서 참조
                    <input name="evidence" required maxLength={2000} />
                  </label>
                  {!b.targets.length && (
                    <p className="notice">
                      원기수 종료 후 시작하는 공개 기수가 필요합니다.
                    </p>
                  )}
                </ActionForm>
              </div>
            )}
            {i.status === "REPORTED" &&
              b.manager &&
              i.owner_id !== me.id &&
              i.reported_by !== me.id && (
                <div className="mt-5">
                  <ActionForm action={verifyImprovement} label="반영 결과 확인">
                    <input type="hidden" name="i" value={i.id} />
                    <input type="hidden" name="revision" value={i.revision} />
                    <label className="field">
                      확인 근거·의견
                      <textarea name="note" required maxLength={2000} />
                    </label>
                  </ActionForm>
                </div>
              )}
          </article>
        ))}
        {b.manager && latest && (
          <details className="panel">
            <summary className="cursor-pointer font-bold">
              최신 검토에 개선 과제 추가
            </summary>
            <div className="mt-5">
              <ActionForm action={addImprovement} label="개선 과제 등록">
                <input type="hidden" name="r" value={latest.id} />
                <label className="field">
                  담당자
                  <select name="owner" required>
                    {b.owners.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  개선 계획
                  <textarea name="plan" required maxLength={2000} />
                </label>
                <label className="field">
                  반영 기한
                  <input type="date" name="due" required />
                </label>
              </ActionForm>
            </div>
          </details>
        )}
      </section>
    </div>
  );
}
