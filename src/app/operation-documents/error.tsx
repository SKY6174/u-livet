"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="page-shell">
      <h1 className="text-xl font-bold">운영 문서를 불러오지 못했습니다</h1>
      <p className="my-4">로그인·추가 인증 상태와 연결을 확인해 주세요.</p>
      <button className="btn-primary" onClick={reset}>
        다시 시도
      </button>
    </div>
  );
}
