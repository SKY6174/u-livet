import Link from "next/link";
import type { CourseSummary } from "@/lib/portal/types";
import { modeLabel } from "@/lib/portal/data";

export function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="page-title">{title}</h1>
      {children && (
        <div className="mt-3 max-w-3xl text-slate-600">{children}</div>
      )}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 text-sm text-slate-600">{children}</div>
    </div>
  );
}
export function CourseCard({ offering: o }: { offering: CourseSummary }) {
  const open =
    o.status === "PUBLISHED" &&
    !!o.apply_from && !!o.apply_until &&
    Date.now() >= Date.parse(o.apply_from) &&
    Date.now() < Date.parse(o.apply_until);
  return (
    <Link
      href={`/offerings/${o.id}`}
      className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-teal-700 hover:shadow-md"
    >
      <div className="mb-6 flex justify-between gap-3 text-xs font-semibold">
        <span className="rounded bg-teal-50 px-2 py-1 text-teal-800">
          {o.academy}
        </span>
        <span className={open ? "text-teal-800" : "text-slate-500"}>
          {open ? "접수 중" : o.status === "DRAFT" ? "준비 중" : "일정 확인"}
        </span>
      </div>
      <h2 className="text-xl font-bold leading-snug group-hover:text-teal-800">
        {o.name}
      </h2>
      <p className="mt-3 line-clamp-2 text-sm text-slate-600">{o.summary}</p>
      <dl className="mt-6 space-y-1 border-t pt-4 text-sm">
        <div className="flex gap-3">
          <dt className="text-slate-500">교육기간</dt>
          <dd>
            {o.starts_on} ~ {o.ends_on}
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="text-slate-500">운영방식</dt>
          <dd>
            {modeLabel[o.mode]} · {o.capacity}명
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="text-slate-500">수강료</dt>
          <dd>
            {o.tuition === null ? "원본 미기재" : o.tuition === 0
              ? "무료"
              : `${o.tuition.toLocaleString("ko-KR")}원`}
          </dd>
        </div>
      </dl>
      <span className="mt-5 inline-block text-sm font-semibold text-teal-800">
        과정 자세히 보기 →
      </span>
    </Link>
  );
}
