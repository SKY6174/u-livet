import Link from "next/link";
import { randomUUID } from "node:crypto";
import { ActionForm } from "@/components/portal/action-form";
import { DevelopmentEditor } from "@/components/portal/development-forms";
import {
  PolicyChoice,
  ReviewHistory,
} from "@/components/portal/instructor-detail";
import {
  startDevelopment,
  submitDevelopment,
  decideDevelopment,
  withdrawDevelopment,
  revokeDevelopment,
  openDevelopment,
} from "@/app/instructor-development-actions";
import {
  reviewLabels,
  type Development,
  type InstructorOptions,
} from "@/lib/instructors/types";
export function DevelopmentDetail({
  development: d,
  options,
}: {
  development: Development;
  options: InstructorOptions;
}) {
  const policies = options.policies.filter((p) => p.org_id === d.org_id),
    latest = d.versions[0];
  return (
    <div className="space-y-6">
      <p className="notice">
        {d.name} · 최초 제안: {reviewLabels[d.kind]} ·{" "}
        {options.years.find((y) => y.id === d.project_year_id)?.label}.
        개발·개편 승인과 실제 기수 개설은 별도 기록입니다.
      </p>
      {d.versions.map((v, i) => (
        <section key={v.id} className="panel space-y-5">
          <div className="flex flex-wrap gap-3">
            <span className="badge">
              {v.revoked_at ? "승인 취소" : reviewLabels[v.status]}
            </span>
            <h2 className="text-xl font-bold">
              제안 v{v.version} · {v.payload.title || "과정명 작성 전"}
            </h2>
          </div>
          {v.status === "DRAFT" && d.can_write ? (
            <DevelopmentEditor key={`${v.id}-${v.revision}`} version={v} />
          ) : (
            <div className="space-y-5">
              <dl className="grid gap-4 md:grid-cols-2">
                {[
                  ["아카데미·분야", v.payload.academy],
                  [
                    "정원·시간",
                    `${v.payload.capacity}명 · 이론 ${v.payload.theory_minutes}분 / 실습 ${v.payload.practice_minutes}분`,
                  ],
                  ["과정 소개", v.payload.summary],
                  ["수요·개발 근거", v.payload.rationale],
                  ["교육대상", v.payload.target],
                  ["목표 역량", v.payload.outcomes],
                  ["선수조건", v.payload.prerequisites],
                  ["평가·수료 제안", v.payload.assessment],
                  ["교재·준비물", v.payload.materials],
                  ["예산 근거", v.payload.budget],
                ].map(([k, val]) => (
                  <div key={k}>
                    <dt className="text-sm text-slate-500">{k}</dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words">
                      {val}
                    </dd>
                  </div>
                ))}
              </dl>
              <h3 className="font-bold">차시별 계획</h3>
              {v.payload.sessions.map((s, n) => (
                <div className="rounded-xl bg-slate-50 p-4 text-sm" key={n}>
                  <p className="font-semibold">
                    {n + 1}차시 · {s.title} · {reviewLabels[s.method]}{" "}
                    {s.minutes}분
                  </p>
                  <p className="mt-2 whitespace-pre-wrap">{s.content}</p>
                  <p className="mt-2">장비·준비물: {s.equipment}</p>
                  <p className="mt-2">활동·평가: {s.assessment}</p>
                </div>
              ))}
            </div>
          )}
          {!!v.notices.length && (
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold">
                제출 당시 개발·수료 기준
              </summary>
              {v.notices.map((notice, i) => (
                <p className="mt-3 whitespace-pre-wrap" key={i}>
                  {notice.title} · {notice.version}
                  {"\n"}
                  {notice.body}
                </p>
              ))}
            </details>
          )}
          {v.decision_reason && (
            <p className="notice whitespace-pre-wrap">
              심의 근거·사유: {v.decision_reason}
            </p>
          )}
          {v.revocation_reason && (
            <p className="notice text-red-700">
              승인 취소: {v.revocation_reason}
            </p>
          )}
          {d.can_write && v.status === "DRAFT" && (
            <details className="rounded-xl border border-teal-100 p-4">
              <summary className="cursor-pointer font-bold">
                저장한 제안을 심의에 제출
              </summary>
              <div className="mt-4">
                <ActionForm action={submitDevelopment} label="과정 심의 제출">
                  <input type="hidden" name="v" value={v.id} />
                  <input type="hidden" name="revision" value={v.revision} />
                  <PolicyChoice
                    policies={policies.filter((p) => p.kind === "DEVELOPMENT")}
                    name="policy"
                    label="과정 개발 기준"
                  />
                  <PolicyChoice
                    policies={policies.filter((p) => p.kind === "COMPLETION")}
                    name="completion"
                    label="적용할 승인 수료 정책"
                  />
                  <label className="flex items-start gap-3 text-sm">
                    <input type="checkbox" name="confirmed" required />
                    저장한 계획·시간 합계와 선택한 기준을 확인했습니다.
                  </label>
                </ActionForm>
              </div>
            </details>
          )}
          {d.manager && !d.owner && v.status === "SUBMITTED" && i === 0 && (
            <div className="border-t pt-5">
              <h3 className="mb-4 font-bold">사업단 과정 심의</h3>
              <ActionForm
                action={decideDevelopment}
                label="과정 심의 결과 저장"
              >
                <input type="hidden" name="v" value={v.id} />
                <label className="field">
                  심의 결과
                  <select name="decision" required defaultValue="">
                    <option value="" disabled>
                      결과 선택
                    </option>
                    <option value="CHANGES_REQUESTED">보완 요청</option>
                    <option value="REJECTED">반려</option>
                    <option value="APPROVED">승인 · 과정 버전 생성</option>
                  </select>
                </label>
                <label className="field">
                  심의 근거·사유
                  <textarea name="reason" required maxLength={2000} />
                </label>
                <p className="notice">
                  승인하면 현재 제안으로 고정된 과정 버전을 만듭니다. 평가
                  제안을 실제 수료 산식에 자동 반영하지 않습니다.
                </p>
              </ActionForm>
            </div>
          )}
          {d.owner && ["DRAFT", "SUBMITTED"].includes(v.status) && (
            <details>
              <summary className="cursor-pointer text-sm text-red-700">
                작성·심의 요청 철회
              </summary>
              <div className="mt-3">
                <ActionForm action={withdrawDevelopment} label="제안 버전 철회">
                  <input type="hidden" name="v" value={v.id} />
                  <label className="field">
                    철회 사유
                    <textarea name="reason" required maxLength={2000} />
                  </label>
                </ActionForm>
              </div>
            </details>
          )}
          {d.manager && v.ready && (
            <details className="rounded-xl border border-teal-100 p-4">
              <summary className="cursor-pointer font-bold">
                이 승인본으로 기수 초안 개설
              </summary>
              <div className="mt-4">
                <ActionForm action={openDevelopment} label="기수 초안 개설">
                  <input type="hidden" name="v" value={v.id} />
                  <input
                    type="hidden"
                    name="request_key"
                    value={randomUUID()}
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="field">
                      개설 사업연도
                      <select
                        name="year"
                        required
                        defaultValue={d.project_year_id}
                      >
                        {options.years
                          .filter((y) => y.org_id === d.org_id)
                          .map((y) => (
                            <option key={y.id} value={y.id}>
                              {y.label}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="field">
                      기수명
                      <input
                        name="name"
                        required
                        maxLength={200}
                        defaultValue={v.payload.title}
                      />
                    </label>
                    <label className="field">
                      운영방식
                      <select name="mode">
                        <option value="OFFLINE">대면</option>
                        <option value="ONLINE">온라인</option>
                        <option value="BLENDED">혼합</option>
                      </select>
                    </label>
                    <label className="field">
                      교육장소
                      <input name="location" required maxLength={200} />
                    </label>
                    <label className="field">
                      모집 정원
                      <input
                        name="capacity"
                        type="number"
                        min={1}
                        max={v.payload.capacity}
                        required
                        defaultValue={v.payload.capacity}
                      />
                    </label>
                    <label className="field">
                      선발방식
                      <select name="selection_method">
                        <option value="REVIEW">신청 후 심사</option>
                        <option value="FIRST_COME">선착순</option>
                      </select>
                    </label>
                    {[
                      ["apply_from", "접수 시작"],
                      ["apply_until", "접수 마감"],
                    ].map(([k, l]) => (
                      <label className="field" key={k}>
                        {l} (한국시간)
                        <input name={k} type="datetime-local" required />
                      </label>
                    ))}
                    {[
                      ["starts_on", "교육 시작일"],
                      ["ends_on", "교육 종료일"],
                    ].map(([k, l]) => (
                      <label className="field" key={k}>
                        {l}
                        <input name={k} type="date" required />
                      </label>
                    ))}
                  </div>
                  <p className="notice">
                    무료 초안으로 생성합니다. 유료 설정·승인 모집 안내·수료 정책
                    확인과 강사 배정은 기수 상세에서 진행합니다.
                  </p>
                </ActionForm>
              </div>
            </details>
          )}
          {d.manager && v.status === "APPROVED" && !v.revoked_at && (
            <details>
              <summary className="cursor-pointer text-sm text-red-700">
                승인 취소
              </summary>
              <div className="mt-3">
                <ActionForm action={revokeDevelopment} label="과정 승인 취소">
                  <input type="hidden" name="v" value={v.id} />
                  <label className="field">
                    승인 취소 근거
                    <textarea name="reason" maxLength={2000} required />
                  </label>
                  <label className="flex items-start gap-3 text-sm">
                    <input type="checkbox" name="confirmed" required />
                    신규 개설·모집 공개가 제한됩니다. 이미 운영한 기수는 별도
                    검토하며 삭제되지 않음을 확인했습니다.
                  </label>
                </ActionForm>
              </div>
            </details>
          )}
        </section>
      ))}
      {d.can_write &&
        latest &&
        !["DRAFT", "SUBMITTED"].includes(latest.status) && (
          <section className="panel">
            <h2 className="section-title">보완·후속 개편</h2>
            <ActionForm
              action={startDevelopment}
              label="이전 내용을 복사해 새 버전 작성"
            >
              <input type="hidden" name="o" value={d.org_id} />
              <input type="hidden" name="y" value={d.project_year_id} />
              <input type="hidden" name="p" value={d.id} />
              <input type="hidden" name="kind" value={d.kind} />
              <p className="notice">
                이전 내용·심의 결과는 유지됩니다. 새 버전이 승인되기 전까지 이전
                버전으로 신규 기수를 개설할 수 없습니다.
              </p>
            </ActionForm>
          </section>
        )}
      {!!d.openings.length && (
        <section className="panel">
          <h2 className="section-title">연결된 개설 기수</h2>
          <ul className="space-y-3">
            {d.openings.map((o) => (
              <li key={o.id}>
                {d.manager ? (
                  <Link
                    href={`/admin/offerings/${o.id}`}
                    className="text-teal-800 underline"
                  >
                    {o.name}
                  </Link>
                ) : (
                  <span>{o.name}</span>
                )}{" "}
                ·{" "}
                {o.status === "DRAFT"
                  ? "개설 초안"
                  : o.status === "PUBLISHED"
                    ? "공개"
                    : "마감"}
              </li>
            ))}
          </ul>
        </section>
      )}
      <ReviewHistory events={d.events} />
    </div>
  );
}
