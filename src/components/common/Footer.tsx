import Link from "next/link";

const FOOTER_LINK_CLASS =
  "rounded-sm underline-offset-4 hover:underline focus-visible:outline-white";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-[#105e59] bg-[#105e59] text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-6 px-5 py-10 text-sm">
        <div>
          <p className="font-semibold">U-LIFE · 울산과학대학교 앵커사업단</p>
          <p className="mt-2 text-teal-50">
            지역과 함께 성장하는 평생직업교육
          </p>
        </div>
        <nav className="flex flex-wrap gap-5" aria-label="서비스 안내">
          <Link className={FOOTER_LINK_CLASS} href="/privacy">개인정보처리방침</Link>
          <Link className={FOOTER_LINK_CLASS} href="/terms">수강안내</Link>
          <Link className={FOOTER_LINK_CLASS} href="/verify">증명서 진위확인</Link>
        </nav>
      </div>
    </footer>
  );
}
