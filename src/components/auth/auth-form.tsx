import Link from "next/link";
import { ActionForm } from "@/components/portal/action-form";
import { SupportContact } from "@/components/common/support-contact";
import { authenticate, register } from "@/app/auth/actions";
import type { Policy } from "@/lib/portal/types";
import { PasswordField } from "./password-field";
import { PhoneField } from "./phone-field";
import { SocialLogin } from "./social-login";
import type { LoginAudience } from "@/lib/auth/login-audience";
import { socialProviderOptions } from "@/lib/auth/social-providers";
import { getBotProtection } from "@/lib/auth/bot-config";
import { isReviewOnly, REVIEW_MESSAGE } from "@/lib/deployment/review-mode";
import { authEmailEnabled, AUTH_EMAIL_PENDING } from "@/lib/auth/email-config";
import {
  publicSignupEnabled,
  PUBLIC_SIGNUP_PENDING,
} from "@/lib/auth/signup-config";
export function AuthForm({
  signup = false,
  next = "/",
  policy,
  audience = "learner",
}: {
  signup?: boolean;
  next?: string;
  policy?: Policy;
  audience?: LoginAudience;
}) {
  const reviewOnly = isReviewOnly();
  if (
    signup &&
    (reviewOnly || !publicSignupEnabled() || !policy || !authEmailEnabled())
  ) {
    return (
      <div className="space-y-5 text-base leading-7">
        <div role="status" className="rounded-xl bg-slate-50 p-5">
          <h2 className="mb-2 text-lg font-semibold">
            회원가입을 준비하고 있습니다
          </h2>
          <p>
            {reviewOnly
              ? REVIEW_MESSAGE
              : !publicSignupEnabled()
                ? PUBLIC_SIGNUP_PENDING
                : !policy
                  ? "개인정보 수집·이용 안내를 준비하고 있습니다. 안내가 확정되면 내용을 확인한 뒤 가입할 수 있습니다."
                  : AUTH_EMAIL_PENDING}
          </p>
          <p className="mt-3">
            지금은 이름이나 비밀번호를 입력하지 않아도 됩니다.
          </p>
        </div>
        <p>회원가입 전에도 공개 교육과정 안내를 볼 수 있습니다.</p>
        <Link href="/courses" className="btn-primary w-full text-base">
          교육과정 먼저 살펴보기
        </Link>
        <Link
          href="/auth/login"
          className="flex min-h-11 items-center text-base underline"
        >
          이미 계정이 있으신가요? 로그인
        </Link>
      </div>
    );
  }
  const showSocialLogin = !reviewOnly && (audience === "learner" || audience === "external");
  const collapsibleEmail = showSocialLogin && !signup;
  const emailForm = (
      <ActionForm
        action={signup ? register : authenticate}
        label={signup ? (audience === "office" || audience === "internal" ? "계정 활성화 신청" : "가입 신청") : "로그인"}
        disabled={reviewOnly}
        botProtection={reviewOnly ? undefined : getBotProtection()}
      >
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="audience" value={audience} />
        {signup && (
          <label className="field text-base">
            이름
            <input name="name" autoComplete="name" maxLength={100} required />
          </label>
        )}
        {signup && <PhoneField />}
        <label className="field text-base">
          {audience === "internal" ? "학교 이메일 (아이디)" : "이메일 (아이디)"}
          <input
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="email"
            maxLength={254}
            placeholder={audience === "internal" ? "name@uc.ac.kr" : undefined}
            required
          />
        </label>
        {signup && (
          <p className="text-base text-slate-600">
            자주 확인하는 이메일을 입력해 주세요. 강사·관리자도 이메일을 아이디로 사용합니다.
          </p>
        )}
        <PasswordField signup={signup} />
        {!signup && (
          <Link
            className="flex min-h-11 items-center text-base font-semibold text-teal-900 underline"
            href="/auth/forgot-password"
          >
            비밀번호를 잊으셨나요?
          </Link>
        )}
        {signup && policy && (
          <div className="space-y-3">
            <details className="rounded-lg border p-4">
              <summary className="min-h-11 cursor-pointer text-lg font-semibold leading-7">
                {policy.title} · {policy.version}
              </summary>
              <div className="pt-3">
                <p className="text-base leading-7 text-slate-600">
                  수집 목적·항목·보유기간과 동의를 거부할 때의 제한을 읽고 선택해
                  주세요.
                </p>
                <p className="mt-4 whitespace-pre-wrap break-words text-base leading-7">
                  {policy.body}
                </p>
              </div>
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
        )}
        {signup && (
          <p className="text-base text-slate-600">
            강사·관리자 권한은 사업단의 확인 후 부여됩니다.
          </p>
        )}
        {!signup && (audience === "office" || audience === "internal") ? (
          <div className="group relative flex w-fit max-w-full flex-wrap items-center gap-1">
            <Link
              className="flex min-h-11 items-center text-base underline"
              href={`/auth/signup?audience=${audience}`}
              aria-describedby="member-activation-help"
            >
              등록된 구성원 계정 활성화
            </Link>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
              aria-label="계정 활성화 안내"
              aria-describedby="member-activation-help"
            >
              <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full border border-teal-700 text-sm font-bold text-teal-900">?</span>
            </button>
            <span
              id="member-activation-help"
              role="tooltip"
              className="pointer-events-none invisible absolute bottom-full left-0 z-10 mb-2 w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-teal-200 bg-white p-4 text-sm leading-6 text-slate-700 shadow-lg after:absolute after:-bottom-2 after:right-14 after:h-4 after:w-4 after:rotate-45 after:border-b after:border-r after:border-teal-200 after:bg-white group-hover:visible group-focus-within:visible sm:left-auto sm:right-0 sm:after:right-4"
            >
              사업단에 미리 등록된 사업단 구성원·교내 강사가 등록 이메일을 인증하고 U-LiVE 전용 비밀번호를 설정하면 기존 구성원 정보와 계정이 연결됩니다.
            </span>
          </div>
        ) : (
          <Link
            className="flex min-h-11 items-center text-base underline"
            href={signup ? `/auth/login?audience=${audience}` : `/auth/signup?audience=${audience}`}
          >
            {signup ? "로그인으로 이동" : "처음이신가요? 회원가입"}
          </Link>
        )}
      </ActionForm>
  );
  return (
    <div className="[&_button[type=submit]]:w-full [&_button[type=submit]]:text-base">
      {showSocialLogin && <SocialLogin next={next} audience={audience} options={socialProviderOptions()}
        emailForm={collapsibleEmail ? emailForm : undefined} />}
      {!signup && audience === "internal" && <div className="mb-6 rounded-xl bg-teal-50 p-5 text-base leading-7">
        <p className="font-semibold">학교 이메일(@uc.ac.kr)로 이용해 주세요.</p>
        <p className="mt-2">학교 포털 비밀번호와 별개인 U-LiVE 전용 비밀번호가 필요합니다. 사업단에 수동 등록된 분은 아래 ‘등록된 구성원 계정 활성화’에서 학교 이메일 인증과 비밀번호 설정을 완료해 주세요. 초대받은 분은 초대 이메일의 안내를 이용해 주세요.</p>
        <Link href="/auth/forgot-password" className="mt-3 flex min-h-11 items-center font-semibold underline">초대받은 계정의 비밀번호 설정·재설정</Link>
        <SupportContact className="mt-2" />
      </div>}
      {!collapsibleEmail && emailForm}
    </div>
  );
}
