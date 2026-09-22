import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID, dateTime } from "@/lib/portal/data";
import { PageIntro, Empty } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import { PerformanceMetrics } from "@/components/portal/performance-metrics";
import {
  createMetric,
  createPerformanceReport,
} from "@/app/performance-actions";
import {
  qualityLabel,
  sourceLabels,
  type PerformanceBoard,
} from "@/lib/performance/types";
import { planTargets } from "@/lib/performance/plan-targets";
export default async function Annual({
  params,
  searchParams,
}: {
  params: Promise<{ year: string }>;
  searchParams: Promise<{ academy?: string }>;
}) {
  const { year } = await params;
  if (!UUID.test(year)) notFound();
  const me = await requireIdentity("/performance/" + year);
  const { academy } = await searchParams;
  const { data, error } = await (
    await createServerSupabaseClient()
  ).rpc("life_performance_board", {
    y: year,
    a: typeof academy === "string" && academy ? academy : null,
  });
  if (error || !data)
    return (
      <div className="page-shell">
        <Empty title="성과 자료를 조회할 수 없습니다" />
      </div>
    );
  const b = data as PerformanceBoard,
    t = b.facts.totals;
  return (
    <div className="page-shell">
      <PageIntro eyebrow="ANNUAL REVIEW" title={b.year.label}>
        {b.year.starts_on} ~ {b.year.ends_on} · 조회 {dateTime(b.generated_at)}
      </PageIntro>
      <p className="notice mb-6">
        기수에 지정된 사업연도 기준의 현재 원장입니다. 과거 기준일의 상태를
        복원한 통계가 아닙니다. 등록 실인원과 수강건수는 취소 이력을 포함합니다.
      </p>
      <form className="panel mb-6 flex flex-wrap items-end gap-4" method="get">
        <label className="field flex-1">
          운영 통계 분야
          <select name="academy" defaultValue={academy ?? ""}>
            <option value="">전체 아카데미</option>
            {b.academies.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <button className="btn-secondary">필터 적용</button>
      </form>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["등록 실인원", "enrolled_people", "명"],
          ["수강건수", "enrollments", "건"],
          ["확정 수료 실인원", "completed_people", "명"],
          ["확정 수료건수", "completions", "건"],
        ].map(([name, k, u]) => (
          <div className="panel" key={k}>
            <p className="text-sm text-slate-500">{name}</p>
            <p className="mt-3 text-3xl font-bold text-teal-800">
              {t[k] ?? "—"}
              <span className="ml-1 text-sm font-normal">{u}</span>
            </p>
          </div>
        ))}
      </div>
      <div className="panel mb-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["개설 기수", "offerings"],
          ["운영 과정 원본", "course_origins"],
          ["등록 유지", "active"],
          ["등록 취소", "withdrawn"],
          ["종강 후 판정 미확인", "unresolved"],
          ["수료 재검토", "stale_completions"],
          ["사업연도 경계 확인", "boundary_issues"],
          ["기한 경과 개선과제", "improvements_overdue"],
        ].map(([name, k]) => (
          <p key={k}>
            {name} <strong className="float-right">{t[k] ?? "—"}</strong>
          </p>
        ))}
      </div>
      <p className="mb-8 text-sm text-slate-600">
        운영 참고 수료율{" "}
        {t.completion_rate === null
          ? "산출 불가 (등록건수 0)"
          : `${t.completion_rate}%`}{" "}
        = 최신 확정 수료건수 ÷ 전체 등록건수(취소 포함). 과정 원본·개설 기수는
        개발·개편 실적과 다릅니다.
      </p>
      <h2 className="section-title">과정별 평가·개선</h2>
      {!b.facts.offerings.length ? (
        <Empty title="해당 범위에 기수가 없습니다" />
      ) : (
        <div className="mb-10 grid gap-4 md:grid-cols-2">
          {b.facts.offerings.map((o) => (
            <Link key={o.id} className="panel" href={"/quality/" + o.id}>
              <span className="badge">{o.academy}</span>
              <h3 className="mt-3 text-lg font-bold">{o.name}</h3>
              <p className="mt-2 text-sm">
                등록 {o.enrollments}건 · 확정 수료 {o.completions}건
              </p>
              <p className="mt-2 text-sm">
                만족도{" "}
                {o.survey?.released
                  ? `${o.survey.overall}/5 (${o.survey.responses}명 응답)`
                  : o.survey
                    ? "공개 전·소수응답 보호"
                    : "조사 미개설"}{" "}
                · 검토 {o.review ? qualityLabel(o.review.decision) : "미등록"}
              </p>
              <p className="mt-3 text-sm text-teal-800">
                미완료 개선 {o.improvements_open}건 · 과정 평가 열기 →
              </p>
            </Link>
          ))}
        </div>
      )}
      <section className="mb-10">
        <h2 className="section-title">등록 지표 · 전체 사업연도</h2>
        <p className="notice mb-5">
          위 분야 필터는 공식 보고 범위를 바꾸지 않습니다. 아래에 등록한 최신
          지표 정의와 해당 사업연도 전체 자료를 사용합니다. 실제 RISE 제출은
          별도 절차입니다.
        </p>
        {!b.metrics.length ? (
          <Empty title="등록된 지표 정의가 없습니다">
            목표·대상 집단·중복·산식을 등록하고 별도 승인자의 확인을 받아야
            보고를 확정할 수 있습니다.
          </Empty>
        ) : (
          <PerformanceMetrics
            rows={b.metrics}
            prepare={b.can_prepare}
            approve={b.can_approve}
            actor={me.id}
          />
        )}
      </section>
      {b.can_prepare && (
        <details className="panel mb-8">
          <summary className="cursor-pointer text-lg font-bold">
            지표 정의 초안·새 버전 등록
          </summary>
          <div className="mt-6">
            <ActionForm action={createMetric} label="지표 정의 초안 저장">
              <input type="hidden" name="y" value={year} />
              <div className="grid gap-4 md:grid-cols-2">
                <label className="field">
                  지표 코드 (영문 대문자·숫자·밑줄)
                  <input
                    name="code"
                    pattern="[A-Z][A-Z0-9_]{1,49}"
                    required
                    maxLength={50}
                  />
                </label>
                <label className="field">
                  지표명
                  <input name="title" maxLength={150} required />
                </label>
                <label className="field">
                  자료원
                  <select name="source">
                    {Object.entries(sourceLabels).map(([v, s]) => (
                      <option key={v} value={v}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  계산방식
                  <select name="formula">
                    <option value="COUNT">인원·건수: 분자값</option>
                    <option value="RATE">비율: 분자/분모 × 100</option>
                    <option value="DIRECT">외부 확인 지수값</option>
                  </select>
                </label>
                <label className="field">
                  단위
                  <input
                    name="unit"
                    maxLength={20}
                    placeholder="명, 건, % 등"
                    required
                  />
                </label>
                <label className="field">
                  목표값
                  <input
                    type="number"
                    name="target"
                    min="0"
                    max="1000000000"
                    step="0.0001"
                    required
                  />
                </label>
              </div>
              {[
                ["population", "대상 집단"],
                ["dedup_rule", "중복 산정 기준"],
                ["calculation", "산정 설명·근거 문서"],
                ["evidence_requirement", "필수 자료원·증빙"],
              ].map(([name, label]) => (
                <label className="field" key={name}>
                  {label}
                  <textarea name={name} maxLength={2000} rows={2} required />
                </label>
              ))}
              <p className="text-sm text-slate-600">
                내부 집계는 표시된 기준을 그대로 사용합니다. 수료율만 비율
                방식이며 다른 내부 집계는 인원·건수 방식입니다. 같은 코드를
                입력하면 새 버전이 생기고 재승인이 필요합니다.
              </p>
            </ActionForm>
          </div>
        </details>
      )}
      <section className="panel mb-8">
        <h2 className="section-title">등록 지표 보고 이력</h2>
        {b.can_prepare && (
          <div className="mb-6">
            <ActionForm
              action={createPerformanceReport}
              label="현재 자료로 보고 초안 생성"
              disabled={!b.metrics.length}
            >
              <input type="hidden" name="y" value={year} />
              <input type="hidden" name="request_key" value={randomUUID()} />
              <label className="field">
                보고 범위·작성 또는 정정 사유
                <textarea name="reason" maxLength={2000} rows={2} required />
              </label>
              <p className="text-sm text-slate-500">
                원자료·정의가 바뀌면 새 초안이 필요합니다. 기존 확정본은
                보존됩니다.
              </p>
            </ActionForm>
          </div>
        )}
        {!b.reports.length ? (
          <p className="text-sm text-slate-500">생성된 보고가 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {b.reports.map((r) => (
              <li key={r.id}>
                <Link
                  href={"/performance/reports/" + r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                >
                  <span>
                    v{r.version} · {qualityLabel(r.status)}
                    {r.stale ? " · 현재 자료 변경됨" : ""}
                    <span className="mt-1 block text-sm text-slate-500">
                      {dateTime(r.created_at)} · {r.reason}
                    </span>
                  </span>
                  <span className="text-sm text-teal-800">
                    확정본·근거 보기 →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <details className="panel">
        <summary className="cursor-pointer font-bold">
          사업계획 참고 · 2차년도 목표
        </summary>
        <p className="notice my-5">
          C1 사업계획 인쇄 168~169쪽의 목표입니다. 현재 실적이나 승인 지표
          정의가 아닙니다. 지원지수 64.5%와 문서 산식의 계산 결과가 달라
          사업단의 기준 확인이 필요합니다.
        </p>
        <dl className="space-y-3">
          {planTargets.map(([name, target]) => (
            <div
              className="flex flex-wrap justify-between gap-2 border-b pb-2 text-sm"
              key={name}
            >
              <dt>{name}</dt>
              <dd className="font-semibold">{target}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
