import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { statusLabel } from "@/lib/portal/data";
import type { Offering } from "@/lib/portal/types";

export function CourseHeader({
  offering: o,
  active,
  operator,
}: {
  offering: Offering;
  active: "overview" | "manage" | "reports";
  operator?: string;
}) {
  const base = `/admin/offerings/${o.id}`;
  return (
    <header className="mb-8">
      <Link
        href={active === "reports" ? "/admin/reports" : "/admin/courses"}
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-teal-800"
      >
        <ArrowLeft size={16} />
        {active === "reports" ? "전체 결과 보고" : "전체 과정"}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="badge">{statusLabel[o.status]}</span>
            <span className="text-slate-500">
              {o.academy} · {o.year_label}
            </span>
          </div>
          <h1 className="break-keep text-2xl font-bold leading-snug tracking-tight text-slate-900 md:text-3xl">
            {o.name}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            {o.starts_on} ~ {o.ends_on} · 정원 {o.capacity}명
            {operator ? ` · 운영 담당 ${operator}` : ""}
          </p>
        </div>
        <Link
          className="btn-secondary gap-2"
          href={`${base}/reports/print?document=all`}
          target="_blank"
          rel="noreferrer"
        >
          6종 출력 미리보기
          <ArrowUpRight size={16} />
        </Link>
      </div>
      <nav
        aria-label="이 과정의 관리 메뉴"
        className="mt-7 flex gap-1 border-b border-slate-200"
      >
        {(
          [
            ["overview", "운영 개요", base],
            ["manage", "운영 설정·신청", `${base}/manage`],
            ["reports", "결과보고서", `${base}/reports`],
          ] as const
        ).map(([key, label, href]) => (
          <Link
            key={key}
            href={href}
            aria-current={active === key ? "page" : undefined}
            className={`border-b-2 px-3 py-3 text-sm font-semibold sm:px-5 ${active === key ? "border-teal-700 text-teal-800" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
