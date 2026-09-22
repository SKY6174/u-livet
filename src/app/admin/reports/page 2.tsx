import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/workspace-navigation";
import { getCourseWorkspaces } from "@/lib/course-workspace/data";
import { ReportList } from "@/components/course-workspace/report-list";
import { Empty, PageIntro } from "@/components/portal/ui";

export default async function Reports() {
  const me = await requireIdentity("/admin/reports");
  if (!hasRole(me, "COURSE_MANAGER")) notFound();
  const { courses, unavailable } = await getCourseWorkspaces();
  return (
    <div className="page-shell">
      <PageIntro eyebrow="COURSE REPORTS" title="결과 보고">
        과정별 운영 결과와 증빙을 정리하고, 결과보고서와 6종 자료를 검토·출력합니다.
      </PageIntro>
      <div className="mb-8 flex flex-wrap gap-3">
        <Link className="btn-secondary" href="/admin/reports/preview">6종 보고서 양식 검토</Link>
        <Link className="btn-secondary" href="/admin/courses">과정 운영 관리</Link>
      </div>
      {unavailable ? <Empty title="보고서 현황을 불러오지 못했습니다">잠시 후 다시 확인해 주세요.</Empty> : <ReportList courses={courses} />}
    </div>
  );
}
