import { RecoveryForm } from "@/components/auth/recovery-form";
import { isReviewOnly, REVIEW_MESSAGE } from "@/lib/deployment/review-mode";
import { getMemberActivationPolicy } from "@/lib/auth/social";
export const metadata = {
  title: "새 비밀번호 만들기 · U-LiVET",
  robots: { index: false, follow: false },
};
export default async function ResetPassword() {
  const policy = await getMemberActivationPolicy();
  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <h1 className="page-title">새 비밀번호 만들기</h1>
      <p className="mb-6 text-base text-slate-600">
        아래 조건을 하나씩 확인하며 입력해 주세요.
      </p>
      <div className="panel">
        {isReviewOnly() ? <p role="status">{REVIEW_MESSAGE}</p> : <RecoveryForm policy={policy} />}
      </div>
    </div>
  );
}
