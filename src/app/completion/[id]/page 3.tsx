import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOffering, dateTime } from "@/lib/portal/data";
import type {
  CompletionRule,
  CompletionRow,
  ClassSession,
} from "@/lib/portal/evaluation";
import { outcomeLabels } from "@/lib/portal/evaluation";
import { PageIntro, Empty } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import {
  proposeRules,
  approveRules,
  sealAcademics,
  calculateCompletion,
  confirmCompletion,
} from "@/app/evaluation-actions";
export default async function CompletionReview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireIdentity(`/completion/${id}`);
  const o = await getOffering(id);
  if (!o) notFound();
  const manager = me.roles.some(
    (r) => r.org_id === o.org_id && r.role === "COURSE_MANAGER",
  );
  const certifier = me.roles.some(
    (r) => r.org_id === o.org_id && r.role === "CERTIFIER",
  );
  if (!manager && !certifier) notFound();
  const db = await createServerSupabaseClient();
  const [policy, rules, board, sessions] = await Promise.all([
    db
      .from("life_policy_versions")
      .select("*")
      .eq(
        "id",
        o.completion_policy_id ?? "00000000-0000-0000-0000-000000000000",
      )
      .maybeSingle(),
    db
      .from("life_completion_rules")
      .select("*")
      .eq(
        "policy_id",
        o.completion_policy_id ?? "00000000-0000-0000-0000-000000000000",
      )
      .maybeSingle(),
    db.rpc("life_completion_board", { f: id }),
    db
      .from("life_class_sessions")
      .select("*")
      .eq("offering_id", id)
      .order("starts_at"),
  ]);
  if ([policy, rules, board, sessions].some((x) => x.error))
    return (
      <div className="page-shell">
        <Empty title="수료 검토 정보를 불러오지 못했습니다" />
      </div>
    );
  const rule = rules.data as CompletionRule | null;
  const rows = board.data as CompletionRow[];
  return (
    <div className="page-shell">
      <Link className="text-sm text-teal-800" href="/completion">
        ← 수료 검토 목록
      </Link>
      <PageIntro eyebrow="COMPLETION REVIEW" title={o.name}>
        과정 종료 후 승인된 기준으로 판정합니다. 수료 확정과 증명서·배지 발급은
        별도 단계입니다.
      </PageIntro>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="panel">
          <h2 className="section-title">수료 기준</h2>
          {!policy.data ? (
            <p className="notice">
              과정에 승인 수료 정책을 먼저 연결해 주세요.
            </p>
          ) : (
            <>
              <p className="font-semibold">
                {policy.data.title} · {policy.data.version}
              </p>
              <p className="my-4 whitespace-pre-wrap text-sm">
                {policy.data.body}
              </p>
              <dl className="grid grid-cols-2 gap-3 border-y py-4 text-sm">
                <dt>출석률</dt>
                <dd>
                  {rule?.attendance_percent == null
                    ? "미적용"
                    : `${rule.attendance_percent}% 이상`}
                </dd>
                <dt>각 과제 점수</dt>
                <dd>
                  {rule?.assignment_min == null
                    ? "미적용"
                    : `${rule.assignment_min}점 이상`}
                </dd>
                <dt>각 시험 점수</dt>
                <dd>
                  {rule?.quiz_min == null
                    ? "미적용"
                    : `${rule.quiz_min}점 이상`}
                </dd>
                <dt>계산 기준 승인</dt>
                <dd>
                  {rule?.approved_at
                    ? dateTime(rule.approved_at)
                    : rule
                      ? "승인 대기"
                      : "미등록"}
                </dd>
              </dl>
              {manager && !rule?.approved_at && (
                <details className="mt-5">
                  <summary className="cursor-pointer font-semibold text-teal-800">
                    계산 기준 작성
                  </summary>
                  <div className="mt-4">
                    <ActionForm action={proposeRules} label="기준안 저장">
                      <input
                        type="hidden"
                        name="policy"
                        value={policy.data.id}
                      />
                      <p className="notice">
                        정책 문안과 일치하는 값만 입력하세요. 빈칸은 미적용이며
                        최소 한 가지 기준이 필요합니다. 승인 전에는 수료에
                        적용되지 않습니다.
                      </p>
                      <label className="field">
                        최소 출석률 (%)
                        <input
                          type="number"
                          name="attendance"
                          min={0}
                          max={100}
                          step="0.01"
                          defaultValue={rule?.attendance_percent ?? ""}
                        />
                      </label>
                      <label className="field">
                        모든 공개 과제의 개별 최소점
                        <input
                          type="number"
                          name="assignment_score"
                          min={0}
                          max={100}
                          step="0.01"
                          defaultValue={rule?.assignment_min ?? ""}
                        />
                      </label>
                      <label className="field">
                        모든 시험의 개별 최소점
                        <input
                          type="number"
                          name="quiz_score"
                          min={0}
                          max={100}
                          step="0.01"
                          defaultValue={rule?.quiz_min ?? ""}
                        />
                      </label>
                    </ActionForm>
                  </div>
                </details>
              )}
              {certifier && rule && !rule.approved_at && (
                <div className="mt-5">
                  <ActionForm
                    action={approveRules}
                    label="계산 기준 승인"
                    disabled={rule.created_by === me.id}
                  >
                    <input type="hidden" name="policy" value={rule.policy_id} />
                    <input
                      type="hidden"
                      name="created_at"
                      value={rule.created_at}
                    />
                    <label className="flex gap-3 text-sm">
                      <input type="checkbox" name="reviewed" required />
                      기관이 승인한 정책 문안과 계산 기준의 일치를 검토했습니다.
                    </label>
                    {rule.created_by === me.id && (
                      <p>직접 작성한 기준은 다른 승인자가 검토해야 합니다.</p>
                    )}
                  </ActionForm>
                </div>
              )}
            </>
          )}
        </section>
        <section className="panel">
          <h2 className="section-title">운영자료 마감</h2>
          <p className="notice">
            {o.academic_sealed
              ? "운영자료 등록 완료 확인됨"
              : "전체 회차·과제·시험 등록 완료를 확인해 주세요."}{" "}
            새 평가 항목이나 휴강을 등록하면 다시 확인해야 합니다. 출결·성적이
            바뀌면 기존 판정은 재검토 대상이 됩니다.
          </p>
          <ul className="my-4 divide-y text-sm">
            {(sessions.data as ClassSession[]).map((s) => (
              <li key={s.id} className="py-2">
                {s.title} · {dateTime(s.starts_at)} ·{" "}
                {s.status === "CANCELLED" ? "휴강" : "정상 수업"}
              </li>
            ))}
          </ul>
          {manager && (
            <ActionForm
              action={sealAcademics}
              label="운영자료 마감 확인"
              disabled={o.academic_sealed}
            >
              <input type="hidden" name="offering" value={id} />
              <input
                type="hidden"
                name="revision"
                value={o.academic_revision}
              />
              <label className="flex gap-3 text-sm">
                <input type="checkbox" name="reviewed" required />
                모든 수업·보강·과제·시험이 빠짐없이 등록된 것을 확인했습니다.
              </label>
            </ActionForm>
          )}
        </section>
      </div>
      <section className="mt-10">
        <h2 className="section-title">수강생별 판정과 승인</h2>
        {!rows.length && <Empty title="수강등록된 학습자가 없습니다" />}
        <div className="space-y-5">
          {rows.map((row) => {
            const r = row.run;
            return (
              <article key={row.person_id} className="panel">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">{row.name}</h3>
                  <span className="badge">
                    {r
                      ? row.stale
                        ? "자료 변경 · 재산출 필요"
                        : row.approval
                          ? "수료 확정"
                          : outcomeLabels[r.outcome]
                      : "미산출"}
                  </span>
                </div>
                {r && (
                  <>
                    <p className="my-3 text-sm text-slate-500">
                      산출 {dateTime(r.calculated_at)} ·{" "}
                      {row.enrollment_status === "ACTIVE"
                        ? "수강 중"
                        : "수강 철회"}
                    </p>
                    {r.reasons.length > 0 && (
                      <ul className="notice list-inside list-disc">
                        {r.reasons.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    )}
                    <details className="my-4 rounded-xl border p-4">
                      <summary className="cursor-pointer font-semibold">
                        판정 근거 확인
                      </summary>
                      <div className="mt-4 space-y-4 text-sm">
                        <p>
                          산출 출석률:{" "}
                          {r.evidence.attendance_percent == null
                            ? "미적용 또는 판정 불가"
                            : `${r.evidence.attendance_percent}%`}
                        </p>
                        <div>
                          <strong>전체 유효 수업</strong>
                          {r.evidence.sessions.map((s) => (
                            <p key={s.session_id} className="py-1">
                              {s.title} · {s.credited_minutes ?? "미기록"} /{" "}
                              {s.minutes}분
                            </p>
                          ))}
                        </div>
                        <div>
                          <strong>과제</strong>
                          {r.evidence.assignments.map((a) => (
                            <p key={a.assignment_id} className="py-1">
                              {a.title} · 제출 {a.revision ?? "없음"} ·{" "}
                              {a.score ?? "미채점"}
                              {a.score !== null && "점"}
                            </p>
                          ))}
                        </div>
                        <div>
                          <strong>시험</strong>
                          {r.evidence.quizzes.map((q) => (
                            <p key={q.quiz_id} className="py-1">
                              {q.title} · {q.score ?? "미완료"}
                              {q.score !== null && "점"}
                            </p>
                          ))}
                        </div>
                      </div>
                    </details>
                  </>
                )}
                <div className="grid items-start gap-5 md:grid-cols-2">
                  <ActionForm
                    action={calculateCompletion}
                    label={r ? "최신 자료로 재산출" : "수료 후보 산출"}
                  >
                    <input type="hidden" name="offering" value={id} />
                    <input type="hidden" name="person" value={row.person_id} />
                  </ActionForm>
                  {certifier &&
                    r &&
                    r.outcome === "READY" &&
                    !row.stale &&
                    !row.approval && (
                      <ActionForm
                        action={confirmCompletion}
                        label="수료 확정"
                        disabled={
                          r.calculated_by === me.id || row.person_id === me.id
                        }
                      >
                        <input type="hidden" name="run" value={r.id} />
                        <label className="flex gap-3 text-sm">
                          <input type="checkbox" name="reviewed" required />
                          수료 기준과 판정 근거를 검토했습니다.
                        </label>
                        {r.calculated_by === me.id && (
                          <p className="text-sm">
                            직접 산출한 결과는 다른 승인자가 확정해야 합니다.
                          </p>
                        )}
                      </ActionForm>
                    )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
