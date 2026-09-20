import Link from "next/link";
import { ActionForm } from "@/components/portal/action-form";
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
  next = "/mypage",
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
        label={signup ? "가입 신청" : "로그인"}
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
        {signup && policy && (
          <div className="space-y-3">
            <section
              aria-labelledby="signup-privacy-title"
              className="rounded-lg border p-4"
            >
              <h2 id="signup-privacy-title" className="text-lg font-semibold">
                {policy.title} · {policy.version}
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                수집 목적·항목·보유기간과 동의를 거부할 때의 제한을 읽고 선택해
                주세요.
              </p>
              <p className="mt-4 whitespace-pre-wrap break-words text-base leading-7">
                {policy.body}
              </p>
            </section>
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
        <p className="text-base text-slate-600">
          {signup
            ? "강사·관리자 권한은 사업단의 확인 후 부여됩니다."
            : "가입한 계정으로 로그인하면 승인된 역할에 맞는 메뉴가 표시됩니다."}
        </p>
        {(signup || audience === "learner" || audience === "external") && <Link
          className="flex min-h-11 items-center text-base underline"
          href={signup ? "/auth/login" : "/auth/signup"}
        >
          {signup ? "로그인으로 이동" : "처음이신가요? 회원가입"}
        </Link>}
      </ActionForm>
  );
  return (
    <div className="[&_button[type=submit]]:w-full [&_button[type=submit]]:text-base">
      {showSocialLogin && <SocialLogin next={next} audience={audience} options={socialProviderOptions()}
        emailForm={collapsibleEmail ? emailForm : undefined} />}
      {audience === "internal" && <div className="mb-6 rounded-xl bg-teal-50 p-5 text-base leading-7">
        <p className="font-semibold">학교 이메일(@uc.ac.kr)로 이용해 주세요.</p>
        <p className="mt-2">학교 포털 비밀번호와 별개인 U-LIFE 전용 비밀번호가 필요합니다. 처음 이용하시면 사업단의 교내 강사 등록·초대 후, 이메일의 안내에 따라 비밀번호를 설정해 주세요.</p>
        <Link href="/auth/forgot-password" className="mt-3 flex min-h-11 items-center font-semibold underline">초대받은 계정의 비밀번호 설정·재설정</Link>
        <p className="mt-2 text-sm">계정 등록 문의: 앵커사업단 052-230-0410</p>
      </div>}
      {audience === "office" && <p className="mb-6 rounded-xl bg-teal-50 p-5 text-base leading-7">등록된 사업단 이메일로 로그인하세요. 단장·센터장·연구원 직책과 업무 권한은 로그인 후 계정 정보에 따라 자동으로 표시됩니다.</p>}
      {!collapsibleEmail && emailForm}
    </div>
  );
}
