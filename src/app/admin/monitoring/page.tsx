import { notFound } from "next/navigation";
import { AdminLiveRefresh } from "@/components/admin/admin-live-refresh";
import { CourseMonitoringDashboard, type MonitoringCourse } from "@/components/admin/course-monitoring-dashboard";
import { CourseMonitoringPlanDashboard } from "@/components/admin/course-monitoring-plan-dashboard";
import { PageIntro, Empty } from "@/components/portal/ui";
import { requireIdentity } from "@/lib/auth/session";
import { getCourseWorkspaces } from "@/lib/course-workspace/data";
import { getAnnualMonitoringData } from "@/lib/course-monitoring/data";
import { ANCHOR_ORG_ID } from "@/lib/course-monitoring/model";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function getOrganizationNames(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  try {
    const { data, error } = await (await createServerSupabaseClient())
      .from("life_organizations")
      .select("id,name")
      .in("id", ids);
    return new Map(error ? [] : (data ?? []).map(({ id, name }) => [id, name]));
  } catch {
    return new Map<string, string>();
  }
}

export default async function CourseMonitoring() {
  const me = await requireIdentity("/admin/monitoring");
  const orgIds = Array.from(new Set(me.roles.filter((role) => role.role === "COURSE_MANAGER").map((role) => role.org_id)));
  if (!orgIds.length) notFound();

  const [{ courses: workspaces, unavailable }, organizationNames, annual] = await Promise.all([
    getCourseWorkspaces(),
    getOrganizationNames(orgIds),
    orgIds.includes(ANCHOR_ORG_ID) ? getAnnualMonitoringData() : Promise.resolve(null),
  ]);
  const allowed = new Set(orgIds);
  const courses: MonitoringCourse[] = workspaces.filter((course) => allowed.has(course.org_id)).map((course) => ({
    id: course.id,
    org_id: course.org_id,
    name: course.name,
    academy: course.academy,
    year_label: course.year_label,
    status: course.status,
    capacity: course.capacity,
    starts_on: course.starts_on,
    ends_on: course.ends_on,
    application_pending: course.application_pending,
    enrolled: course.enrolled,
    scheduled_sessions: course.scheduled_sessions,
    ended_sessions: course.ended_sessions,
    attendance_expected: course.attendance_expected,
    attendance_recorded: course.attendance_recorded,
    missing_attendance: course.missing_attendance,
    teaching_pending: course.teaching_pending,
    completion_pending: course.completion_pending,
    completed: course.completed,
    source_enrolled: course.source?.enrolled ?? null,
  }));
  const organizations = orgIds.map((id, index) => ({ id, name: organizationNames.get(id) ?? `담당 기관 ${index + 1}` }));

  return <div className="page-shell">
    <PageIntro eyebrow="COURSE MONITORING" title="과정 모니터링">
      16개 과정의 연간 일정과 PDCA 진행 신호등을 확인하고, 과정별 신청·수업·출결·수료 현황을 관리합니다.
    </PageIntro>
    <div className="mb-5 flex items-center justify-end gap-3">
      <span className="text-xs text-slate-500">화면을 보는 동안 30초마다 갱신</span>
      <AdminLiveRefresh />
    </div>
    {annual && (annual.unavailable
      ? <Empty title="연간 일정·PDCA 계획을 불러오지 못했습니다">데이터베이스 업데이트와 연결 상태를 확인한 뒤 다시 갱신해 주세요.</Empty>
      : <CourseMonitoringPlanDashboard guides={annual.guides} plans={annual.plans} documents={annual.documents}
          courses={courses} today={new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })} />)}
    {unavailable ? <Empty title="과정 현황을 불러오지 못했습니다">잠시 후 다시 갱신해 주세요.</Empty>
      : <CourseMonitoringDashboard courses={courses} organizations={organizations} />}
  </div>;
}
