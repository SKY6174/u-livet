import Link from "next/link";
import { ActionForm } from "@/components/portal/action-form";
import { authenticate, register } from "@/app/auth/actions";
import type { Policy } from "@/lib/portal/types";
import { PasswordField } from "./password-field";
import { getBotProtection } from "@/lib/auth/bot-config";
import { isReviewOnly } from "@/lib/deployment/review-mode";
export function AuthForm({
  signup = false,
  next = "/mypage",
  policy,
}: {
  signup?: boolean;
  next?: string;
  policy?: Policy;
}) {
  const reviewOnly = isReviewOnly();
  return (
    <div className="[&_button[type=submit]]:w-full [&_button[type=submit]]:text-base">
      <ActionForm
        action={signup ? register : authenticate}
        label={signup ? "가입 신청" : "로그인"}
        disabled={reviewOnly || (signup && !policy)}
        botProtection={reviewOnly ? undefined : getBotProtection()}
      >
        <input type="hidden" name="next" value={next} />
        {signup && (
          <label className="field text-base">
            이름
            <input name="name" autoComplete="name" maxLength={100} required />
          </label>
        )}
        <label className="field text-base">
          이메일 (아이디)
          <input
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="email"
            maxLength={254}
            required
          />
        </label>
        <p className="text-base text-slate-600">
          {signup
            ? "자주 확인하는 이메일을 입력해 주세요. 강사·관리자도 이메일을 아이디로 사용합니다."
            : "회원가입할 때 사용한 이메일을 입력해 주세요."}
        </p>
        <PasswordField signup={signup} />
        {!signup && (
          <Link
            className="flex min-h-11 items-center text-base font-semibold text-teal-900 underline"
            href="/auth/forgot-password"
          >
            비밀번호를 잊으셨나요?
          </Link>
        )}
        {signup &&
          (policy ? (
            <div className="space-y-3">
              <details className="rounded-lg border p-4">
                <summary>
                  {policy.title} · {policy.version}
                </summary>
                <p className="mt-3 whitespace-pre-wrap text-sm">
                  {policy.body}
                </p>
              </details>
              <input type="hidden" name="privacy_policy_id" value={policy.id} />
              <label className="flex min-h-11 items-start gap-3 py-2 text-base">
                <input
                  className="mt-1 h-5 w-5 shrink-0"
                  type="checkbox"
                  name="privacy_accepted"
                  required
                />
                <span>[필수] 위 개인정보 수집·이용에 동의합니다.</span>
              </label>
            </div>
          ) : (
            <p role="status" className="notice">
              회원가입 안내가 준비 중입니다. 가입이 열리면 개인정보 수집
              목적·항목·보유기간을 먼저 안내합니다.
            </p>
          ))}
        <p className="text-base text-slate-600">
          {signup
            ? "강사·관리자 권한은 사업단의 확인 후 부여됩니다."
            : "가입한 계정으로 로그인하면 승인된 역할에 맞는 메뉴가 표시됩니다."}
        </p>
        <Link
          className="flex min-h-11 items-center text-base underline"
          href={signup ? "/auth/login" : "/auth/signup"}
        >
          {signup ? "로그인으로 이동" : "처음이신가요? 회원가입"}
        </Link>
      </ActionForm>
    </div>
  );
}
