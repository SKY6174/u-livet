import Link from "next/link";

export const metadata = {
  title: "계정 설정 안내 · U-LIFE",
  robots: { index: false, follow: false },
};

export default function InvitationAccepted() {
  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <div className="panel space-y-5">
        <h1 className="page-title">새 비밀번호로 로그인해 주세요</h1>
        <p className="text-base">
          비밀번호 설정을 마쳤다면 초대받은 이메일과 새 비밀번호로 로그인할 수
          있습니다.
        </p>
        <p className="text-base">
          관리자 업무를 맡으셨다면 로그인 후 ‘계정 보안’에서 인증 앱을 연결해
          주세요. 업무 권한은 사업단에서 확인한 뒤 부여합니다.
        </p>
        <Link
          href="/auth/login?next=%2Fauth%2Fsecurity"
          className="btn-primary w-full text-base"
        >
          로그인하고 계정 보안 확인하기
        </Link>
      </div>
    </div>
  );
}
