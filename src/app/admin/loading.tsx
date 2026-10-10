export default function AdminLoading() {
  return (
    <div className="page-shell">
      <div role="status" aria-live="polite" className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <h2 className="text-lg font-semibold">사업단 관리 화면을 불러오는 중입니다</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">로그인 상태와 업무 권한, 관리 현황을 확인하고 있습니다.</p>
      </div>
    </div>
  );
}
