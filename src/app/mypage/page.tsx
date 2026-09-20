import Link from "next/link";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWorkspaceOfferings, statusLabel, dateTime } from "@/lib/portal/data";
import type { Application } from "@/lib/portal/types";
import { ActionForm } from "@/components/portal/action-form";
import { decideApplication } from "@/app/actions";
import { Empty, PageIntro } from "@/components/portal/ui";
import { AccountSecurity } from "@/components/auth/account-security";
export default async function MyPage() {
  const me = await requireIdentity();
  const db = await createServerSupabaseClient();
  const { data, error } = await db
    .from("life_applications")
    .select("*")
    .eq("person_id", me.id)
    .order("submitted_at", { ascending: false });
  const items = (data ?? []) as Application[];
  const { offerings, unavailable } = await getWorkspaceOfferings(
    "id", error ? [] : items.map((item) => item.offering_id),
  );
  return (
    <div className="page-shell">
      <PageIntro eyebrow="MY LEARNING" title={`${me.name} 님의 나의 공간`}>
        신청부터 학습까지, 현재 상태를 한눈에 확인하세요.
      </PageIntro>
      <div className="mb-8 flex flex-wrap gap-3">
        {me.roles.some(r => r.role === "SYSTEM_ADMIN") && <Link className="btn-secondary" href="/admin/accounts">사업단 직책·강사 구분 관리</Link>}
        <Link className="btn-secondary" href="/auth/security">
          계정 보안·추가 인증
        </Link>
        <Link className="btn-secondary" href="/mypage/instructor">
          강사 이력·등록 심사
        </Link>
        <Link className="btn-secondary" href="/mypage/badges">
          나의 디지털배지
        </Link>
        <Link className="btn-secondary" href="/mypage/surveys">
          과정 만족도 조사
        </Link>
        <Link className="btn-secondary" href="/mypage/notifications">
          연락처·홍보 수신 설정
        </Link>
        <Link className="btn-secondary" href="/courses">
          새 과정 찾기
        </Link>
        <Link className="btn-secondary" href="/mypage/history">
          수강이력·수료 현황
        </Link>
        <Link className="btn-secondary" href="/mypage/certificates">
          증명 신청·발급
        </Link>
      </div>
      <Link className="btn-secondary mb-8 inline-block" href="/mypage/payments">
        나의 납부·환불
      </Link>
      {me.roles.some((role) => role.role !== "INSTRUCTOR") && <AccountSecurity />}
      <h2 className="section-title">신청 현황과 강의실</h2>
      {error || unavailable ? (
        <Empty title="신청 현황을 불러오지 못했습니다">
          잠시 후 다시 확인해 주세요.
        </Empty>
      ) : !items.length ? (
        <Empty title="신청한 과정이 없습니다">
          <Link href="/courses" className="text-teal-800 underline">
            교육과정 살펴보기
          </Link>
        </Empty>
      ) : (
        <div className="space-y-4">
          {items.map((a) => {
            const o = offerings.find((o) => o.id === a.offering_id);
            return (
              <article
                key={a.id}
                className="panel flex flex-wrap items-start justify-between gap-6"
              >
                <div>
                  <span className="badge">{statusLabel[a.status]}</span>
                  <h2 className="mt-3 text-xl font-semibold">
                    {o?.name ?? "교육과정"}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    신청일 {dateTime(a.submitted_at)}
                  </p>
                </div>
                <div className="space-y-3">
                  {a.status === "PENDING_PAYMENT" && (
                    <Link className="btn-primary block" href="/mypage/payments">
                      납부 안내·입금 신고 →
                    </Link>
                  )}
                  {a.status === "ACCEPTED" && (
                    <Link
                      className="btn-primary block"
                      href={`/learning/${a.offering_id}`}
                    >
                      강의실 입장 →
                    </Link>
                  )}
                  {[
                    "SUBMITTED",
                    "WAITLISTED",
                    "PENDING_PAYMENT",
                    "ACCEPTED",
                  ].includes(a.status) && (
                    <ActionForm action={decideApplication} label="신청 취소">
                      <input type="hidden" name="application" value={a.id} />
                      <input type="hidden" name="decision" value="CANCELLED" />
                    </ActionForm>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
