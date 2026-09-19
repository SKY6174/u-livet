import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { getCourseWorkspaces } from "@/lib/course-workspace/data";
import { CourseList } from "@/components/course-workspace/course-list";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageIntro, Empty } from "@/components/portal/ui";
import { OfferingDraftForm } from "@/components/course-plan/offering-draft-form";
import { getCourseOpeningPlan } from "@/lib/course-opening/server";
import { findOpeningCourse } from "@/lib/course-opening/prefill";
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireIdentity("/admin");
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
  const [{ courses, unavailable }, { data: years }] = await Promise.all([
    getCourseWorkspaces(),
    (await createServerSupabaseClient())
      .from("life_project_years")
      .select("*")
      .in("org_id", orgs),
  ]);
  return (
    <div className="page-shell">
      <PageIntro eyebrow="OPERATIONS" title="사업단 과정 관리">
        과정 개설부터 신청 심사, 운영 기록과 결과보고서 출력까지 관리합니다.
      </PageIntro>
      <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-100 bg-teal-50/60 p-5">
        <div>
          <h2 className="font-bold">과정의 시작부터 보고서까지, 한곳에서</h2>
          <p className="mt-2 text-sm text-slate-600">
            과정을 선택하면 출결·수료·지급 자료와 보고서 준비 상태를 함께 확인할
            수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="btn-primary" href="/admin?create=1#new-course">
            새 과정 등록
          </Link>
          <Link className="btn-secondary" href="/admin/reports/preview">
            6종 양식 검토
          </Link>
        </div>
      </section>
      <details className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-600">
          사업단 공통 업무
        </summary>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link className="btn-secondary" href="/admin/instructors">
            강사 이력 심사
          </Link>
          <Link className="btn-secondary" href="/admin/development">
            과정 개발·심의
          </Link>
          <Link href="/admin/messages" className="btn-secondary">
            안내문자 · 예약·처리 이력
          </Link>
          <Link href="/performance" className="btn-secondary">
            연차 평가·성과 관리
          </Link>
        </div>
      </details>
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
        <OfferingDraftForm
          key={plan?.sourceId ?? "manual"}
          orgId={orgs[0] ?? ""}
          years={(years ?? [])
            .filter((year) => year.org_id === orgs[0])
            .map((year) => ({ id: year.id, label: year.label }))}
          plan={plan}
        />
      </details>
    </div>
  );
}
