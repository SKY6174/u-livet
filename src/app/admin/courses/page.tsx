import Link from "next/link";
import { courseOperationLinks } from "@/lib/auth/workspace-navigation";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { getCourseWorkspaces } from "@/lib/course-workspace/data";
import { CourseList } from "@/components/course-workspace/course-list";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageIntro, Empty } from "@/components/portal/ui";
import { OfferingDraftForm } from "@/components/course-plan/offering-draft-form";
import { getCourseOpeningPlan } from "@/lib/course-opening/server";
import { getOpeningWorkingCopy } from "@/lib/course-opening/working-copy-server";
import { findOpeningCourse } from "@/lib/course-opening/prefill";
export default async function CourseOperations({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireIdentity("/admin/courses");
  if (!me.roles.some((r) => r.role === "COURSE_MANAGER")) notFound();
  const params = await searchParams;
  const plan =
    params.plan === undefined
      ? undefined
      : findOpeningCourse(await getCourseOpeningPlan(), params.plan);
  if (params.plan !== undefined && !plan) notFound();
  const orgs = me.roles
    .filter((r) => r.role === "COURSE_MANAGER")
    .map((r) => r.org_id);
  const [{ courses, unavailable }, { data: years }, workingCopy] = await Promise.all([
    getCourseWorkspaces(),
    (await createServerSupabaseClient())
      .from("life_project_years")
      .select("*")
      .in("org_id", orgs),
    plan ? getOpeningWorkingCopy(orgs[0], plan.sourceId) : Promise.resolve({ copy: null, unavailable: false }),
  ]);
  return (
    <div className="page-shell">
      <PageIntro eyebrow="OPERATIONS" title="과정 운영 관리">
        과정 개설부터 모집·강사 배정·출결까지 교육 운영을 관리합니다.
      </PageIntro>
      <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-100 bg-teal-50/60 p-5">
        <div>
          <h2 className="font-bold">개설 준비부터 수업 운영까지</h2>
          <p className="mt-2 text-sm text-slate-600">
            과정을 선택해 운영 설정과 신청 심사, 출결 현황을 확인하세요. 운영 후 자료 정리는 결과 보고에서 이어갑니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="btn-primary" href="/admin/courses?create=1#new-course">
            새 과정 등록
          </Link>
          <Link className="btn-secondary" href="/admin/reports">
            결과 보고로 이동
          </Link>
        </div>
      </section>
      <nav aria-label="과정 운영 업무" className="mb-8 flex flex-wrap gap-3">
        {courseOperationLinks.map(({ href, label }) => <Link key={href} className="btn-secondary" href={href}>{label}</Link>)}
      </nav>
      {unavailable ? (
        <Empty title="과정 정보를 불러오지 못했습니다" />
      ) : (
        <CourseList courses={courses} />
      )}
      <details
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
          <a className="btn-secondary" href={`/admin/courses?plan=${plan?.sourceId}#offering-draft`}>다시 불러오기</a>
        </section> : <OfferingDraftForm
          key={`${orgs[0]}:${plan?.sourceId ?? "manual"}`}
          orgId={orgs[0] ?? ""}
          years={(years ?? [])
            .filter((year) => year.org_id === orgs[0])
            .map((year) => ({ id: year.id, label: year.label }))}
          plan={plan}
          copy={workingCopy.copy}
        />}
      </details>
    </div>
  );
}
