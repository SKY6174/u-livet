import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { getWorkspaceOfferings, statusLabel } from "@/lib/portal/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageIntro, Empty } from "@/components/portal/ui";
import { OfferingDraftForm } from "@/components/course-plan/offering-draft-form";
import { getCourseOpeningPlan } from "@/lib/course-opening/server";
import { findOpeningCourse } from "@/lib/course-opening/prefill";
export default async function Admin({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireIdentity("/admin");
  if (!me.roles.some((r) => r.role === "COURSE_MANAGER")) notFound();
  const params = await searchParams;
  const plan = params.plan === undefined
    ? undefined
    : findOpeningCourse(await getCourseOpeningPlan(), params.plan);
  if (params.plan !== undefined && !plan) notFound();
  const orgs = me.roles
    .filter((r) => r.role === "COURSE_MANAGER")
    .map((r) => r.org_id);
  const [{ offerings: own, unavailable }, { data: years }] = await Promise.all([
    getWorkspaceOfferings("org_id", orgs),
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
      <section className="panel mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">결과보고서 양식 먼저 살펴보기</h2>
          <p className="mt-2 text-sm text-slate-600">
            과정 등록 없이 6종 양식과 입력 담당을 확인하고 예시를 출력할 수 있습니다.
          </p>
        </div>
        <Link className="btn-primary" href="/admin/reports/preview">양식 구성 검토</Link>
      </section>
      <div className="mb-6 flex flex-wrap gap-3">
        <Link className="btn-secondary" href="/admin/instructors">
          강사 이력 심사
        </Link>
        <Link className="btn-secondary" href="/admin/development">
          과정 개발·심의
        </Link>
      </div>
      <Link href="/admin/messages" className="btn-secondary mb-8">
        안내문자 · 예약·처리 이력
      </Link>
      <Link href="/performance" className="btn-secondary mb-8 ml-3">
        연차 평가·성과 관리
      </Link>
      {unavailable ? (
        <Empty title="과정 정보를 불러오지 못했습니다" />
      ) : (
        <div className="mb-8 grid gap-4 md:grid-cols-2">
          {own.map((o) => (
            <article key={o.id} className="panel">
              <span className="badge">{statusLabel[o.status]}</span>
              <h2 className="mt-3 text-lg font-bold">{o.name}</h2>
              <p className="mt-2 text-sm text-slate-600">
                {o.year_label} · 정원 {o.capacity}명
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  className="btn-secondary"
                  href={`/admin/offerings/${o.id}`}
                >
                  과정 관리
                </Link>
                <Link
                  className="btn-primary"
                  href={`/admin/offerings/${o.id}/reports`}
                >
                  결과보고서 · 출력
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
      <OfferingDraftForm
        key={plan?.sourceId ?? "manual"}
        orgId={orgs[0] ?? ""}
        years={(years ?? []).filter((year) => year.org_id === orgs[0]).map((year) => ({ id: year.id, label: year.label }))}
        plan={plan}
      />
    </div>
  );
}
