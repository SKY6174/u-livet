import { ConfirmEmailForm } from "@/components/auth/confirm-email-form";
import { isReviewOnly, REVIEW_MESSAGE } from "@/lib/deployment/review-mode";

export const metadata = {
  title: "이메일 확인 · U-LiVET",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ConfirmEmail() {
  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <h1 className="page-title">이메일 확인</h1>
      <p className="mb-6 text-base text-slate-600">
        가입에 사용한 이메일 주소를 확인하면 로그인할 수 있습니다.
      </p>
      <div className="panel">
        {isReviewOnly() ? (
          <p role="status">{REVIEW_MESSAGE}</p>
        ) : (
          <ConfirmEmailForm />
        )}
      </div>
    </div>
  );
}
