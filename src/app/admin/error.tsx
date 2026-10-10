"use client";

import Link from "next/link";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <div className="page-shell">
      <section role="alert" aria-labelledby="admin-load-error" className="rounded-2xl border border-amber-200 bg-amber-50 p-10 text-center">
        <h2 id="admin-load-error" className="text-lg font-semibold text-amber-950">관리 화면을 불러오지 못했습니다</h2>
        <p className="mt-2 text-sm leading-7 text-amber-900">잠시 후 다시 시도해 주세요. 문제가 계속되면 계정 관리 담당자에게 문의해 주세요.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="btn-secondary">다시 시도</button>
          <Link href="/admin" className="btn-secondary">사업단 업무 홈</Link>
        </div>
      </section>
    </div>
  );
}
