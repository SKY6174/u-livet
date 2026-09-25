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
import { createCompletionReviewPreview } from "@/lib/completion/review-preview";
import {
  proposeRules,
  approveRules,
  sealAcademics,
  calculateCompletion,
  confirmCompletion,
} from "@/app/evaluation-actions";
export default async function CompletionReview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sample?: string }>;
}) {
  const { id } = await params;
  const { sample } = await searchParams;
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
  const liveRows = board.data as CompletionRow[];
  const isSample = sample === "1" && liveRows.length === 0;
  const rows = isSample ? createCompletionReviewPreview() : liveRows;
  const threshold =
    rows[0]?.attendance_threshold ?? Math.max(80, rule?.attendance_percent ?? 0);
  const eligibleCount = rows.filter((row) => row.attendance_eligible).length;
  const confirmedCount = rows.filter(
    (row) => row.approval && !row.stale && row.enrollment_status === "ACTIVE",
  ).length;
  const refundCount = rows.filter(
    (row) => row.refund || row.refund_document,
  ).length;
  const attendanceCompleteCount = rows.filter(
    (row) => row.attendance_complete,
  ).length;
  const completionRate = (count: number) =>
    rows.length ? `${((count / rows.length) * 100).toFixed(1)}%` : "—";
  return (
    <div className="page-shell">
      {manager && (
        <div className="my-4 flex flex-wrap gap-4 text-sm font-semibold text-teal-800">
          <Link href={`/admin/offerings/${id}/reports`}>
            결과보고서에 반영된 내용 확인 →
          </Link>
        </div>
      )}
      <PageIntro eyebrow="COMPLETION REVIEW" title={o.name}>
        과정 종료 후 승인된 기준으로 판정합니다. 수료 확정과 증명서·배지 발급은
        별도 단계입니다.
      </PageIntro>
      {isSample && (
        <div role="status" className="notice mb-6 border border-amber-300 bg-amber-50 text-amber-950">
          <strong>검토용 예시 데이터</strong>입니다. 실제 수강생·출석·환불·수료 기록에
          저장되지 않으며 아래 처리 버튼은 사용할 수 없습니다.{" "}
          <Link className="font-semibold underline" href={`/completion/${id}`}>
            실제 화면으로 돌아가기
          </Link>
        </div>
      )}
      <section className="mb-6 grid gap-3 sm:grid-cols-3" aria-label="수료율 자동 산정">
        <div className="panel">
          <h2 className="text-sm font-semibold text-slate-600">출석기준 충족 수료율</h2>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {completionRate(eligibleCount)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {eligibleCount} / {rows.length}명 · 최소 출석률 {threshold}%
          </p>
        </div>
        <div className="panel">
          <h2 className="text-sm font-semibold text-slate-600">확정 수료율</h2>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {completionRate(confirmedCount)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            수료 승인 {confirmedCount} / 등록 {rows.length}명
          </p>
        </div>
        <div className="panel">
          <h2 className="text-sm font-semibold text-slate-600">중도 환불 표시</h2>
          <p className="mt-2 text-2xl font-bold tabular-nums">{refundCount}명</p>
          <p className="mt-1 text-sm text-slate-500">신청·진행·지급 상태를 학습자별로 구분</p>
        </div>
      </section>
      {attendanceCompleteCount < rows.length && (
        <p className="mb-6 text-sm text-slate-600">
          출석기준 충족 수료율은 모든 회차 종료와 출석 기록 완료 전에는 잠정치입니다. 승인된 과제·시험 기준과 운영자료 마감 여부는 별도 판정에 반영됩니다.
        </p>
      )}
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
                  {threshold}% 이상 (운영계획서·승인 정책 중 높은 기준)
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
                    <ActionForm action={proposeRules} label="기준안 저장" disabled={isSample}>
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
                    disabled={isSample || rule.created_by === me.id}
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
              disabled={isSample || o.academic_sealed}
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
        {!rows.length && (
          <>
            <Empty title="수강등록된 학습자가 없습니다" />
            <Link
              className="btn-secondary mt-4 inline-flex"
              href={`/completion/${id}?sample=1`}
            >
              예시 데이터로 화면 보기
            </Link>
          </>
        )}
        {rows.length > 0 && (
          <>
            <p id="completion-list-help" className="mb-3 text-sm text-slate-600">
              판정 근거는 해당 행에서 펼쳐 확인할 수 있습니다. 좁은 화면에서는 목록을 좌우로 스크롤해 주세요.
            </p>
            <div
              role="region"
              aria-label="수강생별 수료 판정 목록"
              aria-describedby="completion-list-help"
              tabIndex={0}
              className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"
            >
              <table className="w-full min-w-[1500px] table-fixed text-left text-sm">
                <caption className="sr-only">수강생별 출석률, 수강·환불 상태, 판정 결과와 처리 목록</caption>
                <colgroup>
                  {[4, 10, 12, 14, 12, 12, 16, 20].map((width, index) => (
                    <col key={index} style={{ width: `${width}%` }} />
                  ))}
                </colgroup>
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
                  <tr>
                    {[
                      "순번", "수강생", "출석률", "수강·환불 상태", "판정 결과",
                      "산출 시각", "판정 근거", "처리",
                    ].map((label) => (
                      <th key={label} scope="col" className="px-3 py-3 font-semibold">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rows.map((row, index) => {
                    const r = row.run;
                    return (
                      <tr key={row.person_id} className="align-top hover:bg-teal-50/30">
                        <td className="px-3 py-4 tabular-nums text-slate-500">{index + 1}</td>
                        <th scope="row" className="px-3 py-4 font-semibold text-slate-900">{row.name}</th>
                        <td className="px-3 py-4">
                          <strong className="tabular-nums">
                            {row.attendance_percent == null ? "산정 전" : `${row.attendance_percent}%`}
                          </strong>
                          <span className="mt-1 block text-xs text-slate-600">
                            {row.attendance_complete
                              ? row.attendance_eligible ? "기준 충족" : "기준 미달"
                              : "출결 진행 중"}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-slate-700">
                          <span>{row.enrollment_status === "ACTIVE" ? "수강 중" : "수강 철회"}</span>
                          {row.refund_document && (
                            <span className="mt-1 block text-xs text-amber-900">
                              중도 환불 신청서 {refundDocumentStatus(row.refund_document.status)}
                            </span>
                          )}
                          {row.refund && (
                            <span className="mt-1 block text-xs text-rose-900">
                              중도 환불 {refundStatus(row.refund.status)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-4">
                          <span className="badge">
                            {r
                              ? row.stale
                                ? "자료 변경 · 재산출 필요"
                                : row.approval ? "수료 확정" : outcomeLabels[r.outcome]
                              : "미산출"}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-slate-600">
                          {r ? <time dateTime={r.calculated_at}>{dateTime(r.calculated_at)}</time> : "—"}
                        </td>
                        <td className="px-3 py-4">
                          {r ? (
                            <details>
                              <summary className="cursor-pointer font-semibold text-teal-800">
                                판정 근거 확인<span className="sr-only"> · {row.name}</span>
                              </summary>
                              <div className="mt-3 space-y-3 break-words text-xs leading-5 text-slate-700">
                                {r.reasons.length > 0 && (
                                  <div>
                                    <strong>판정 사유</strong>
                                    <ul className="list-inside list-disc">
                                      {r.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                                    </ul>
                                  </div>
                                )}
                                <p>산출 출석률: {r.evidence.attendance_percent == null
                                  ? "미적용 또는 판정 불가" : `${r.evidence.attendance_percent}%`}</p>
                                <div>
                                  <strong>전체 유효 수업</strong>
                                  {r.evidence.sessions.map((session) => (
                                    <p key={session.session_id}>
                                      {session.title} · {session.credited_minutes ?? "미기록"} / {session.minutes}분
                                    </p>
                                  ))}
                                </div>
                                <div>
                                  <strong>과제</strong>
                                  {r.evidence.assignments.map((assignment) => (
                                    <p key={assignment.assignment_id}>
                                      {assignment.title} · 제출 {assignment.revision ?? "없음"} · {assignment.score ?? "미채점"}
                                      {assignment.score !== null && "점"}
                                    </p>
                                  ))}
                                </div>
                                <div>
                                  <strong>시험</strong>
                                  {r.evidence.quizzes.map((quiz) => (
                                    <p key={quiz.quiz_id}>
                                      {quiz.title} · {quiz.score ?? "미완료"}{quiz.score !== null && "점"}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            </details>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-3 py-4">
                          <div className="space-y-2 [&_button]:min-h-9 [&_button]:whitespace-nowrap [&_button]:px-3 [&_button]:py-2 [&_button]:text-xs">
                            <ActionForm
                              action={calculateCompletion}
                              label={r ? "최신 자료로 재산출" : "수료 후보 산출"}
                              disabled={isSample}
                              className="space-y-2"
                            >
                              <input type="hidden" name="offering" value={id} />
                              <input type="hidden" name="person" value={row.person_id} />
                            </ActionForm>
                            {(certifier || isSample) && r && r.outcome === "READY" &&
                              !row.stale && !row.approval && (
                                <details>
                                  <summary className="cursor-pointer font-semibold text-teal-800">
                                    수료 확정<span className="sr-only"> · {row.name}</span>
                                  </summary>
                                  <div className="mt-2">
                                    <ActionForm
                                      action={confirmCompletion}
                                      label="수료 확정"
                                      disabled={isSample || r.calculated_by === me.id || row.person_id === me.id}
                                      className="space-y-2"
                                    >
                                      <input type="hidden" name="run" value={r.id} />
                                      <label className="flex items-start gap-2 text-xs leading-5">
                                        <input type="checkbox" name="reviewed" required />
                                        수료 기준과 판정 근거를 검토했습니다.
                                      </label>
                                      {r.calculated_by === me.id && (
                                        <p className="text-xs">직접 산출한 결과는 다른 승인자가 확정해야 합니다.</p>
                                      )}
                                    </ActionForm>
                                  </div>
                                </details>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function refundStatus(status: string) {
  const labels: Record<string, string> = {
    REQUESTED: "요청",
    REVIEWED: "검토",
    APPROVED: "승인",
    PROCESSING: "지급 처리 중",
    RECONCILING: "지급 확인 중",
    PAID: "지급 완료",
  };
  return labels[status] ?? status;
}

function refundDocumentStatus(status: string) {
  const labels: Record<string, string> = {
    RECEIVED: "접수",
    REVIEWING: "검토",
    APPROVED: "승인",
    COMPLETED: "처리 완료",
  };
  return labels[status] ?? status;
}
