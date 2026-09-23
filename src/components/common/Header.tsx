"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronRight, Menu, X } from "lucide-react";
import { useRole } from "@/lib/auth/roleContext";
import { signOut } from "@/app/auth/actions";
import {
  isOfficeMember,
  memberLabel,
  officeActiveHref,
  officeSections,
  primaryLinks,
  primaryActive,
} from "@/lib/auth/workspace-navigation";

const OFFICE_HOME_LINK = {
  label: "업무 홈",
  href: "/admin",
  description: "사업단 운영 현황과 주요 업무를 확인합니다.",
};

const primaryLinkClass = (active: boolean) =>
  `inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors ${
    active
      ? "bg-teal-50 font-bold text-teal-900 ring-1 ring-teal-200"
      : "text-slate-800 hover:bg-teal-50 hover:text-teal-900"
  }`;

const submenuLinkClass = (active: boolean) =>
  `flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
    active
      ? "bg-teal-50 text-teal-900"
      : "text-slate-700 hover:bg-slate-50 hover:text-teal-900"
  }`;

export default function Header() {
  const identity = useRole();
  const pathname = usePathname();
  const isLoginPage = pathname === "/auth/login";
  const [open, setOpen] = useState(false);
  const [openAdminMenu, setOpenAdminMenu] = useState(false);
  const [openMobileAdminMenu, setOpenMobileAdminMenu] = useState(false);
  const [previewHref, setPreviewHref] = useState<string | null>(null);
  const adminSubmenuRef = useRef<HTMLDivElement>(null);
  const adminMenuToggleRef = useRef<HTMLButtonElement>(null);
  const closeAdminMenu = () => {
    if (adminSubmenuRef.current?.contains(document.activeElement)) {
      adminMenuToggleRef.current?.focus({ preventScroll: true });
    }
    setOpenAdminMenu(false);
  };
  const userLabel = identity ? (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="rounded-md bg-teal-50 px-2 py-1 text-sm font-semibold text-teal-800">
        {memberLabel(identity)}
      </span>
      <span>{identity.name} 님</span>
    </span>
  ) : null;
  const links = primaryLinks(identity, isLoginPage);
  const adminLinks = identity && isOfficeMember(identity)
    ? [OFFICE_HOME_LINK, ...officeSections(identity).flatMap((section) => section.links)]
    : [];
  const adminActive = primaryActive(pathname, "/admin");
  const activeAdminHref = adminActive ? officeActiveHref(pathname) : null;
  const previewLink = adminLinks.find((link) => link.href === previewHref)
    ?? adminLinks.find((link) => link.href === activeAdminHref)
    ?? OFFICE_HOME_LINK;

  const renderPrimaryLink = ({ label, href }: { label: string; href: string }) => {
    if (href !== "/admin" || adminLinks.length === 0) {
      const active = primaryActive(pathname, href);
      return (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={primaryLinkClass(active)}
        >
          {label}
        </Link>
      );
    }

    return (
      <div
        key={href}
        className="relative"
        onMouseEnter={() => {
          setPreviewHref(null);
          setOpenAdminMenu(true);
        }}
        onMouseLeave={(event) => {
          if (!event.currentTarget.contains(document.activeElement)) setOpenAdminMenu(false);
        }}
        onBlur={(event) => {
          if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) {
            setOpenAdminMenu(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            adminMenuToggleRef.current?.focus({ preventScroll: true });
            closeAdminMenu();
          }
        }}
      >
        <div className={`flex items-center rounded-lg ${adminActive ? "bg-teal-50 ring-1 ring-teal-200" : "hover:bg-teal-50"}`}>
          <Link
            href={href}
            aria-current={adminActive ? (pathname === href ? "page" : "true") : undefined}
            className={`inline-flex min-h-11 items-center rounded-lg pl-3 pr-1 text-sm font-semibold ${adminActive ? "text-teal-900" : "text-slate-800"}`}
            onFocus={() => {
              setPreviewHref(null);
              setOpenAdminMenu(true);
            }}
            onClick={closeAdminMenu}
          >
            {label}
          </Link>
          <button
            ref={adminMenuToggleRef}
            type="button"
            aria-label="사업단 관리 하위 메뉴"
            aria-expanded={openAdminMenu}
            aria-controls="desktop-admin-submenu"
            className="inline-flex min-h-11 w-8 items-center justify-center rounded-lg text-slate-600 hover:text-teal-900"
            onClick={() => openAdminMenu ? closeAdminMenu() : setOpenAdminMenu(true)}
          >
            <ChevronDown aria-hidden="true" className={`h-4 w-4 motion-safe:transition-transform ${openAdminMenu ? "rotate-180" : ""}`} />
          </button>
        </div>
        <div
          ref={adminSubmenuRef}
          id="desktop-admin-submenu"
          inert={!openAdminMenu}
          className={`absolute left-1/2 top-full z-50 w-[32rem] max-w-[calc(100vw-2.5rem)] -translate-x-1/2 pt-3 motion-safe:transition-[opacity,transform] motion-safe:duration-200 ${openAdminMenu ? "visible translate-y-0 opacity-100" : "invisible pointer-events-none translate-y-1 opacity-0"}`}
        >
          <div className="grid grid-cols-[13rem_minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_-15px_rgba(15,23,42,0.25)]">
            <div className="space-y-1 p-2">
              {adminLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  tabIndex={openAdminMenu ? 0 : -1}
                  aria-current={activeAdminHref === link.href ? "page" : undefined}
                  className={submenuLinkClass(previewLink.href === link.href)}
                  onMouseEnter={() => setPreviewHref(link.href)}
                  onFocus={() => setPreviewHref(link.href)}
                  onClick={closeAdminMenu}
                >
                  <span>{link.label}<span className="sr-only"> — {link.description}</span></span>
                  <ChevronRight aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 ${previewLink.href === link.href ? "opacity-100" : "opacity-0"}`} />
                </Link>
              ))}
            </div>
            <div aria-hidden="true" className="flex flex-col border-l border-teal-100/70 bg-gradient-to-br from-teal-50 to-slate-50 p-6">
              <span className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-teal-800 shadow-sm ring-1 ring-teal-100"><ArrowUpRight className="h-5 w-5" /></span>
              <p className="text-xs font-semibold text-teal-700">사업단 업무</p>
              <p className="mb-3 mt-2 text-xl font-bold tracking-tight text-slate-900">{previewLink.label}</p>
              <p className="text-sm leading-7 text-slate-600">{previewLink.description}</p>
              <span className="mt-auto pt-6 text-xs font-medium text-teal-700">U-LIFE · OFFICE WORKSPACE</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:block focus:p-3"
      >
        본문으로 바로가기
      </a>
      <div className="bg-uc-navy px-5 py-2 text-xs text-white">
        <div className="mx-auto max-w-7xl">
          울산과학대학교 앵커사업단 | 개방형 평생직업교육
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/ulsan-college-logo.png"
            alt="울산과학대학교"
            width={154}
            height={140}
            className="h-14 w-auto shrink-0"
            priority
          />
          <span>
            <strong className="block text-xl tracking-tight">U-LIFE</strong>
            <span className="block text-xs text-slate-500">
              배움에서 새로운 일로
            </span>
          </span>
        </Link>
        <nav aria-label="주 메뉴" className="hidden flex-wrap items-center justify-center gap-x-3 gap-y-3 lg:flex">
          {links.map(renderPrimaryLink)}
        </nav>
        <div className="hidden flex-wrap items-center justify-end gap-4 text-sm lg:flex">
          {identity ? (
            <>
              {userLabel}
              <form action={signOut}>
                <button className="text-slate-600 underline">로그아웃</button>
              </form>
            </>
          ) : !isLoginPage ? (
            <Link href="/auth/login" className="btn-primary">
              로그인
            </Link>
          ) : null}
        </div>
        <button
          className="rounded-lg border p-2 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
          onClick={() => {
            setOpen(!open);
            setOpenMobileAdminMenu(false);
          }}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav
          id="mobile-menu"
          aria-label="모바일 메뉴"
          className="grid max-h-[calc(100dvh-8rem)] gap-1 overflow-y-auto border-t p-4 lg:hidden"
        >
          {links.map(({ label, href }) => {
            if (href !== "/admin" || adminLinks.length === 0) {
              const active = primaryActive(pathname, href);
              return (
                <Link
                  onClick={() => setOpen(false)}
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-lg p-3 hover:bg-slate-50 ${active ? "bg-teal-50 font-bold text-teal-900" : ""}`}
                >
                  {label}
                </Link>
              );
            }
            return (
              <div key={href} className="rounded-lg border border-slate-200 bg-white">
                <div className={`flex items-center rounded-lg ${adminActive ? "bg-teal-50 font-bold text-teal-900" : "text-slate-800"}`}>
                  <Link href={href} className="flex min-h-12 flex-1 items-center rounded-lg px-3"
                    aria-current={adminActive ? (pathname === href ? "page" : "true") : undefined}
                    onClick={() => { setOpen(false); setOpenMobileAdminMenu(false); }}>
                    {label}
                  </Link>
                  <button
                    type="button"
                    aria-label="사업단 관리 하위 메뉴"
                    aria-expanded={openMobileAdminMenu}
                    aria-controls="mobile-admin-submenu"
                    className="flex min-h-12 w-12 items-center justify-center rounded-lg"
                    onClick={() => setOpenMobileAdminMenu((current) => !current)}
                  >
                    <ChevronDown aria-hidden="true" className={`h-5 w-5 motion-safe:transition-transform ${openMobileAdminMenu ? "rotate-180" : ""}`} />
                  </button>
                </div>
                {openMobileAdminMenu && (
                  <div id="mobile-admin-submenu" className="border-t border-slate-100 px-2 py-2">
                    {adminLinks.map((link) => {
                      const active = activeAdminHref === link.href;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          aria-current={active ? "page" : undefined}
                          className={submenuLinkClass(active)}
                          onClick={() => {
                            setOpenMobileAdminMenu(false);
                            setOpen(false);
                          }}
                        >
                          <span>{link.label}<span className="sr-only"> — {link.description}</span></span>
                          <ChevronRight aria-hidden="true" className="h-4 w-4 text-slate-400" />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {identity ? (
            <>
              <div className="px-3 pt-3 text-sm">{userLabel}</div>
              <form action={signOut}>
                <button className="p-3">로그아웃</button>
              </form>
            </>
          ) : !isLoginPage ? (
            <Link
              onClick={() => setOpen(false)}
              href="/auth/login"
              className="p-3"
            >
              로그인
            </Link>
          ) : null}
        </nav>
      )}
    </header>
  );
}
