import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID, dateTime } from "@/lib/portal/data";
import { PageIntro, Empty } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import {
  createBadgeDefinition,
  approveBadgeDefinition,
  retireBadgeDefinition,
  issueBadge,
  rejectBadgeRequest,
  revokeBadge,
} from "@/app/badge-actions";
import {
  badgeLabel,
  type BadgeOptions,
  type BadgeBoard,
} from "@/lib/badges/types";
export default async function BadgeOperations({
  searchParams,
}: {
  searchParams: Promise<{ offering?: string }>;
}) {
  const me = await requireIdentity("/credentials/badges");
  const db = await createServerSupabaseClient();
  const { data: options, error } = await db.rpc("life_badge_options");
  if (error || !options)
    return (
      <div className="page-shell">
        <Empty title="배지 관리 정보를 불러오지 못했습니다" />
      </div>
    );
  const c = options as BadgeOptions;
  const { offering } = await searchParams;
  let b: BadgeBoard | null = null;
  if (offering) {
    if (!UUID.test(offering) || !c.offerings.some((o) => o.id === offering))
      notFound();
    const r = await db.rpc("life_badge_board", { f: offering });
    if (r.error) notFound();
    b = r.data as BadgeBoard;
  }
  const issuers = c.issuers.filter((i) => i.org_id === b?.offering.org_id),
    policies = c.policies.filter((p) => p.org_id === b?.offering.org_id);
  const latest = b?.definitions[0];
  return (
    <div className="page-shell">
      <PageIntro eyebrow="BADGE OPERATIONS" title="디지털배지 관리">
        배지 정의를 별도로 승인하고 최신 수료 근거와 배지 발급 위임을
        확인합니다.
      </PageIntro>
      <p className="notice mb-6">
        기관 발급권에 BADGE 종류 위임이 필요합니다. 기존 이수증·경력증명
        위임만으로 배지를 발급할 수 없습니다. 내부 발급 배지이며 외부 업체로
        전송하지 않습니다.
      </p>
      {!c.offerings.length ? (
        <Empty title="조회 가능한 기수가 없습니다">
          과정담당 또는 유효한 배지 발급 위임이 필요합니다.
        </Empty>
      ) : (
        <form
          method="get"
          className="panel mb-6 flex flex-wrap items-end gap-4"
        >
          <label className="field flex-1">
            기수 선택
            <select name="offering" defaultValue={offering ?? ""} required>
              <option value="" disabled>
                과정·기수를 선택하세요
              </option>
              {c.offerings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-secondary">기수 열기</button>
        </form>
      )}
      {b && (
        <>
          <h2 className="section-title">{b.offering.name}</h2>
          {b.manager && (
            <details className="panel mb-6">
              <summary className="cursor-pointer font-bold">
                배지 정의 초안·새 버전 등록
              </summary>
              <div className="mt-5">
                {issuers.length && policies.length ? (
                  <ActionForm
                    action={createBadgeDefinition}
                    label="배지 정의 초안 저장"
                  >
                    <input type="hidden" name="f" value={offering} />
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="field">
                        기관 발급권
                        <select name="issuer" defaultValue="" required>
                          <option value="" disabled>
                            발급권 선택
                          </option>
                          {issuers.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.test_only ? "[검증용] " : ""}
                              {i.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        배지 발급 안내
                        <select name="policy" defaultValue="" required>
                          <option value="" disabled>
                            승인 안내문 선택
                          </option>
                          {policies.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title} · {p.version}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        배지명
                        <input name="title" maxLength={100} required />
                      </label>
                      <label className="field">
                        유효기간 기준
                        <select name="validity" defaultValue="" required>
                          <option value="" disabled>
                            명시적으로 선택
                          </option>
                          <option value="NONE">승인 기준상 만료 없음</option>
                          <option value="DAYS">발급 후 지정 일수</option>
                        </select>
                      </label>
                      <label className="field">
                        지정 일수 (선택 시 1~3,650)
                        <input name="days" type="number" min={1} max={3650} />
                      </label>
                    </div>
                    <label className="field">
                      배지 설명
                      <textarea name="description" required maxLength={2000} />
                    </label>
                    <label className="field">
                      확인하는 성취 내용
                      <textarea name="achievement" required maxLength={2000} />
                    </label>
                    <p className="text-sm text-slate-500">
                      현재 기수의 승인 수료 기준을 연결합니다. 역량·자격을
                      과장하지 말고 수료 근거로 확인 가능한 내용을 입력하세요.
                      새 초안 등록 후 재승인 전까지 신규 발급이 제한됩니다.
                    </p>
                    {policies.map((p) => (
                      <details key={p.id}>
                        <summary className="cursor-pointer text-sm">
                          {p.title} 원문
                        </summary>
                        <p className="mt-3 whitespace-pre-wrap text-sm">
                          {p.body}
                        </p>
                      </details>
                    ))}
                  </ActionForm>
                ) : (
                  <p className="notice">
                    승인된 배지 발급 안내와 유효한 기관 발급권을 먼저 등록해야
                    합니다.
                  </p>
                )}
              </div>
            </details>
          )}
          <h2 className="section-title">배지 정의·승인 이력</h2>
          <div className="space-y-5">
            {b.definitions.map((d) => (
              <article className="panel" key={d.id}>
                <span className="badge">
                  {d.revoked_at ? "정의 철회" : badgeLabel(d.status)} · v
                  {d.version}
                </span>
                <h3 className="mt-3 text-lg font-bold">{d.title}</h3>
                <p className="mt-3 whitespace-pre-wrap">{d.achievement}</p>
                <p className="mt-2 text-sm text-slate-500">
                  {d.validity_days
                    ? `발급 후 ${d.validity_days}일`
                    : "승인 기준상 만료 없음"}
                  {d.id === latest?.id ? " · 최신 버전" : ""}
                </p>
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold">
                    설명·정책·수료 기준·승인 근거
                  </summary>
                  <p className="mt-3 whitespace-pre-wrap text-sm">
                    {d.description}
                  </p>
                  <p className="mt-3 text-sm font-semibold">
                    {d.policy_title} · {d.policy_version}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {d.policy_body}
                  </p>
                  <p className="mt-3 text-sm font-semibold">
                    수료 정책 {d.completion_version}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {d.completion_body}
                  </p>
                  <p className="mt-3 break-words text-sm">
                    승인 근거: {d.approval_reference ?? "미승인"}
                  </p>
                </details>
                {d.can_issue &&
                  d.status === "DRAFT" &&
                  d.id === latest?.id &&
                  d.created_by !== me.id && (
                    <div className="mt-5">
                      <ActionForm
                        action={approveBadgeDefinition}
                        label="배지 정의 승인"
                      >
                        <input type="hidden" name="d" value={d.id} />
                        <label className="field">
                          확인한 승인 문서·근거
                          <input name="reference" required maxLength={2000} />
                        </label>
                      </ActionForm>
                    </div>
                  )}
                {d.can_issue && d.status === "APPROVED" && !d.revoked_at && (
                  <details className="mt-5">
                    <summary className="cursor-pointer text-sm">
                      배지 정의 철회
                    </summary>
                    <div className="mt-3">
                      <ActionForm
                        action={retireBadgeDefinition}
                        label="정의 승인 철회"
                      >
                        <input type="hidden" name="d" value={d.id} />
                        <label className="field">
                          철회 사유
                          <input name="reason" required maxLength={2000} />
                        </label>
                        <label className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            name="confirmed"
                            className="mt-1"
                            required
                          />
                          <span>
                            이 정의로 이미 발급한 배지도 취소 상태가 되는 것을
                            확인했습니다.
                          </span>
                        </label>
                      </ActionForm>
                    </div>
                  </details>
                )}
              </article>
            ))}
            {!b.definitions.length && (
              <Empty title="등록된 배지 정의가 없습니다" />
            )}
          </div>
          <h2 className="section-title mt-10">발급 신청 처리</h2>
          <div className="space-y-5">
            {b.requests.map((r) => (
              <article key={r.id} className="panel">
                <span className="badge">{badgeLabel(r.status)}</span>
                <h3 className="mt-3 font-bold">
                  {r.person_name} · {r.title} v{r.version}
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  신청 {dateTime(r.requested_at)}
                </p>
                {r.reason && (
                  <p className="mt-3 whitespace-pre-wrap text-sm">
                    정정 사유: {r.reason}
                  </p>
                )}
                {r.decision_reason && (
                  <p className="mt-3 whitespace-pre-wrap text-sm">
                    처리 사유: {r.decision_reason}
                  </p>
                )}
                {r.award_id && r.can_issue && (
                  <Link
                    className="mt-4 block text-teal-800 underline"
                    href={"/badges/" + r.award_id}
                  >
                    발급 원본 보기 →
                  </Link>
                )}
                {r.status === "REQUESTED" && (
                  <div className="mt-5">
                    <p className="notice mb-4">
                      현재 근거:{" "}
                      {r.ready
                        ? "승인 정의·최신 수료 확인"
                        : "정의·정책·최신 수료 확인 필요"}
                    </p>
                    {r.can_issue && (
                      <>
                        <ActionForm
                          action={issueBadge}
                          label="확인 후 배지 발급"
                          disabled={!r.ready || r.person_id === me.id}
                        >
                          <input type="hidden" name="r" value={r.id} />
                          <label className="field">
                            검토·발급 근거
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
                              현재 수료 근거와 승인 배지 정의·발급 위임을
                              확인했습니다.
                            </span>
                          </label>
                        </ActionForm>
                        <details className="mt-5">
                          <summary className="cursor-pointer text-sm">
                            신청 반려
                          </summary>
                          <div className="mt-3">
                            <ActionForm
                              action={rejectBadgeRequest}
                              label="반려 사유 저장"
                            >
                              <input type="hidden" name="r" value={r.id} />
                              <label className="field">
                                반려 사유
                                <input
                                  name="reason"
                                  required
                                  maxLength={2000}
                                />
                              </label>
                            </ActionForm>
                          </div>
                        </details>
                      </>
                    )}
                  </div>
                )}
              </article>
            ))}
            {!b.requests.length && (
              <p className="text-sm text-slate-500">발급 신청이 없습니다.</p>
            )}
          </div>
          <h2 className="section-title mt-10">발급 원장·취소</h2>
          <div className="space-y-4">
            {b.awards.map((a) => (
              <article className="panel" key={a.id}>
                <span className="badge">{badgeLabel(a.state)}</span>
                <h3 className="mt-3 font-semibold">
                  {a.person_name} · {a.title}
                </h3>
                <p className="mt-2 break-all text-xs text-slate-500">
                  {a.number}
                </p>
                {a.can_issue && (
                  <>
                    <Link
                      className="mt-4 block text-teal-800 underline"
                      href={"/badges/" + a.id}
                    >
                      상세 기록
                    </Link>
                    {a.status === "ISSUED" && (
                      <details className="mt-4">
                        <summary className="cursor-pointer text-sm">
                          발급 취소 기록
                        </summary>
                        <div className="mt-3">
                          <ActionForm
                            action={revokeBadge}
                            label="배지 발급 취소"
                          >
                            <input type="hidden" name="i" value={a.id} />
                            <label className="field">
                              취소 사유
                              <input name="reason" required maxLength={2000} />
                            </label>
                          </ActionForm>
                        </div>
                      </details>
                    )}
                  </>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
