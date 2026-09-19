"use client";
import { useActionState } from "react";
import Link from "next/link";
import { loginWithKakao } from "@/app/auth/social-actions";
export function KakaoLogin({ next = "/mypage" }: { next?: string }) {
  const [state, action, pending] = useActionState(loginWithKakao, { message: "" });
  return (
    <div className="mb-7 space-y-3">
      <p className="text-base font-semibold">수강생 간편 로그인·회원가입</p>
      <form action={action}>
        <input type="hidden" name="next" value={next} />
        <button type="submit" disabled={pending} className="flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#FEE500] px-5 py-4 text-lg font-semibold text-black/[.85] disabled:opacity-60">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="#000000"><path d="M12 3C5.925 3 1 6.817 1 11.525c0 3.05 2.06 5.725 5.156 7.231-.168.577-1.08 3.715-1.116 3.961 0 0-.022.186.099.258.12.071.263.016.263.016.347-.049 4.027-2.634 4.664-3.083.627.088 1.273.137 1.934.137 6.075 0 11-3.817 11-8.52C23 6.817 18.075 3 12 3Z" /></svg>
          {pending ? "카카오로 이동 중…" : "카카오 로그인"}
        </button>
      </form>
      {state.message && <p role="alert" className="text-base text-red-700">{state.message}</p>}
      <p className="text-sm leading-6 text-slate-600">처음 이용하시면 카카오 로그인 후 이름·휴대폰 번호와 개인정보 동의를 확인합니다. 강사·운영자·관리자는 아래 이메일 로그인을 이용해 주세요.</p>
      <Link href="/privacy" className="flex min-h-11 items-center text-sm underline">개인정보 처리 안내 먼저 보기</Link>
      <div className="flex items-center gap-3 pt-2 text-sm text-slate-500"><span className="h-px flex-1 bg-slate-200" />또는 이메일로 이용<span className="h-px flex-1 bg-slate-200" /></div>
    </div>
  );
}
