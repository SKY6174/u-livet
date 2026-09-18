import Link from "next/link";
export default function NotFound() {
  return (
    <div className="page-shell text-center">
      <p className="eyebrow">404</p>
      <h1 className="page-title">페이지를 찾을 수 없습니다</h1>
      <p className="mb-8 text-slate-600">
        주소가 변경되었거나 이 페이지를 이용할 권한이 없습니다.
      </p>
      <Link className="btn-primary" href="/">
        홈으로 이동
      </Link>
    </div>
  );
}
