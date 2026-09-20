"use client";
import { useActionState } from "react";
import Link from "next/link";
import { loginWithSocial } from "@/app/auth/social-actions";
import type { LoginAudience } from "@/lib/auth/login-audience";
import type { SocialProvider } from "@/lib/auth/social-providers";

const providers = {
  kakao: { label: "카카오", color: "bg-[#FEE500] text-black/[.85]" },
  naver: { label: "네이버", color: "bg-[#03C75A] text-black" },
  google: { label: "구글", color: "border border-slate-300 bg-white text-slate-900" },
};
export function SocialLogin({ next, audience, options }: {
  next: string;
  audience: LoginAudience;
  options: { id: SocialProvider; enabled: boolean }[];
}) {
  const [state, action, pending] = useActionState(loginWithSocial, { message: "" });
  return (
    <div className="mb-7 space-y-3">
      <p className="text-base font-semibold">간편 로그인</p>
      <form action={action} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="audience" value={audience} />
        {options.map(({ id, enabled }) => (
          <button key={id} type="submit" name="provider" value={id} disabled={pending || !enabled}
            className={`flex min-h-14 w-full items-center justify-center gap-3 rounded-xl px-5 py-4 text-lg font-semibold disabled:cursor-not-allowed ${providers[id].color}`}>
            {providers[id].label} 로그인{!enabled && <span className="rounded bg-white/70 px-2 py-1 text-sm text-slate-700">준비 중</span>}
          </button>
        ))}
      </form>
      {pending && <p role="status" className="text-base">로그인 서비스로 이동하고 있습니다…</p>}
      {state.message && <p role="alert" className="text-base text-red-700">{state.message}</p>}
      <p className="text-sm leading-6 text-slate-600">
        {audience === "external"
          ? "승인된 교외 강사 계정으로 로그인해 주세요. 처음 가입하시면 기본 회원으로 등록되며, 강사 이력 제출과 사업단의 자격 확인 후 강사 업무를 이용할 수 있습니다."
          : "처음 이용하시면 로그인 후 이름·휴대폰 번호와 개인정보 동의를 확인합니다."}
      </p>
      {audience === "external" && <p className="text-sm leading-6 text-slate-600">기존 강사 계정과 간편 로그인 계정의 이메일이 다르면 별도 계정으로 등록될 수 있습니다. 기존 이력이 보이지 않으면 사업단에 문의해 주세요.</p>}
      <Link href="/privacy" className="flex min-h-11 items-center text-sm underline">개인정보 처리 안내 먼저 보기</Link>
      <div className="flex items-center gap-3 pt-2 text-sm text-slate-500"><span className="h-px flex-1 bg-slate-200" />또는 이메일로 이용<span className="h-px flex-1 bg-slate-200" /></div>
    </div>
  );
}
