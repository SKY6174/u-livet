import { RecoveryForm } from "@/components/auth/recovery-form";
import { isReviewOnly, REVIEW_MESSAGE } from "@/lib/deployment/review-mode";

export const metadata = {
  title: "처음 비밀번호 설정하기 · U-LIFE",
  robots: { index: false, follow: false },
};

export default function AcceptInvitation() {
  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <h1 className="page-title">처음 비밀번호를 설정해 주세요</h1>
      <p className="mb-6 text-base text-slate-600">
        초대받은 이메일로 U-LIFE를 이용하기 위한 첫 단계입니다. 아래 조건을
        하나씩 확인하며 입력해 주세요.
      </p>
      <ol aria-label="계정 설정 순서" className="mb-6 space-y-2 text-base">
        <li>1. 사용할 비밀번호를 만듭니다.</li>
        <li>2. 초대받은 이메일과 새 비밀번호로 로그인합니다.</li>
        <li>
          3. 관리자 업무는 인증 앱 연결과 사업단의 권한 확인 후 이용합니다.
        </li>
      </ol>
      <div className="panel">
        {isReviewOnly() ? (
          <p role="status">{REVIEW_MESSAGE}</p>
        ) : (
          <RecoveryForm invitation />
        )}
      </div>
    </div>
  );
}
