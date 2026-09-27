import Link from "next/link";
export const metadata = {
  title: "비밀번호 변경 안내 · U-LiVE",
  robots: { index: false, follow: false },
};
export default function PasswordUpdated() {
  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <div className="panel space-y-5">
        <h1 className="page-title">새 비밀번호로 로그인해 주세요</h1>
        <p className="text-base">
          비밀번호 변경을 마쳤다면 이전 로그인은 종료됩니다. 학습 이력은 그대로
          유지됩니다.
        </p>
        <Link href="/auth/login" className="btn-primary w-full text-base">
          로그인하기
        </Link>
      </div>
    </div>
  );
}
