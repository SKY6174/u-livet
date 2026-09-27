import Link from "next/link";
import { ActionForm } from "@/components/portal/action-form";
import { requestNaverSignupEmail, verifyNaverSignupEmail } from "@/app/auth/naver-signup-actions";

export function NaverSignupEmail({ next, pendingEmail }: { next: string; pendingEmail?: string }) {
  return <div className="space-y-7">
    <div>
      <h2 className="text-xl font-bold">가입에 사용할 이메일 확인</h2>
      <p className="mt-3 text-base leading-7 text-slate-600">네이버 인증이 완료되었습니다. U-LiVE에서 사용할 이메일을 입력해 주세요. 네이버 아이디의 메일 주소와 연락처 이메일은 다를 수 있습니다.</p>
      <p className="mt-2 text-base leading-7 text-slate-600">이메일 확인 후 이름·휴대폰 번호와 개인정보 동의를 입력하면 가입이 완료됩니다.</p>
    </div>
    <ActionForm action={requestNaverSignupEmail} label={pendingEmail ? "인증 메일 다시 받기" : "인증 메일 받기"} resetOnSuccess={false}>
      <input type="hidden" name="next" value={next} />
      <label className="field text-base">이메일 (필수)<input name="email" type="email" autoComplete="email" defaultValue={pendingEmail ?? ""} maxLength={254} required /></label>
      <p className="text-sm leading-6 text-slate-600">입력한 주소는 이메일 확인과 회원 계정에 사용합니다. <Link href="/privacy" className="underline" target="_blank" rel="noopener noreferrer">개인정보 처리 안내</Link></p>
    </ActionForm>
    {pendingEmail && <div className="border-t pt-6">
      <p className="mb-4 break-all text-base leading-7">{pendingEmail}로 받은 메일의 인증번호를 입력해 주세요. 메일이 없으면 스팸함도 확인해 주세요.</p>
      <ActionForm action={verifyNaverSignupEmail} label="이메일 확인하고 가입 계속" resetOnSuccess={false}>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="email" value={pendingEmail} />
        <label className="field text-base">인증번호<input name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required /></label>
      </ActionForm>
    </div>}
  </div>;
}
