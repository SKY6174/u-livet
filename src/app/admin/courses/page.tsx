import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { getCourseWorkspaces } from "@/lib/course-workspace/data";
import { CourseList } from "@/components/course-workspace/course-list";
import { OperationsDashboard } from "@/components/course-workspace/operations-dashboard";
import { getCourseBudgets } from "@/lib/course-budget/data";
import { mergeOperationCourses } from "@/lib/course-budget/model";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageIntro, Empty } from "@/components/portal/ui";
import { OfferingDraftForm } from "@/components/course-plan/offering-draft-form";
import { getCourseOpeningPlan } from "@/lib/course-opening/server";
import { getOpeningWorkingCopy } from "@/lib/course-opening/working-copy-server";
import { findOpeningCourse } from "@/lib/course-opening/prefill";

const ANCHOR_ORG_ID = "10000000-0000-4000-8000-000000000001";

export default async function CourseOperations({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireIdentity("/admin/courses");
  if (!me.roles.some((r) => ["COURSE_MANAGER", "SYSTEM_ADMIN"].includes(r.role))) notFound();
  const params = await searchParams;
  const grantedOrgs = Array.from(new Set(me.roles.filter(r => ["COURSE_MANAGER", "SYSTEM_ADMIN"].includes(r.role)).map(r => r.org_id)));
  const orgs = grantedOrgs.includes(ANCHOR_ORG_ID) ? [ANCHOR_ORG_ID] : grantedOrgs;
  if (!orgs.length) notFound();
  const org = typeof params.org === "string" && orgs.includes(params.org) ? params.org : orgs[0];
  const manager = me.roles.some(r => r.role === "COURSE_MANAGER" && r.org_id === org);
  const plan =
    params.plan === undefined || !manager
      ? undefined
      : findOpeningCourse(await getCourseOpeningPlan(), params.plan);
  if (params.plan !== undefined && !plan) notFound();
  const db = await createServerSupabaseClient();
  const [{ courses, unavailable }, { data: years }, workingCopy, budgets, responsibilityResult] = await Promise.all([
    manager ? getCourseWorkspaces() : Promise.resolve({ courses: [], unavailable: false }),
    db
      .from("life_project_years")
      .select("id,org_id,label")
      .in("org_id", orgs),
    plan ? getOpeningWorkingCopy(org, plan.sourceId) : Promise.resolve({ copy: null, unavailable: false }),
    getCourseBudgets(org, []),
    db.rpc("life_operation_list"),
  ]);
  const scopedCourses = courses.filter(c => c.org_id === org);
  const overview = { ...budgets, courses: mergeOperationCourses(budgets.courses, scopedCourses) };
  const responsibleNames = responsibilityResult.error
    ? null
    : Object.fromEntries(
        ((responsibilityResult.data ?? []) as { id: string; responsible: string | null }[])
          .map((course) => [course.id, course.responsible]),
      );
  const linked = new Set(overview.courses.map(c => c.offering_id).filter(Boolean));
  const additional = scopedCourses.filter(c => !linked.has(c.id));
  return (
    <div className="page-shell">
      <PageIntro eyebrow="OPERATIONS" title="과정 운영 관리">
        과정 개설부터 모집·강사 배정·출결까지 교육 운영을 관리합니다.
      </PageIntro>
      {orgs.length > 1 ? <form className="mb-5 flex flex-wrap gap-3"><label className="text-sm">사업단<select name="org" defaultValue={org} className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm">{orgs.map((id, i) => <option key={id} value={id}>사업단 {i + 1} · {id.slice(-8)}</option>)}</select></label><button className="btn-secondary">선택</button></form>
        : <p className="mb-6 text-sm font-medium text-slate-600">사업단 · {org === ANCHOR_ORG_ID ? "울산과학대학교 앵커사업단" : org.slice(-8)}</p>}
      {manager && <div className="mb-8 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" aria-label="과정 업무 구분">
        <section className="rounded-2xl border border-teal-200 bg-teal-50/60 p-6">
          <p className="text-xs font-bold tracking-wide text-teal-800">기존 연간 계획 운영</p>
          <h2 className="mt-2 text-xl font-bold">연간 계획에서 개설까지</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">과정 현황에서 연간 계획을 확인하고, 개설 준비에서 모집 전 일정·인력·운영 조건을 검토합니다.</p>
          <nav aria-label="연간 계획과 개설 준비" className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link className="rounded-xl border border-teal-200 bg-white px-4 py-4 font-semibold text-teal-900 hover:border-teal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700" href="/admin/course-plan">01 · 과정 현황 확인 →</Link>
            <Link className="rounded-xl border border-teal-200 bg-white px-4 py-4 font-semibold text-teal-900 hover:border-teal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700" href="/admin/course-plan/opening">02 · 개설 준비 →</Link>
          </nav>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-xs font-bold tracking-wide text-slate-500">신규 교육과정 기획</p>
          <h2 className="mt-2 text-xl font-bold">과정 개발·심의</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">연간 계획의 개설 준비와 별도로 새로운 교육과정을 제안하고 심의 진행 상황을 확인합니다.</p>
          <Link className="mt-5 inline-flex rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-800 hover:border-teal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700" href="/admin/development">과정 개발·심의로 이동 →</Link>
        </section>
      </div>}
      {overview.unavailable || unavailable ? (
        <><Empty title="과정 정보를 불러오지 못했습니다" />{manager && <Link className="mt-4 inline-flex rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700" href={`/admin/courses?org=${org}&create=1#new-course`}>새 과정 등록</Link>}</>
      ) : (
        <OperationsDashboard key={org} courses={overview.courses} workbooks={overview.workbooks} org={org} manager={manager} responsibleNames={responsibleNames} />
      )}
      {!overview.unavailable && additional.length > 0 && <section className="mt-10"><h2 className="mb-5 text-xl font-bold">추가 개설 과정</h2><CourseList courses={additional} /></section>}
      {manager && <details
        id="new-course"
        className="mt-10 scroll-mt-6"
        open={!!plan || params.create === "1"}
      >
        <summary className="mb-5 cursor-pointer text-lg font-bold">
          새 과정 등록
        </summary>
        {workingCopy.unavailable ? <section id="offering-draft" className="panel space-y-4">
          <h2 className="font-bold">개설 준비 임시저장본을 불러오지 못했습니다</h2>
          <p>연결 상태를 확인한 뒤 다시 불러와 주세요. 저장본 확인 후 편집할 수 있습니다.</p>
          <a className="btn-secondary" href={`/admin/courses?org=${org}&plan=${plan?.sourceId}#offering-draft`}>다시 불러오기</a>
        </section> : <OfferingDraftForm
          key={`${org}:${plan?.sourceId ?? "manual"}`}
          orgId={org}
          years={(years ?? [])
            .filter((year) => year.org_id === org)
            .map((year) => ({ id: year.id, label: year.label }))}
          plan={plan}
          copy={workingCopy.copy}
        />}
      </details>}
    </div>
  );
}
