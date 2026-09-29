import { RecoveryForm } from "@/components/auth/recovery-form";
import { isReviewOnly, REVIEW_MESSAGE } from "@/lib/deployment/review-mode";
import { getPolicies, UUID } from "@/lib/portal/data";

export const metadata = {
  title: "처음 비밀번호 설정하기 · U-LiVET",
  robots: { index: false, follow: false },
};

export default async function AcceptInvitation({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const org = (await searchParams).org;
  const policy = org && UUID.test(org)
    ? (await getPolicies("ACCOUNT_PRIVACY")).find((item) => item.org_id === org)
    : undefined;
  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <h1 className="page-title">처음 비밀번호를 설정해 주세요</h1>
      <p className="mb-6 text-base text-slate-600">
        초대받은 이메일로 U-LiVET을 이용하기 위한 첫 단계입니다. 아래 조건을
        하나씩 확인하며 입력해 주세요.
      </p>
      <ol aria-label="계정 설정 순서" className="mb-6 space-y-2 text-base">
        <li>1. 개인정보 처리 안내를 확인하고 비밀번호를 만듭니다.</li>
        <li>2. 초대받은 이메일과 새 비밀번호로 로그인합니다.</li>
        <li>
          3. 로그인 후 사업단에서 부여한 업무 권한을 확인합니다.
        </li>
      </ol>
      <div className="panel">
        {isReviewOnly() ? (
          <p role="status">{REVIEW_MESSAGE}</p>
        ) : org && !policy ? (
          <p role="alert">이 사업단의 개인정보 처리 안내를 확인할 수 없습니다. 사업단에 새 계정 설정 메일을 요청해 주세요.</p>
        ) : (
          <RecoveryForm invitation policy={policy} />
        )}
      </div>
    </div>
  );
}
