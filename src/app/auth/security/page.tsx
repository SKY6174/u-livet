import Link from "next/link";
import { SupportContact } from "@/components/common/support-contact";
import { redirect } from "next/navigation";
import { getSecurityContext } from "@/lib/auth/mfa";
import { formatMfaFactors } from "@/lib/auth/mfa-factor";
import { safeReturnTo } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MfaPanel } from "@/components/auth/mfa-panel";
import { signOut } from "@/app/auth/actions";
export const metadata = {
  title: "추가인증(2중 인증) · U-LiVE",
  robots: { index: false, follow: false },
};
export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const returnToWork = typeof params.next === "string" && params.next.length > 0;
  const rawNext = safeReturnTo(params.next);
  const next = rawNext.startsWith("/auth") ? "/" : rawNext;
  const context = await getSecurityContext();
  if (!context)
    redirect(
      `/auth/login?next=${encodeURIComponent("/auth/security?next=" + encodeURIComponent(next))}`,
    );
  if (
    returnToWork &&
    !context.status.needs_reset &&
    context.status.mfa_verified &&
    context.status.recent
  )
    redirect(next);
  const { data, error } = await (
    await createServerSupabaseClient()
  ).auth.mfa.listFactors();
  return (
    <div className="page-shell max-w-2xl">
      <h1 className="break-keep text-3xl font-bold">추가인증(2중 인증)</h1>
      <p className="mb-2 mt-4 break-all text-right text-base text-slate-600">{context.email}</p>
      {context.status.needs_reset ? (
        <div className="panel">
          <p>새 보안 기준에 맞게 비밀번호를 먼저 설정해 주세요.</p>
          <Link className="btn-primary mt-4" href="/auth/forgot-password">
            비밀번호 재설정
          </Link>
        </div>
      ) : error ? (
        <p role="alert">
          인증 앱 목록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.
        </p>
      ) : (
        <MfaPanel
          status={context.status}
          next={next}
          returnToWork={returnToWork}
          factors={formatMfaFactors(data?.all ?? [])}
        />
      )}
      <details className="mt-8 rounded-xl bg-slate-100 text-base leading-7">
        <summary className="cursor-pointer rounded-xl p-5 font-bold">
          인증 앱을 사용할 수 없나요?
        </summary>
        <div className="px-5 pb-5">
          <p>
            휴대전화를 잃어버렸거나 앱을 삭제했다면 사업단의 지정 지원 담당자에게
            계정 복구를 요청해 주세요. 본인 확인과 승인 후 다시 연결할 수
            있습니다. 이메일 비밀번호 재설정만으로는 추가 인증이 해제되지
            않습니다.
          </p>
          <p className="mt-2">
            한 기기 분실에 대비해 다른 기기의 인증 앱을 미리 추가할 수 있습니다.
          </p>
          <SupportContact className="mt-3 text-teal-900" />
        </div>
      </details>
      <form action={signOut} className="mt-6">
        <button className="btn-secondary">로그아웃</button>
      </form>
    </div>
  );
}
