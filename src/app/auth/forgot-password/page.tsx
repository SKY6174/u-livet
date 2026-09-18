import Link from "next/link";
import { ActionForm } from "@/components/portal/action-form";
import { requestPasswordReset } from "../recovery-actions";
import { getBotProtection } from "@/lib/auth/bot-config";
import { isReviewOnly } from "@/lib/deployment/review-mode";
import { authEmailEnabled, AUTH_EMAIL_PENDING } from "@/lib/auth/email-config";

export const metadata = {
  title: "비밀번호 찾기 · U-LIFE",
  robots: { index: false, follow: false },
};
export default function ForgotPassword() {
  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <h1 className="page-title">비밀번호를 잊으셨나요?</h1>
      {!authEmailEnabled() && <p role="status" className="notice mb-6">{AUTH_EMAIL_PENDING}</p>}
      <p className="mb-6 text-base text-slate-600">
        가입한 이메일로 새 비밀번호를 만드는 방법을 보내드립니다.
      </p>
      <ol
        aria-label="비밀번호 재설정 순서"
        className="mb-6 space-y-2 text-base"
      >
        <li>1. 아래에 이메일을 입력합니다.</li>
        <li>2. 받은 메일에서 ‘새 비밀번호 만들기’를 누릅니다.</li>
        <li>3. 새 비밀번호를 만든 뒤 로그인합니다.</li>
      </ol>
      <div className="panel space-y-5 [&_button[type=submit]]:w-full [&_button[type=submit]]:text-base">
        <ActionForm
          action={requestPasswordReset}
          label="재설정 메일 받기"
          disabled={isReviewOnly() || !authEmailEnabled()}
          botProtection={isReviewOnly() ? undefined : getBotProtection()}
          resetOnSuccess={false}
        >
          <label className="field text-base">
            이메일 (아이디)
            <input
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              required
            />
          </label>
        </ActionForm>
        <p className="text-base text-slate-600">
          메일을 받은 뒤 15분 안에 진행해 주세요. 등록한 이메일을 사용할 수
          없다면 사업단에 계정 복구를 문의해 주세요.
        </p>
        <Link
          className="flex min-h-11 items-center text-base underline"
          href="/auth/login"
        >
          로그인으로 이동
        </Link>
      </div>
    </div>
  );
}
