import Link from "next/link";
import type { CourseSummary } from "@/lib/portal/types";
import { modeLabel } from "@/lib/portal/data";
import { ArrowUpRight, CalendarDays, Clock3, Users, Wallet } from "lucide-react";
import { PageDescriptionHint } from "./page-description-hint";

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
    <div className="relative mb-8">
      <p className="eyebrow">{eyebrow}</p>
      <div className="flex items-start gap-2">
        <h1 className={`page-title min-w-0 ${children ? "mb-0" : ""}`}>{title}</h1>
        {children && <PageDescriptionHint label={title}>{children}</PageDescriptionHint>}
      </div>
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
      <div className="mb-6 flex flex-wrap justify-between gap-3 text-sm font-semibold">
        <span className="rounded bg-teal-50 px-2 py-1 text-teal-800">
          {o.academy}
        </span>
        <span className={open ? "text-teal-800" : "text-slate-500"}>
          {o.status === "ARCHIVED" ? "운영 완료" : open ? "접수 중" : o.status === "DRAFT" ? "준비 중" : "일정 확인"}
        </span>
      </div>
      <h2 className="text-xl font-bold leading-snug group-hover:text-teal-800">
        {o.name}
      </h2>
      <p className="mt-3 line-clamp-2 text-sm text-slate-600">{o.summary}</p>
      <dl className="mt-6 space-y-3 border-t pt-4 text-base">
        <div>
          <dt className="flex items-center gap-2 text-slate-600"><CalendarDays className="h-5 w-5 shrink-0 text-teal-700" aria-hidden="true" />교육기간</dt>
          <dd>
            {o.starts_on} ~ {o.ends_on}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 text-slate-600"><Clock3 className="h-5 w-5 shrink-0 text-teal-700" aria-hidden="true" />신청기간</dt>
          <dd>{o.apply_from && o.apply_until ? `${new Date(o.apply_from).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} ~ ${new Date(o.apply_until).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}` : "별도 안내"}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 text-slate-600"><Users className="h-5 w-5 shrink-0 text-teal-700" aria-hidden="true" />운영방식</dt>
          <dd>
            {modeLabel[o.mode]} · {o.capacity}명
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 text-slate-600"><Wallet className="h-5 w-5 shrink-0 text-teal-700" aria-hidden="true" />수강료</dt>
          <dd>
            {o.tuition === null ? "원본 미기재" : o.tuition === 0
              ? "무료"
              : `${o.tuition.toLocaleString("ko-KR")}원`}
          </dd>
        </div>
      </dl>
      <span className="mt-5 inline-flex min-h-12 items-center gap-2 text-base font-semibold text-teal-800">
        과정 자세히 보기 <ArrowUpRight className="h-5 w-5 shrink-0" aria-hidden="true" />
      </span>
    </Link>
  );
}
