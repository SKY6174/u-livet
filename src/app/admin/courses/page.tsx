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
const SUPPORTED_YEARS = [2025, 2026, 2027, 2028, 2029];

function parseYear(value: string | string[] | undefined) {
  const candidate = typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(candidate) && candidate >= 2000 && candidate <= 2200 ? candidate : 2026;
}

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
  const year = parseYear(params.year);
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
    getCourseBudgets(org, [], year),
    db.rpc("life_operation_list"),
  ]);
  const scopedCourses = courses.filter(
    (course) => course.org_id === org && Number(course.year_label.match(/\d{4}/)?.[0]) === year,
  );
  const overview = { ...budgets, courses: mergeOperationCourses(budgets.courses, scopedCourses) };
  const responsibleNames = responsibilityResult.error
    ? null
    : Object.fromEntries(
        ((responsibilityResult.data ?? []) as { id: string; responsible: string | null }[])
          .map((course) => [course.id, course.responsible]),
      );
  const linked = new Set(overview.courses.map(c => c.offering_id).filter(Boolean));
  const additional = scopedCourses.filter(c => !linked.has(c.id));
  const yearOptions = Array.from(new Set([
    ...SUPPORTED_YEARS,
    ...(years ?? []).map((item) => Number(item.label.match(/\d{4}/)?.[0])).filter(Number.isInteger),
  ])).sort((a, b) => a - b);
  const organizationOptions = orgs.map((id) => ({
    id,
    name: id === ANCHOR_ORG_ID ? "울산과학대학교 앵커사업단" : `사업단 · ${id.slice(-8)}`,
  }));
  return (
    <div className="page-shell">
      <PageIntro eyebrow="OPERATIONS" title="과정 운영 관리">
        과정 개설부터 모집·강사 배정·출결까지 교육 운영을 관리합니다.
      </PageIntro>
      {overview.unavailable || unavailable ? (
        <><Empty title="과정 정보를 불러오지 못했습니다" />{manager && <Link className="mt-4 inline-flex rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700" href={`/admin/courses?org=${org}&create=1#new-course`}>새 과정 등록</Link>}</>
      ) : (
        <OperationsDashboard
          key={`${org}:${year}`}
          courses={overview.courses}
          workbooks={overview.workbooks}
          org={org}
          manager={manager}
          responsibleNames={responsibleNames}
          organizations={organizationOptions}
          years={yearOptions}
          selectedYear={year}
        />
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
