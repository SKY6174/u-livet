import { ActionForm } from "@/components/portal/action-form";
import { approveMetric, recordMetric } from "@/app/performance-actions";
import {
  qualityLabel,
  sourceLabels,
  type MetricRow,
} from "@/lib/performance/types";
export function PerformanceMetrics({
  rows,
  prepare = false,
  approve = false,
  actor,
}: {
  rows: MetricRow[];
  prepare?: boolean;
  approve?: boolean;
  actor?: string;
}) {
  return (
    <div className="space-y-5">
      {rows.map((m) => (
        <article key={m.definition.id} className="panel min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="badge">
                {qualityLabel(m.definition.status)} · v{m.definition.version}
              </span>
              <h3 className="mt-3 text-lg font-bold">{m.definition.title}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {m.definition.code} · {sourceLabels[m.definition.source]}
              </p>
            </div>
            <div className="text-right">
              <strong className="text-3xl text-teal-800">
                {m.value ?? "미확인"}
              </strong>{" "}
              <span>{m.definition.unit}</span>
              <p className="text-sm text-slate-500">
                등록 목표 {m.definition.target}
                {m.definition.unit}
              </p>
            </div>
          </div>
          {m.blocker ? (
            <p className="notice mt-4">
              확정 전 확인: {qualityLabel(m.blocker)}
            </p>
          ) : m.definition.target > 0 && m.value !== null ? (
            <div className="mt-5">
              <label className="text-sm">
                목표 대비 {((m.value / m.definition.target) * 100).toFixed(1)}%
                <progress
                  className="mt-2 h-2 w-full accent-teal-700"
                  max={100}
                  value={Math.min(100, (m.value / m.definition.target) * 100)}
                />
              </label>
            </div>
          ) : null}
          <p className="mt-4 text-sm">
            분자 {m.numerator ?? "미확인"} · 분모{" "}
            {m.denominator ??
              (m.definition.formula === "RATE" ? "미확인" : "해당 없음")}{" "}
            · 미확인 {m.unknown_count ?? "자료 없음"}
          </p>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold">
              대상·중복·산정·증빙 근거
            </summary>
            <dl className="mt-3 space-y-3 break-words">
              {[
                ["대상 집단", m.definition.population],
                ["중복 기준", m.definition.dedup_rule],
                ["산정 설명", m.definition.calculation],
                ["증빙 요구", m.definition.evidence_requirement],
                ["승인 근거", m.definition.approval_reference ?? "미승인"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="font-semibold">{k}</dt>
                  <dd className="whitespace-pre-wrap">{v}</dd>
                </div>
              ))}
              {m.observation && (
                <>
                  <div>
                    <dt className="font-semibold">관측 기준일</dt>
                    <dd>{m.observation.observed_on}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">자료원·증빙 참조</dt>
                    <dd>
                      {m.observation.source_reference}
                      <br />
                      {m.observation.evidence_reference}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </details>
          {approve &&
            m.definition.status === "DRAFT" &&
            m.definition.created_by !== actor && (
              <div className="mt-6">
                <ActionForm action={approveMetric} label="지표 정의 승인">
                  <input type="hidden" name="m" value={m.definition.id} />
                  <label className="field">
                    공식 기준 확인·승인 문서 참조
                    <input name="reference" maxLength={2000} required />
                  </label>
                </ActionForm>
              </div>
            )}
          {prepare &&
            m.definition.source === "EXTERNAL" &&
            m.definition.status === "APPROVED" && (
              <details className="mt-6 border-t pt-4">
                <summary className="cursor-pointer font-semibold">
                  외부 확인 자료 등록·정정
                </summary>
                <div className="mt-4">
                  <ActionForm action={recordMetric} label="새 관측 기록 저장">
                    <input type="hidden" name="m" value={m.definition.id} />
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="field">
                        {m.definition.formula === "DIRECT"
                          ? "확인된 지수값"
                          : "분자"}
                        <input
                          type="number"
                          name="n"
                          min="0"
                          max="1000000000"
                          step={
                            m.definition.formula === "COUNT" ? "1" : "0.0001"
                          }
                          required
                        />
                      </label>
                      {m.definition.formula === "RATE" && (
                        <label className="field">
                          분모
                          <input
                            type="number"
                            name="d"
                            min="0"
                            max="1000000000"
                            step="0.0001"
                            required
                          />
                        </label>
                      )}
                      <label className="field">
                        미확인 수 (0도 직접 확인)
                        <input
                          type="number"
                          name="unknown_count"
                          min="0"
                          step="1"
                          required
                        />
                      </label>
                      <label className="field">
                        관측 기준일
                        <input type="date" name="observed" required />
                      </label>
                    </div>
                    <label className="field">
                      자료원 참조
                      <input name="source_ref" maxLength={2000} required />
                    </label>
                    <label className="field">
                      확인한 증빙 문서 참조
                      <input name="evidence" maxLength={2000} required />
                    </label>
                    <p className="text-sm text-slate-600">
                      개인 명단은 입력하지 마세요. 미응답·미확인을 0명이나
                      미취업으로 바꾸지 않습니다. 정정은 이전 기록을 보존하고
                      새로 저장합니다.
                    </p>
                  </ActionForm>
                </div>
              </details>
            )}
        </article>
      ))}
    </div>
  );
}
