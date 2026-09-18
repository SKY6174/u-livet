import Link from "next/link";
export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-6 px-5 py-10 text-sm">
        <div>
          <p className="font-semibold">U-LIFE · 울산과학대학교 앵커사업단</p>
          <p className="mt-2 text-slate-500">
            지역과 함께 성장하는 평생직업교육
          </p>
        </div>
        <nav className="flex flex-wrap gap-5" aria-label="서비스 안내">
          <Link href="/privacy">개인정보처리방침</Link>
          <Link href="/terms">수강안내</Link>
          <Link href="/verify">증명서 진위확인</Link>
        </nav>
      </div>
    </footer>
  );
}
