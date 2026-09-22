import Link from "next/link";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageIntro, Empty } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import { BadgeMark } from "@/components/portal/badge-mark";
import { requestBadge, cancelBadgeRequest } from "@/app/badge-actions";
import { badgeLabel, type BadgeWallet } from "@/lib/badges/types";
import { dateTime } from "@/lib/portal/data";
export default async function Wallet() {
  await requireIdentity("/mypage/badges");
  const { data, error } = await (
    await createServerSupabaseClient()
  ).rpc("life_badge_wallet");
  if (error || !data)
    return (
      <div className="page-shell">
        <Empty title="배지함을 불러오지 못했습니다" />
      </div>
    );
  const w = data as BadgeWallet;
  return (
    <div className="page-shell">
      <PageIntro eyebrow="MY ACHIEVEMENTS" title="나의 디지털배지">
        승인된 수료 성과를 배지로 보관하고 필요한 때에 공유하세요. 배지는 기본
        비공개입니다.
      </PageIntro>
      <p className="notice mb-6">
        홈페이지 내부에서 발급·검증하는 배지입니다. 외부 배지 지갑 연동은
        제공하지 않습니다. 발급·공유 신청 여부가 수료나 이수증에 영향을 주지
        않습니다.
      </p>
      <h2 className="section-title">발급받은 배지</h2>
      {!w.awards.length ? (
        <Empty title="발급받은 배지가 없습니다">
          승인된 배지 기준과 최신 수료 확정이 있으면 아래에서 신청할 수
          있습니다.
        </Empty>
      ) : (
        <div className="mb-8 grid gap-5 md:grid-cols-2">
          {w.awards.map((a) => (
            <Link
              key={a.id}
              href={"/badges/" + a.id}
              className="panel flex items-start gap-5"
            >
              <BadgeMark />
              <div className="min-w-0">
                <span className="badge">{badgeLabel(a.state)}</span>
                <h3 className="mt-3 text-lg font-bold">{a.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{a.name}</p>
                <p className="mt-2 text-xs text-slate-500">
                  발급 {dateTime(a.issued_at)}
                </p>
                {a.test_only && (
                  <p className="mt-2 text-sm text-amber-800">
                    검증용 · 실제 기관 배지 아님
                  </p>
                )}
                <p className="mt-4 text-sm text-teal-800">
                  상세·원본·공유 관리 →
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
      <h2 className="section-title mt-10">배지 기준과 발급 신청</h2>
      {!w.eligible.length ? (
        <Empty title="현재 공개된 배지 기준이 없습니다">
          사업단의 배지 정의 승인이 필요합니다.
        </Empty>
      ) : (
        <div className="space-y-5">
          {w.eligible.map((b) => {
            const pending = w.requests.find(
              (r) =>
                r.offering_id === b.offering_id && r.status === "REQUESTED",
            );
            const latest = w.awards.find(
              (a) =>
                a.offering_id === b.offering_id && a.state !== "SUPERSEDED",
            );
            const replacement =
              latest && ["STALE", "REVOKED", "EXPIRED"].includes(latest.state);
            return (
              <article className="panel" key={b.id}>
                <h3 className="text-lg font-bold">
                  {b.title} · v{b.version}
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  {b.name} ·{" "}
                  {b.validity_days
                    ? `발급 후 ${b.validity_days}일 유효`
                    : "승인 기준상 만료일 없음"}
                </p>
                <p className="mt-4 whitespace-pre-wrap">{b.description}</p>
                <p className="mt-3 whitespace-pre-wrap text-sm">
                  성취 내용: {b.achievement}
                </p>
                <details className="mt-4">
                  <summary className="cursor-pointer font-semibold">
                    발급·수료 기준 원문
                  </summary>
                  <h4 className="mt-3 text-sm font-bold">
                    {b.policy_title} · {b.policy_version}
                  </h4>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {b.policy_body}
                  </p>
                  <h4 className="mt-4 text-sm font-bold">수료 기준</h4>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {b.completion_body}
                  </p>
                </details>
                <div className="mt-5">
                  {pending ? (
                    <p className="notice">
                      발급 검토 중입니다. 아래 신청 이력에서 확인하거나 철회할
                      수 있습니다.
                    </p>
                  ) : latest && !replacement ? (
                    <p className="notice">
                      현재 발급된 배지를 위 배지함에서 확인하세요.
                    </p>
                  ) : !b.ready ? (
                    <p className="notice">
                      최신 수료 확정 또는 배지 기준·발급권 확인이 필요합니다.
                    </p>
                  ) : (
                    <ActionForm
                      action={requestBadge}
                      label={
                        replacement ? "정정 배지 발급 신청" : "배지 발급 신청"
                      }
                    >
                      <input type="hidden" name="d" value={b.id} />
                      <input type="hidden" name="policy" value={b.policy_id} />
                      {replacement && (
                        <>
                          <input
                            type="hidden"
                            name="supersedes"
                            value={latest.id}
                          />
                          <label className="field">
                            대체 발급 사유
                            <textarea name="reason" required maxLength={2000} />
                          </label>
                        </>
                      )}
                      <label className="flex items-start gap-3">
                        <input
                          className="mt-1"
                          type="checkbox"
                          name="confirmed"
                          required
                        />
                        <span>
                          발급 안내와 수료 기준을 확인하고 선택 신청합니다.
                          공유는 별도 설정입니다.
                        </span>
                      </label>
                    </ActionForm>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <h2 className="section-title mt-10">신청 이력</h2>
      <div className="space-y-4">
        {w.requests.map((r) => (
          <article key={r.id} className="panel">
            <span className="badge">{badgeLabel(r.status)}</span>
            <h3 className="mt-3 font-semibold">{r.title}</h3>
            <p className="mt-2 text-sm text-slate-500">
              {r.name} · {dateTime(r.requested_at)}
            </p>
            {r.reason && (
              <p className="mt-3 whitespace-pre-wrap text-sm">
                신청 사유: {r.reason}
              </p>
            )}
            {r.decision_reason && (
              <p className="mt-3 whitespace-pre-wrap text-sm">
                처리 사유: {r.decision_reason}
              </p>
            )}
            {r.status === "REQUESTED" && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm">신청 철회</summary>
                <div className="mt-3">
                  <ActionForm
                    action={cancelBadgeRequest}
                    label="발급 신청 철회"
                  >
                    <input type="hidden" name="r" value={r.id} />
                    <label className="field">
                      철회 사유
                      <input name="reason" required maxLength={2000} />
                    </label>
                  </ActionForm>
                </div>
              </details>
            )}
          </article>
        ))}
        {!w.requests.length && (
          <p className="text-sm text-slate-500">신청 이력이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
