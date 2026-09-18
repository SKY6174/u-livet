import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID, dateTime } from "@/lib/portal/data";
import { PageIntro } from "@/components/portal/ui";
import { BadgeMark } from "@/components/portal/badge-mark";
import { BadgeShare } from "@/components/portal/badge-share";
import { badgeLabel, type BadgeDetail } from "@/lib/badges/types";
export const metadata = {
  title: "디지털배지 발급 기록",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Badge({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireIdentity("/badges/" + id);
  if (!UUID.test(id)) notFound();
  const { data, error } = await (
    await createServerSupabaseClient()
  ).rpc("life_badge_detail", { i: id });
  if (error || !data) notFound();
  const b = data as BadgeDetail,
    a = b.artifact;
  return (
    <div className="page-shell">
      <Link
        className="text-sm text-teal-800 underline"
        href={b.owner ? "/mypage/badges" : "/credentials/badges"}
      >
        ← {b.owner ? "나의 배지함" : "배지 관리"}
      </Link>
      <PageIntro eyebrow="DIGITAL BADGE" title={a.badge.title}>
        발급 당시 기록과 현재 유효 상태를 함께 확인합니다.
      </PageIntro>
      <section className="panel">
        <div className="flex items-start gap-5">
          <BadgeMark />
          <div className="min-w-0">
            <span className="badge">{badgeLabel(b.state)}</span>
            <h2 className="mt-3 text-2xl font-bold">{a.recipient_name}</h2>
            <p className="mt-2 text-slate-600">{a.course.name}</p>
            <p className="mt-3 break-all text-xs text-slate-500">{b.number}</p>
          </div>
        </div>
        {a.issuer.test_only && (
          <p className="notice mt-5">
            로컬 검증용입니다. 실제 사업단이 발급한 배지가 아닙니다.
          </p>
        )}
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            ["발급기관", a.issuer.organization],
            ["발급 명의", a.issuer.title + " " + a.issuer.holder_name],
            ["발급일", dateTime(b.issued_at)],
            [
              "만료일",
              b.expires_at ? dateTime(b.expires_at) : "승인 기준상 없음",
            ],
            ["교육기간", a.course.starts_on + " ~ " + a.course.ends_on],
            ["정의 버전", "v" + a.badge.definition_version],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-sm text-slate-500">{k}</dt>
              <dd className="mt-1 break-words">{v}</dd>
            </div>
          ))}
        </dl>
        <h3 className="mt-6 font-bold">성취 내용</h3>
        <p className="mt-2 whitespace-pre-wrap">{a.badge.achievement}</p>
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
          {a.badge.description}
        </p>
        <details className="mt-5">
          <summary className="cursor-pointer font-semibold">
            확정 수료 근거
          </summary>
          <p className="mt-3 text-sm">
            수료 승인 {dateTime(a.completion.approved_at)} · 정책{" "}
            {a.completion.policy_version}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm">
            {a.completion.policy_body}
          </p>
        </details>
        {b.revocation_reason && (
          <p className="notice mt-5">취소 사유: {b.revocation_reason}</p>
        )}
        {b.supersedes_id && (
          <Link
            href={"/badges/" + b.supersedes_id}
            className="mt-4 block text-teal-800 underline"
          >
            이전 배지 기록
          </Link>
        )}
        <p className="notice mt-6">
          {a.verification_note} 아래 원본 파일을 공유하면 성명 등 발급 내용이
          포함됩니다.
        </p>
        {b.state === "ISSUED" ? (
          <a className="btn-primary mt-5" href={"/api/badges/" + b.id}>
            배지 원본 JSON 내려받기
          </a>
        ) : (
          <p className="mt-5 text-sm text-amber-800">
            현재 유효 상태가 아니므로 원본 다운로드와 새 공유를 제한합니다.
            정정이 필요하면 배지함에서 신청하세요.
          </p>
        )}
        <p className="mt-4 break-all text-xs text-slate-500">
          원본 SHA-256: {b.sha256}
        </p>
      </section>
      {b.owner && b.share && (
        <BadgeShare
          id={b.id}
          current={b.share}
          policies={b.share_policies}
          canShare={b.state === "ISSUED"}
        />
      )}
      <section className="panel mt-6">
        <h2 className="section-title">처리 이력</h2>
        <ol className="space-y-4">
          {b.events.map((e, i) => (
            <li key={i} className="text-sm">
              <p>
                {dateTime(e.at)} · {badgeLabel(e.action)}
              </p>
              {e.reason && (
                <p className="mt-1 whitespace-pre-wrap text-slate-500">
                  {e.reason}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
