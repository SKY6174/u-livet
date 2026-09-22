import Image from "next/image";
import Link from "next/link";
import { SupportContact } from "./support-contact";
import anchorFooterLogo from "../../../public/images/anchor-footer-white.png";

const FOOTER_LINK_CLASS =
  "rounded-sm underline-offset-4 hover:underline focus-visible:outline-white";

export default function Footer() {
  return (
    <footer className="isolate mt-16 border-t border-[#105e59] bg-[#105e59] text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 text-sm lg:grid-cols-2 lg:items-center">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center sm:gap-8 lg:flex-col lg:items-start xl:flex-row xl:items-center">
          <div className="relative w-60 max-w-full shrink-0">
            <Image
              src={anchorFooterLogo}
              alt="ANCHOR"
              sizes="240px"
              className="h-auto w-full mix-blend-screen"
            />
            {/* Match the source slogan's bounds; keep the anchor artwork visible. */}
            <p className="absolute left-0 top-[64.8%] flex h-[17%] w-[61%] items-center whitespace-nowrap bg-[#105e59] pl-[2.1%] text-[10px] font-extrabold leading-none text-white">
              지역과 함께하는 든든한 전문대학
            </p>
          </div>
          <div>
            <p className="text-base font-semibold sm:text-lg">
              울산과학대학교 앵커사업단
            </p>
            <p className="mt-2 text-base leading-relaxed text-teal-50">
              <strong className="font-semibold text-white">U-LIFE</strong>
              <span className="mx-2" aria-hidden="true">|</span>
              <span className="inline-block">함께 성장하는 평생직업교육</span>
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-col items-start gap-5 lg:justify-self-end">
          <nav className="flex flex-wrap gap-x-5 gap-y-3" aria-label="서비스 안내">
            <Link className={FOOTER_LINK_CLASS} href="/privacy">개인정보처리방침</Link>
            <Link className={FOOTER_LINK_CLASS} href="/terms">수강안내</Link>
            <Link className={FOOTER_LINK_CLASS} href="/verify">증명서 진위확인</Link>
          </nav>
          <SupportContact compact className="text-teal-50 [&_a:focus-visible]:outline-white" />
        </div>
      </div>
    </footer>
  );
}
