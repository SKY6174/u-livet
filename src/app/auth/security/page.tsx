import Link from "next/link";
import { redirect } from "next/navigation";
import { getSecurityContext } from "@/lib/auth/mfa";
import { safeReturnTo } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MfaPanel } from "@/components/auth/mfa-panel";
import { signOut } from "@/app/auth/actions";
export const metadata = {
  title: "추가 인증 · U-LIFE",
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
      <h1 className="break-keep text-3xl font-bold">인증 앱으로 한 번 더 확인해요</h1>
      <p className="mt-4 break-all text-base text-slate-600">{context.email}</p>
      <p className="my-5 text-base leading-7">
        사업단 관리자 계정은 비밀번호를 입력한 뒤 인증 앱의 6자리 코드가
        필요합니다. 수강생·강사는 원할 때 설정할 수 있습니다.
      </p>
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
          factors={(data?.all ?? [])
            .filter((f) => f.factor_type === "totp")
            .map((f) => ({
              id: f.id,
              name: f.friendly_name?.startsWith("U-LIFE ")
                ? `인증 앱 · ${new Date(f.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                : f.friendly_name ?? "인증 앱",
              verified: f.status === "verified",
            }))}
        />
      )}
      <aside className="mt-8 rounded-xl bg-slate-100 p-5 text-base leading-7">
        <h2 className="font-bold">인증 앱을 사용할 수 없나요?</h2>
        <p className="mt-2">
          휴대전화를 잃어버렸거나 앱을 삭제했다면 사업단의 지정 지원 담당자에게
          계정 복구를 요청해 주세요. 본인 확인과 승인 후 다시 연결할 수
          있습니다. 이메일 비밀번호 재설정만으로는 추가 인증이 해제되지
          않습니다.
        </p>
        <p className="mt-2">
          한 기기 분실에 대비해 다른 기기의 인증 앱을 미리 추가할 수 있습니다.
        </p>
      </aside>
      <form action={signOut} className="mt-6">
        <button className="btn-secondary">로그아웃</button>
      </form>
    </div>
  );
}
