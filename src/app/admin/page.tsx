import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowUpRight, Award, BookOpen, ChartNoAxesCombined, ClipboardCheck, Files, FileText, Layers3, Ticket, UsersRound, Wallet } from "lucide-react";
import { requireIdentity } from "@/lib/auth/session";
import { hasRole, isOfficeMember, officeSections } from "@/lib/auth/workspace-navigation";
import { getAdminLearnerDocuments } from "@/lib/learner-document-workflow/data";
import { LearnerRequestAlerts } from "@/components/admin/learner-request-alerts";
import { MenuHint } from "@/components/navigation/menu-hint";

const WORKSPACE_ICONS = {
  "/admin/courses": BookOpen,
  "/admin/instructors": UsersRound,
  "/operation-documents/plan": BookOpen,
  "/operation-documents/result": FileText,
  "/completion": ClipboardCheck,
  "/credentials": Award,
  "/finance": Wallet,
  "/performance": ChartNoAxesCombined,
  "/admin/accounts": UsersRound,
  "/admin/parking": Ticket,
  "/admin/learner-documents": Files,
};

export default async function Admin({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireIdentity("/admin");
  if (!isOfficeMember(me)) notFound();
  const params = await searchParams;
  if (params.plan !== undefined || params.create !== undefined) {
    if (!hasRole(me, "COURSE_MANAGER")) notFound();
    const query = new URLSearchParams();
    for (const key of ["plan", "create"]) {
      const value = params[key];
      if (value !== undefined) {
        if (typeof value !== "string") notFound();
        query.set(key, value);
      }
    }
    redirect(`/admin/courses?${query.toString()}#new-course`);
  }
  const canReviewLearnerRequests = hasRole(me, "SYSTEM_ADMIN", "COURSE_MANAGER", "FINANCE");
  const learnerRequests = canReviewLearnerRequests
    ? await getAdminLearnerDocuments({ kind: null, status: null, query: "" })
    : undefined;
  return (
    <div className="page-shell">
      <div className="mb-9 flex items-end justify-between gap-4 border-b border-slate-200 pb-7">
        <div>
          <p className="eyebrow">OFFICE WORKSPACE</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">사업단 관리</h1>
        </div>
        <span className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
          <Layers3 aria-hidden="true" className="h-3.5 w-3.5 text-teal-700" />업무 홈
        </span>
      </div>
      {hasRole(me, "COURSE_MANAGER") && <Link className="btn-secondary mb-6" href="/admin/course-requests">수강생 희망 과목 제안·검토 →</Link>}
      {learnerRequests !== undefined && <LearnerRequestAlerts data={learnerRequests} />}
      <div className="space-y-8">
        {officeSections(me).map(({ title, links }, sectionIndex) => (
          <section key={title} aria-labelledby={`workspace-section-${sectionIndex}`}>
            <div className="mb-3 flex items-center gap-3">
              <span aria-hidden="true" className="text-xs font-semibold tabular-nums text-slate-400">{String(sectionIndex + 1).padStart(2, "0")}</span>
              <h2 id={`workspace-section-${sectionIndex}`} className="text-base font-bold text-slate-800">{title}</h2>
              <span aria-hidden="true" className="h-px flex-1 bg-slate-200/80" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {links.map(({ label, href, description }) => {
                const Icon = WORKSPACE_ICONS[href as keyof typeof WORKSPACE_ICONS] ?? Layers3;
                const featured = href === "/admin/courses";
                return (
                  <Link key={href} href={href}
                    className={`group relative isolate flex rounded-2xl border p-6 hover:z-10 focus-visible:z-10 motion-safe:transition-all motion-safe:duration-200 motion-safe:hover:-translate-y-1 ${featured
                      ? "flex-col gap-5 border-teal-800 bg-gradient-to-br from-teal-900 via-teal-800 to-cyan-800 text-white shadow-lg shadow-teal-900/10 md:col-span-2 md:flex-row md:items-center md:gap-6 xl:col-span-3"
                      : "flex-col border-slate-200/90 bg-white shadow-sm shadow-slate-200/40 hover:border-teal-300 hover:shadow-lg hover:shadow-teal-900/5"}`}>
                    {featured && <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl"><span className="absolute -right-10 -top-32 h-80 w-80 rounded-full border-[40px] border-white/5" /></span>}
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${featured ? "bg-white/10 ring-1 ring-inset ring-white/20" : "bg-gradient-to-br from-teal-50 to-cyan-50 text-teal-800 ring-1 ring-inset ring-teal-100/80"}`}>
                      <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.7} />
                    </span>
                    <div className={featured ? "flex-1" : "mb-6 mt-5"}>
                      <h3 className={`text-lg font-bold tracking-tight ${featured ? "text-white" : "text-slate-900"}`}><MenuHint label={label} description={description} /></h3>
                    </div>
                    <span className={`flex items-center justify-between gap-4 text-sm font-semibold ${featured ? "self-start rounded-xl bg-white px-4 py-3 text-teal-900 md:self-center" : "mt-auto border-t border-slate-100 pt-4 text-teal-800"}`}>
                      업무 시작
                      <ArrowUpRight aria-hidden="true" className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
