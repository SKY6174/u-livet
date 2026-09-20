"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRole } from "@/lib/auth/roleContext";
import { isOfficeMember, officeActiveHref, officeSections } from "@/lib/auth/workspace-navigation";

export function OfficeNav() {
  const me = useRole();
  const path = usePathname();
  if (!me || !isOfficeMember(me)) return null;
  const active = officeActiveHref(path);
  const links = [{ label: "업무 홈", href: "/admin" }, ...officeSections(me).flatMap((section) => section.links)];
  return (
    <nav aria-label="사업단 관리 메뉴" className="no-print border-b border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-5 py-4">
        <p className="mb-3 text-xs font-bold text-slate-500">사업단 관리</p>
        <div className="flex flex-wrap gap-2">
          {links.map(({ label, href }) => (
            <Link key={href} href={href} aria-current={active === href ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${active === href ? "bg-teal-800 text-white" : "text-slate-600 hover:bg-white hover:text-teal-800"}`}>
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
