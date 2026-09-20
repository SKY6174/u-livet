import { ActionForm } from "@/components/portal/action-form";
import { SupportContact } from "@/components/common/support-contact";
import { currentContactPolicies } from "@/lib/portal/contact-policy-versions";
import { DossierEditor } from "@/components/portal/instructor-forms";
import {
  startDossier,
  submitDossier,
  decideDossier,
  withdrawDossier,
  setInstructorPublic,
} from "@/app/instructor-development-actions";
import { dateTime } from "@/lib/portal/data";
import {
  reviewLabels,
  eventLabels,
  type Dossier,
  type InstructorPolicy,
  type ReviewEvent,
} from "@/lib/instructors/types";
export function PolicyChoice({
  policies: suppliedPolicies,
  name,
  label,
}: {
  policies: InstructorPolicy[];
  name: string;
  label: string;
}) {
  const policies = currentContactPolicies(suppliedPolicies);
  return (
    <div className="space-y-3">
      <label className="field">
        {label}
        <select name={name} required defaultValue={policies.length === 1 ? policies[0].id : ""}>
          <option value="" disabled>
            승인된 기준 선택
          </option>
          {policies.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} · {p.version}
            </option>
          ))}
        </select>
      </label>
      {policies.map((p) => (
        <details key={p.id} open={policies.length === 1} className="text-sm">
          <summary className="cursor-pointer font-semibold">
            {p.title} · {p.version} 원문
          </summary>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-4">
            {p.body}
          </p>
        </details>
      ))}
      {!policies.length && (
        <p className="notice">
          등록된 유효 승인 기준이 없습니다. 사업단 기준 등록 후 사용할 수
          있습니다.
        </p>
      )}
    </div>
  );
}
export function DossierStartForm({
  orgId,
  policies,
  label = "이력 초안 만들기",
}: {
  orgId: string;
  policies: InstructorPolicy[];
  label?: string;
}) {
  const ownPolicies = policies.filter((policy) => policy.org_id === orgId);
  const privacyPolicies = ownPolicies.filter((policy) => policy.kind === "INSTRUCTOR_PRIVACY");
  const hasReview = ownPolicies.some((policy) => policy.kind === "INSTRUCTOR_REVIEW");
  if (!privacyPolicies.length || !hasReview) {
    return (
      <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-base leading-7">
        <h3 className="font-bold">사업단의 강사 등록 안내가 준비 중입니다</h3>
        <p className="mt-2">다음 항목이 등록되면 이력 작성을 시작할 수 있습니다.</p>
        <ul className="mt-2 list-disc pl-6">
          {!privacyPolicies.length && <li>강사 이력 개인정보 수집·이용 안내</li>}
          {!hasReview && <li>강사 이력 심사 기준</li>}
        </ul>
        <p className="mt-3">입력 오류가 아닙니다. 지금은 동의하거나 제출할 수 없습니다.</p>
        <SupportContact className="mt-3 text-teal-900" />
      </div>
    );
  }
  return (
    <ActionForm action={startDossier} label={label}>
      <input type="hidden" name="o" value={orgId} />
      <PolicyChoice policies={privacyPolicies} name="privacy" label="강사 이력 개인정보 안내" />
      <label className="flex min-h-11 items-start gap-3 text-base leading-7">
        <input className="mt-1 h-5 w-5 shrink-0" type="checkbox" name="confirmed" required />
        수집 항목·목적·보유기간과 권리 안내를 확인하고 동의합니다.
      </label>
    </ActionForm>
  );
}
export function ReviewHistory({ events }: { events: ReviewEvent[] }) {
  return (
    <details className="panel">
      <summary className="cursor-pointer font-bold">처리 이력</summary>
      <ol className="mt-4 space-y-3">
        {events.map((e, i) => (
          <li key={i} className="text-sm">
            <p>
              {dateTime(e.at)} · {eventLabels[e.action] ?? e.action}
            </p>
            {e.reason && (
              <p className="mt-1 whitespace-pre-wrap break-words text-slate-500">
                {e.reason}
              </p>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}
export function DossierDetail({
  dossier: d,
  policies,
}: {
  dossier: Dossier;
  policies: InstructorPolicy[];
}) {
  const ownPolicies = policies.filter((p) => p.org_id === d.org_id);
  const latest = d.versions[0];
  return (
    <div className="space-y-6">
      <div className="panel">
        <h2 className="section-title">{d.name} · 이력 심사</h2>
        <p className="notice">
          {d.current
            ? "현재 유효한 이력 확인이 있습니다."
            : "현재 유효한 최신 이력 승인이 없습니다."}{" "}
          이력 승인은 위촉·계약·강의 배정을 대신하지 않습니다.
        </p>
      </div>
      {d.versions.map((v, i) => (
        <section className="panel space-y-5" key={v.id}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="badge">{reviewLabels[v.status]}</span>
            <h3 className="text-lg font-bold">이력 v{v.version}</h3>
            {v.valid_until && (
              <span className="text-sm text-slate-500">
                확인 유효일까지 {v.valid_until}
              </span>
            )}
          </div>
          {v.status === "DRAFT" && d.owner ? (
            <DossierEditor key={`${v.id}-${v.revision}`} version={v} />
          ) : (
            <div className="space-y-4">
              <dl className="space-y-3">
                {[
                  ["전문분야", v.payload.specialty],
                  ["심사용 소개", v.payload.introduction],
                  ["공개 소개 후보", v.payload.public_intro || "등록 안 함"],
                ].map(([k, val]) => (
                  <div key={k}>
                    <dt className="text-sm text-slate-500">{k}</dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words">
                      {val}
                    </dd>
                  </div>
                ))}
              </dl>
              <h4 className="font-semibold">
                제출 이력 ·{" "}
                {v.status === "APPROVED" ? "증빙 확인 기록" : "자가신고 자료"}
              </h4>
              {v.payload.claims.map((c, n) => (
                <div key={n} className="rounded-xl bg-slate-50 p-4 text-sm">
                  <p className="font-semibold">
                    {reviewLabels[c.kind]} · {c.title}
                  </p>
                  <p className="mt-1">{c.organization}</p>
                  <p className="mt-1">
                    {c.started_on || "시작일 미기재"} ~{" "}
                    {c.ended_on || "종료일 미기재"}
                    {c.expires_on && ` · 자격 만료 ${c.expires_on}`}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-slate-600">
                    증빙 참조: {c.evidence}
                  </p>
                </div>
              ))}
            </div>
          )}
          {v.decision_reason && (
            <p className="notice whitespace-pre-wrap">
              심사·철회 사유: {v.decision_reason}
            </p>
          )}
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold">
              제출에 적용한 안내·심사 기준
            </summary>
            {v.notices.map((notice, i) => (
              <p className="mt-3 whitespace-pre-wrap" key={i}>
                {notice.title} · {notice.version}
                {"\n"}
                {notice.body}
              </p>
            ))}
          </details>
          {d.owner && v.status === "DRAFT" && (
            <details className="rounded-xl border border-teal-100 p-4">
              <summary className="cursor-pointer font-bold">
                저장한 이력을 심사에 제출
              </summary>
              <div className="mt-4">
                <ActionForm action={submitDossier} label="이력 심사 제출">
                  <input type="hidden" name="v" value={v.id} />
                  <input type="hidden" name="revision" value={v.revision} />
                  <PolicyChoice
                    policies={ownPolicies.filter(
                      (p) => p.kind === "INSTRUCTOR_REVIEW",
                    )}
                    name="policy"
                    label="강사 심사 기준"
                  />
                  <label className="flex items-start gap-3 text-sm">
                    <input type="checkbox" name="confirmed" required />
                    저장된 이력·증빙 참조와 심사 기준을 확인했습니다.
                  </label>
                  <p className="text-sm text-slate-500">
                    먼저 초안을 저장하세요. 제출 이후에는 새 버전으로
                    보완합니다.
                  </p>
                </ActionForm>
              </div>
            </details>
          )}
          {!d.owner && v.status === "SUBMITTED" && i === 0 && (
            <div className="border-t pt-5">
              <h4 className="mb-4 font-bold">사업단 검토</h4>
              <ActionForm action={decideDossier} label="심사 결과 저장">
                <input type="hidden" name="v" value={v.id} />
                <label className="field">
                  심사 결과
                  <select name="decision" required defaultValue="">
                    <option value="" disabled>
                      결과 선택
                    </option>
                    <option value="CHANGES_REQUESTED">보완 요청</option>
                    <option value="REJECTED">반려</option>
                    <option value="APPROVED">승인</option>
                  </select>
                </label>
                <label className="field">
                  검토 근거·보완 사유
                  <textarea name="reason" required maxLength={2000} />
                </label>
                <label className="field">
                  확인 유효일까지 (승인 시 필수)
                  <input type="date" name="valid_until" />
                </label>
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" name="verified" />
                  승인 기준과 제출된 모든 이력의 외부 증빙을 대조했습니다. (승인
                  시 필수)
                </label>
              </ActionForm>
            </div>
          )}
          {d.owner && ["DRAFT", "SUBMITTED"].includes(v.status) && (
            <details>
              <summary className="cursor-pointer text-sm text-red-700">
                이 버전 작성·제출 철회
              </summary>
              <div className="mt-4">
                <ActionForm action={withdrawDossier} label="이력 버전 철회">
                  <input type="hidden" name="v" value={v.id} />
                  <label className="field">
                    철회 사유
                    <textarea name="reason" required maxLength={2000} />
                  </label>
                </ActionForm>
              </div>
            </details>
          )}
        </section>
      ))}
      {d.owner && latest && !["DRAFT", "SUBMITTED"].includes(latest.status) && (
        <details className="panel">
          <summary className="cursor-pointer font-bold">
            이력 보완·정정 새 버전 작성
          </summary>
          <div className="mt-4">
              <p className="notice mb-4">
                새 버전을 만들면 기존 공개 소개가 숨겨지고 재심사합니다. 이전
                이력·결정은 보존됩니다.
              </p>
            <DossierStartForm orgId={d.org_id} policies={ownPolicies} label="새 버전 작성" />
          </div>
        </details>
      )}
      {d.owner && (
        <section className="panel space-y-4">
          <h2 className="section-title">과정의 공개 강사 소개</h2>
          <p className="notice">
            이름·전문분야·승인된 공개 소개만 실제 담당 과정에 표시합니다. 공개
            동의는 선택이며 언제든 철회할 수 있습니다. 이미 복사된 정보의 회수는
            보장하지 않습니다.
          </p>
          <p className="font-semibold">
            현재 설정:{" "}
            {d.public_enabled
              ? "공개 동의됨 · 정책·승인·배정 유효 시 표시"
              : "비공개"}
          </p>
          {d.public_enabled ? (
            <ActionForm action={setInstructorPublic} label="공개 동의 철회">
              <input type="hidden" name="d" value={d.id} />
              <input type="hidden" name="revision" value={d.revision} />
              <input type="hidden" name="enabled" value="false" />
            </ActionForm>
          ) : d.current ? (
            <ActionForm
              key={d.revision}
              action={setInstructorPublic}
              label="공개 소개 동의"
            >
              <input type="hidden" name="d" value={d.id} />
              <input type="hidden" name="revision" value={d.revision} />
              <input type="hidden" name="enabled" value="true" />
              <PolicyChoice
                policies={ownPolicies.filter(
                  (p) => p.kind === "INSTRUCTOR_PUBLIC",
                )}
                name="policy"
                label="공개 소개 안내"
              />
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="confirmed" required />
                공개 항목·목적·기간과 철회 방법을 확인하고 동의합니다.
              </label>
            </ActionForm>
          ) : (
            <p className="text-sm text-slate-500">
              최신 이력 승인과 공개 소개 후보 등록 후 설정할 수 있습니다.
            </p>
          )}
        </section>
      )}
      <ReviewHistory events={d.events} />
    </div>
  );
}
