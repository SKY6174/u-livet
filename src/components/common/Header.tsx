"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { useRole } from "@/lib/auth/roleContext";
import { signOut } from "@/app/auth/actions";
import {
  isOfficeMember,
  memberLabel,
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
  `block rounded-lg px-3 py-2.5 transition-colors ${
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
  const adminMenuRef = useRef<HTMLDivElement>(null);
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
        ref={adminMenuRef}
        className="relative"
        onMouseEnter={() => setOpenAdminMenu(true)}
        onMouseLeave={() => setOpenAdminMenu(false)}
        onFocus={() => setOpenAdminMenu(true)}
        onBlur={(event) => {
          if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) {
            setOpenAdminMenu(false);
          }
        }}
      >
        <button
          type="button"
          aria-current={adminActive ? "page" : undefined}
          aria-expanded={openAdminMenu}
          aria-controls="desktop-admin-submenu"
          className={primaryLinkClass(adminActive)}
          onClick={() => setOpenAdminMenu((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpenAdminMenu(false);
              adminMenuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
            }
          }}
        >
          {label}
          <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${openAdminMenu ? "rotate-180" : ""}`} />
        </button>
        <div
          id="desktop-admin-submenu"
          aria-hidden={!openAdminMenu}
          className={`absolute left-1/2 top-full z-50 w-72 -translate-x-1/2 pt-3 transition ${openAdminMenu ? "visible opacity-100" : "invisible pointer-events-none opacity-0"}`}
        >
          <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-slate-900/5">
            <p className="px-3 pb-1 pt-2 text-xs font-bold tracking-wide text-slate-500">사업단 업무</p>
            {adminLinks.map((link) => {
              const active = primaryActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  tabIndex={openAdminMenu ? 0 : -1}
                  aria-current={active ? "page" : undefined}
                  className={submenuLinkClass(active)}
                  onClick={() => setOpenAdminMenu(false)}
                >
                  <span className="block text-sm font-semibold">{link.label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-500">{link.description}</span>
                </Link>
              );
            })}
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
          울산과학대학교 앵커사업단 · 평생직업교육
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
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav
          id="mobile-menu"
          aria-label="모바일 메뉴"
          className="grid gap-1 border-t p-4 lg:hidden"
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
                <button
                  type="button"
                  aria-expanded={openAdminMenu}
                  aria-controls="mobile-admin-submenu"
                  className={`flex min-h-12 w-full items-center justify-between rounded-lg px-3 text-left ${adminActive ? "bg-teal-50 font-bold text-teal-900" : "text-slate-800"}`}
                  onClick={() => setOpenAdminMenu((current) => !current)}
                >
                  {label}
                  <ChevronDown aria-hidden="true" className={`h-5 w-5 transition-transform ${openAdminMenu ? "rotate-180" : ""}`} />
                </button>
                {openAdminMenu && (
                  <div id="mobile-admin-submenu" className="border-t border-slate-100 px-2 py-2">
                    {adminLinks.map((link) => {
                      const active = primaryActive(pathname, link.href);
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          aria-current={active ? "page" : undefined}
                          className={submenuLinkClass(active)}
                          onClick={() => {
                            setOpenAdminMenu(false);
                            setOpen(false);
                          }}
                        >
                          <span className="block text-sm font-semibold">{link.label}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-slate-500">{link.description}</span>
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
