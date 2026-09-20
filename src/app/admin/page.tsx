import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { hasRole, isOfficeMember, memberLabel, officeSections } from "@/lib/auth/workspace-navigation";
import { PageIntro } from "@/components/portal/ui";

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
  return (
    <div className="page-shell">
      <PageIntro eyebrow="OFFICE WORKSPACE" title="사업단 관리">
        {me.name} 님 · {memberLabel(me)}. 담당 업무를 선택해 운영과 보고를 이어가세요.
      </PageIntro>
      <div className="space-y-10">
        {officeSections(me).map(({ title, links }) => (
          <section key={title}>
            <h2 className="section-title">{title}</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {links.map(({ label, href, description }) => (
                <Link key={href} href={href} className="panel flex flex-col hover:border-teal-700">
                  <h3 className="text-lg font-bold">{label}</h3>
                  <p className="mb-5 mt-3 text-sm leading-relaxed text-slate-600">{description}</p>
                  <span className="mt-auto text-sm font-semibold text-teal-800">업무 시작 →</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
