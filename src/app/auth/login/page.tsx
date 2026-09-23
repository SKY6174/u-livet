import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getSessionIdentity, safeReturnTo } from "@/lib/auth/session";
import { socialReturnTo, socialLoginError, qrCheckinReturnTo } from "@/lib/auth/registration";
import { LOGIN_AUDIENCES, loginAudience } from "@/lib/auth/login-audience";
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function Login(props: {
  searchParams: Promise<{ next?: string; social_error?: string; audience?: string }>;
}) {
  const searchParams = await props.searchParams;
  const next = safeReturnTo(searchParams.next);
  const qrCheckin = qrCheckinReturnTo(next);
  const audience = qrCheckin ? "learner" : loginAudience(searchParams.audience)
    ?? (["email-verification", "callback", "cancelled"].includes(searchParams.social_error ?? "") ? "learner" : null);
  if (await getSessionIdentity()) redirect(socialReturnTo(next));
  return (
    <div className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
      <p className="eyebrow">U-LIFE ACCOUNT</p>
      <h1 className="page-title">{qrCheckin ? "QR 출석 간편 로그인" : "로그인"}</h1>
      <p className="mb-7 text-base leading-7 text-slate-600">{qrCheckin ? "수강 신청한 계정으로 로그인하면 입실 확인 화면으로 바로 연결됩니다." : "이용하실 대상을 선택해 주세요."}</p>
      {!qrCheckin && <nav aria-label="로그인 대상 선택" className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {LOGIN_AUDIENCES.map(item => (
          <Link key={item.id} href={`/auth/login?audience=${item.id}&next=${encodeURIComponent(next)}`}
            aria-current={audience === item.id ? "page" : undefined}
            className={`flex min-h-24 flex-col justify-center rounded-xl border-2 px-2 py-4 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700 ${audience === item.id ? "border-teal-800 bg-teal-800 text-white" : "border-slate-200 bg-white text-slate-800 hover:border-teal-600"}`}>
            <span className="whitespace-nowrap text-base font-bold min-[360px]:text-lg">{item.label}</span>
            <span className={`mt-2 text-xs leading-5 ${audience === item.id ? "text-teal-50" : "text-slate-600"}`}>{item.description}</span>
          </Link>
        ))}
      </nav>}
        {socialLoginError(searchParams.social_error) && <p role="alert" className="mb-6 rounded-xl bg-amber-50 p-4 text-base leading-7 text-amber-900">{socialLoginError(searchParams.social_error)}</p>}
      {audience && <section className="panel" aria-labelledby="login-form-title">
        <h2 id="login-form-title" className="mb-6 text-xl font-bold">{LOGIN_AUDIENCES.find(item => item.id === audience)?.label} 로그인</h2>
        <AuthForm key={audience} next={next} audience={audience} />
      </section>}
    </div>
  );
}
