"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useRole } from "@/lib/auth/roleContext";
import { signOut } from "@/app/auth/actions";
import { OFFICE_POSITIONS } from "@/lib/auth/login-audience";
export default function Header() {
  const identity = useRole();
  const isLoginPage = usePathname() === "/auth/login";
  const [open, setOpen] = useState(false);
  const manager = identity?.roles.some((r) => r.role === "COURSE_MANAGER");
  const reviewer = identity?.roles.some((r) => r.role === "CERTIFIER");
  const finance = identity?.roles.some((r) => r.role === "FINANCE");
  const performance = identity?.roles.some((r) => r.role === "PERFORMANCE");
  const teacher = identity?.roles.some((r) => r.role === "INSTRUCTOR");
  // Display category only; each menu and server action keeps its own role check.
  const roleLabel = identity?.roles.some((r) => r.role === "SYSTEM_ADMIN")
    ? "관리자"
    : manager || reviewer || finance || performance
      ? "운영자"
      : teacher
        ? "강사"
        : "수강생";
  const userLabel = identity ? (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="rounded-md bg-teal-50 px-2 py-1 text-sm font-semibold text-teal-800">
        {identity.office_position && (roleLabel === "관리자" || roleLabel === "운영자")
          ? `사업단 · ${OFFICE_POSITIONS[identity.office_position]}`
          : teacher && identity.instructor_kind && roleLabel === "강사"
            ? `강사(${identity.instructor_kind === "INTERNAL" ? "교내" : "교외"})` : roleLabel}
      </span>
      <span>{identity.name} 님</span>
    </span>
  ) : null;
  const links = [
    ["앵커사업 소개", "/about"],
    ["수강안내", "/terms"],
    ["교육과정 소개", "/courses"],
    ...(identity && !isLoginPage ? [["나의 공간", "/mypage"]] : []),
    ...(performance ? [["연차 평가", "/performance"]] : []),
    ...(finance ? [["수납·환불", "/finance"]] : []),
    ...(teacher ? [["강사 공간", "/instructor"]] : []),
    ...(manager ? [["사업단 관리", "/admin"]] : []),
    ...(manager || reviewer
      ? [
          ["수료 검토", "/completion"],
          ["증명 관리", "/credentials"],
        ]
      : []),
  ];
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
        <nav aria-label="주 메뉴" className="hidden flex-wrap items-center justify-center gap-x-6 gap-y-3 lg:flex">
          {links.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="whitespace-nowrap text-sm font-semibold hover:text-teal-800"
            >
              {label}
            </Link>
          ))}
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
          {links.map(([label, href]) => (
            <Link
              onClick={() => setOpen(false)}
              key={href}
              href={href}
              className="rounded p-3 hover:bg-slate-50"
            >
              {label}
            </Link>
          ))}
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
