import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID, dateTime } from "@/lib/portal/data";
import { PageIntro } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import { PerformanceMetrics } from "@/components/portal/performance-metrics";
import { approvePerformanceReport } from "@/app/performance-actions";
import { qualityLabel, type PerformanceReport } from "@/lib/performance/types";
export default async function Report({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireIdentity("/performance/reports/" + id);
  if (!UUID.test(id)) notFound();
  const { data, error } = await (
    await createServerSupabaseClient()
  ).rpc("life_performance_report", { r: id });
  if (error || !data) notFound();
  const r = data as PerformanceReport;
  const blocked = r.snapshot.metrics.some((m) => m.blocker);
  const ownData =
    r.created_by === me.id ||
    r.snapshot.metrics.some((m) => m.observation?.recorded_by === me.id);
  return (
    <div className="page-shell">
      <Link
        className="text-sm text-teal-800 underline"
        href={"/performance/" + r.year_id}
      >
        ← 사업연도 성과 관리
      </Link>
      <PageIntro
        eyebrow="PERFORMANCE RECORD"
        title={`${r.snapshot.year.label} · 보고 v${r.version}`}
      >
        등록 지표 내부 확정본입니다. RISE 전체 지표의 충족이나 대외 제출 완료를
        뜻하지 않습니다.
      </PageIntro>
      <section className="panel mb-6">
        <span className="badge">{qualityLabel(r.status)}</span>
        <p className="mt-4 whitespace-pre-wrap">작성·정정 사유: {r.reason}</p>
        <p className="mt-2 text-sm text-slate-600">
          작성 {dateTime(r.created_at)}
          {r.approved_at && <> · 확정 {dateTime(r.approved_at)}</>}
        </p>
        {r.approval_reference && (
          <p className="mt-2 break-words text-sm">
            승인 근거: {r.approval_reference}
          </p>
        )}
        {r.supersedes_id && (
          <Link
            className="mt-3 block text-teal-800 underline"
            href={"/performance/reports/" + r.supersedes_id}
          >
            이전 확정본 보기
          </Link>
        )}
        {r.stale && (
          <p className="notice mt-4">
            현재 원자료 또는 지표 정의가 변경되었습니다. 이 기록은 작성 당시
            값으로 보존됩니다. 확정·정정이 필요하면 새 초안을 생성하세요.
          </p>
        )}
        {r.status === "APPROVED" && (
          <a
            className="btn-secondary mt-4"
            href={"/api/performance/reports/" + r.id}
          >
            확정본 JSON 내려받기
          </a>
        )}
      </section>
      <h2 className="section-title">작성 당시 지표와 산정 근거</h2>
      <PerformanceMetrics rows={r.snapshot.metrics} />
      <section className="panel mt-6">
        <h2 className="section-title">작성 당시 운영 집계</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["등록 실인원", "enrolled_people"],
            ["수강건수", "enrollments"],
            ["확정 수료 실인원", "completed_people"],
            ["확정 수료건수", "completions"],
          ].map(([label, key]) => (
            <p key={key}>
              {label} <strong>{r.snapshot.facts.totals[key] ?? 0}</strong>
            </p>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-500">
          현재 원장을 저장한 기록이며 과거 특정일의 원장을 복원한 자료가
          아닙니다. 집계 버전 {r.snapshot.query_version}
        </p>
      </section>
      {r.status === "DRAFT" && (
        <section className="panel mt-6">
          <h2 className="section-title">검토 후 확정</h2>
          {r.can_approve && !ownData && !r.stale && !blocked ? (
            <ActionForm
              action={approvePerformanceReport}
              label="등록 지표 보고 확정"
            >
              <input type="hidden" name="r" value={r.id} />
              <label className="field">
                승인 문서·검토 근거
                <input name="reference" required maxLength={2000} />
              </label>
              <label className="flex items-start gap-3">
                <input
                  className="mt-1"
                  type="checkbox"
                  name="confirmed"
                  required
                />
                <span>
                  등록된 지표의 범위, 산정 근거와 증빙을 확인했습니다. 미등록
                  지표까지 확인한 것으로 처리하지 않습니다.
                </span>
              </label>
            </ActionForm>
          ) : (
            <p className="notice">
              별도 승인 권한, 작성·입력자와 다른 승인자, 유효한 최신 원자료와
              지표가 모두 필요합니다.
            </p>
          )}
        </section>
      )}
      <section className="panel mt-6">
        <h2 className="section-title">처리 이력</h2>
        <ol className="space-y-3">
          {r.events.map((e, i) => (
            <li key={i} className="text-sm">
              {dateTime(e.at)} · {qualityLabel(e.action)}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
