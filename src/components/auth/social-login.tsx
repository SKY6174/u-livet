"use client";
import { useActionState, useState, type ReactNode } from "react";
import { ChevronDown, Mail } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { loginWithSocial } from "@/app/auth/social-actions";
import type { LoginAudience } from "@/lib/auth/login-audience";
import type { SocialProvider } from "@/lib/auth/social-providers";

const providers = {
  kakao: { label: "카카오", color: "bg-[#FEE500] text-black/[.85]", icon: "kakao-login.png", width: 244, height: 60, offset: 16 },
  naver: { label: "네이버", color: "bg-[#03A94D] text-white", icon: "naver-icon.png", width: 72, height: 72, offset: 22 },
  google: { label: "구글", color: "border border-[#8E918F] bg-[#131314] text-[#E3E3E3]", icon: "google-icon.png", width: 48, height: 48, offset: 10 },
};

function ProviderLogo({ provider }: { provider: SocialProvider }) {
  const { icon, width, height, offset } = providers[provider];
  return (
    // Show the symbol from the unmodified official asset, preserving its proportions.
    <span aria-hidden="true" className="relative block h-7 w-7 shrink-0 overflow-hidden">
      <Image src={`/images/auth/${icon}`} alt="" width={width} height={height} unoptimized
        className="absolute max-w-none" style={{ left: -offset, top: -offset }} />
    </span>
  );
}
export function SocialLogin({ next, audience, options, emailForm }: {
  next: string;
  audience: LoginAudience;
  options: { id: SocialProvider; enabled: boolean }[];
  emailForm?: ReactNode;
}) {
  const [state, action, pending] = useActionState(loginWithSocial, { message: "" });
  const [emailOpen, setEmailOpen] = useState(false);
  return (
    <div className="mb-7 space-y-3">
      <p className="text-base font-semibold">간편 로그인</p>
      <form action={action} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="audience" value={audience} />
        {options.map(({ id, enabled }) => (
          <button key={id} type="submit" name="provider" value={id} disabled={pending || !enabled}
            className={`flex min-h-16 w-full flex-wrap items-center justify-center gap-2 rounded-xl px-4 py-3 text-xl font-bold transition-shadow enabled:hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700 disabled:cursor-not-allowed ${providers[id].color}`}>
            <span className="inline-flex items-center gap-2 whitespace-nowrap text-xl font-bold">
              <ProviderLogo provider={id} />
              <span>{providers[id].label} 로그인</span>
            </span>
            {!enabled && <span className="rounded bg-white/90 px-2 py-1 text-sm font-semibold text-slate-700">준비 중</span>}
          </button>
        ))}
      </form>
      {pending && <p role="status" className="text-base">로그인 서비스로 이동하고 있습니다…</p>}
      {state.message && <p role="alert" className="text-base text-red-700">{state.message}</p>}
      <p className="text-sm leading-6 text-slate-600">
        {audience === "external"
          ? "승인된 교외 강사 계정으로 로그인해 주세요. 처음 가입하시면 기본 회원으로 등록되며, 강사 이력 제출과 사업단의 자격 확인 후 강사 업무를 이용할 수 있습니다."
          : "처음 가입하는 학습자에게는 카카오·네이버·구글 간편 로그인을 권장합니다. 로그인 후 이름·휴대폰 번호와 개인정보 동의를 확인합니다. 이미 계정 설정 메일을 받았다면 메일의 링크로 기존 계정을 먼저 설정해 주세요."}
      </p>
      {audience === "external" && <p className="text-sm leading-6 text-slate-600">기존 강사 계정과 간편 로그인 계정의 이메일이 다르면 별도 계정으로 등록될 수 있습니다. 기존 이력이 보이지 않으면 사업단에 문의해 주세요.</p>}
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 pt-1">
        <Link href="/privacy" className="flex min-h-11 items-center text-sm underline">개인정보 처리 안내 먼저 보기</Link>
        {emailForm && <button type="button" aria-expanded={emailOpen} aria-controls="email-login-form"
          onClick={() => setEmailOpen(open => !open)}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-900 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700">
          <Mail aria-hidden="true" className="h-4 w-4 shrink-0" />
          이메일로 로그인
          <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform ${emailOpen ? "rotate-180" : ""}`} />
        </button>}
      </div>
      {emailForm && emailOpen && <div id="email-login-form" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">{emailForm}</div>}
      {!emailForm && <div className="flex items-center gap-3 pt-2 text-sm text-slate-500"><span className="h-px flex-1 bg-slate-200" />또는 이메일로 이용<span className="h-px flex-1 bg-slate-200" /></div>}
    </div>
  );
}
