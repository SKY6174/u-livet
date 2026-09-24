/**
 * @file src/components/operation-documents/document-list.tsx
 * @description 접근 가능한 등록 과정과 2026년 앵커사업단 원문 16개 과정을 병합하여
 *              기관·사업연도·아카데미·상태별로 운영 문서를 탐색합니다.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/workspace-navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCourseWorkspaces } from "@/lib/course-workspace/data";
import { STATUS_LABELS, RESULT_STATUS_LABELS } from "@/lib/operation-documents/model";
import {
  PREFILLED_COURSES,
  findPrefilledCourse,
} from "@/lib/operation-documents/prefilled-data";
import { ReportList } from "@/components/course-workspace/report-list";
import { Empty, PageIntro } from "@/components/portal/ui";
import { DocumentListView, type DocumentCourseItem } from "./document-list-view";

type Kind = "plan" | "result";

type DbCourseRow = {
  id: string;
  name: string;
  org_id: string;
  org_name: string;
  year: number;
  year_label: string;
  academy: string;
  capacity: number;
  location: string;
  starts_on: string;
  ends_on: string;
  responsible: string | null;
  plan_status: keyof typeof STATUS_LABELS | null;
  result_status: keyof typeof RESULT_STATUS_LABELS | null;
};

type GuideLink = { source_id: string; offering_id: string | null };
type OrganizationOption = { id: string; name: string };
const ANCHOR_ORG_ID = "10000000-0000-4000-8000-000000000001";

export async function DocumentList({
  kind,
  view = "official",
}: {
  kind: Kind;
  view?: "official" | "evidence";
}) {
  // 1. 현재 사용자 인증 및 권한 확인
  const me = await requireIdentity(
    kind === "result" && view === "evidence"
      ? "/operation-documents/result?view=evidence"
      : `/operation-documents/${kind}`,
  );
  const manager = hasRole(me, "COURSE_MANAGER");
  const managedOrgIds = Array.from(new Set(me.roles
    .filter((role) => role.role === "COURSE_MANAGER")
    .map((role) => role.org_id)));
  const result = kind === "result";
  const evidence = result && view === "evidence";

  // 6종 증빙자료 뷰는 관리자만 접근 가능
  if (evidence && !manager) notFound();

  // 2. 데이터베이스 과정 및 기존 증빙 데이터 조회
  let dbCourses: DbCourseRow[] = [];
  let guideLinks: GuideLink[] = [];
  let managedOrganizations: OrganizationOption[] = [];
  let dbError = false;

  if (!evidence) {
    try {
      const client = await createServerSupabaseClient();
      const [response, guides, organizations] = await Promise.all([
        client.rpc("life_operation_list"),
        client.from("life_course_guides").select("source_id,offering_id").eq("year", 2026),
        managedOrgIds.length
          ? client.from("life_organizations").select("id,name").in("id", managedOrgIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (!response.error && Array.isArray(response.data) && !guides.error && Array.isArray(guides.data) && !organizations.error && Array.isArray(organizations.data)) {
        dbCourses = response.data as DbCourseRow[];
        guideLinks = guides.data as GuideLink[];
        managedOrganizations = organizations.data as OrganizationOption[];
      } else {
        dbError = true;
      }
    } catch {
      dbError = true;
    }
  }

  const legacy = evidence ? await getCourseWorkspaces() : null;
  const label = result ? "결과보고서" : "운영계획서";

  // 앵커사업단 관리자는 2026년 원문 이관 현황을 보고, 그 밖의 사용자는
  // DB에서 접근이 허용된 실제 과정만 봅니다. 작성 링크는 DB 행에만 부여합니다.
  const canManageAnchor = managedOrgIds.includes(ANCHOR_ORG_ID);
  const mergedCourses: DocumentCourseItem[] = PREFILLED_COURSES.flatMap(
    (prefilled, idx) => {
      const guide = guideLinks.find((entry) => entry.source_id === prefilled.sourceId);
      const matchedDb = guide
        ? dbCourses.find((db) => db.id === guide.offering_id && db.org_id === ANCHOR_ORG_ID && db.year === 2026)
        : dbCourses.find((db) =>
            db.org_id === ANCHOR_ORG_ID && db.year === 2026 &&
            (db.name === prefilled.title || findPrefilledCourse(db.name)?.id === prefilled.id),
          );
      if (!canManageAnchor && !matchedDb) return [];

      return [
        {
          id: matchedDb ? matchedDb.id : prefilled.id,
          source_id: prefilled.sourceId,
          registered: Boolean(matchedDb),
          sort_order: idx + 1,
          program_id: prefilled.programId,
          name: prefilled.title,
          academy: prefilled.academy,
          org_id: ANCHOR_ORG_ID,
          org_name: matchedDb?.org_name ?? "울산과학대학교 앵커사업단",
          year: 2026,
          year_label: matchedDb?.year_label ?? "2026년 (2차년도)",
          capacity: prefilled.capacity,
          teaching_hours: prefilled.teachingHours,
          starts_on: matchedDb?.starts_on || prefilled.startsOn,
          ends_on: matchedDb?.ends_on || prefilled.endsOn,
          period_label: `${matchedDb?.starts_on || prefilled.startsOn} ~ ${matchedDb?.ends_on || prefilled.endsOn}`,
          time_label: prefilled.timeLabel,
          location: prefilled.location,
          teachers: prefilled.teachers,
          responsible: matchedDb?.responsible || "",
          source_coordinator: prefilled.facultyCoordinator,
          assistants: prefilled.assistants,
          support_staff: prefilled.supportStaff,
          plan_status: matchedDb?.plan_status ?? null,
          result_status: matchedDb?.result_status ?? null,
          enrolled_completed: prefilled.hasResultReport
            ? "원문 확인 필요"
            : "미집계",
          has_source_report: prefilled.hasResultReport,
        },
      ];
    },
  );

  // 원문 목록에 없는 실제 등록 과정도 기관·연도에 관계없이 권한 범위에서 표시합니다.
  const matchedDbIds = new Set(
    mergedCourses.filter((course) => course.registered).map((course) => course.id),
  );
  const unmatchedDbCourses = dbCourses.filter((course) => !matchedDbIds.has(course.id));
  unmatchedDbCourses.forEach((course, index) => {
    mergedCourses.push({
      id: course.id,
      source_id: "",
      registered: true,
      sort_order: PREFILLED_COURSES.length + index + 1,
      program_id: "미기재",
      name: course.name,
      academy: course.academy,
      org_id: course.org_id,
      org_name: course.org_name,
      year: course.year,
      year_label: course.year_label,
      capacity: course.capacity,
      teaching_hours: null,
      starts_on: course.starts_on,
      ends_on: course.ends_on,
      period_label: `${course.starts_on} ~ ${course.ends_on}`,
      time_label: "운영정보 확인",
      location: course.location,
      teachers: course.responsible || "강사 미지정",
      responsible: course.responsible || "",
      source_coordinator: "",
      assistants: "-",
      support_staff: "-",
      plan_status: course.plan_status,
      result_status: course.result_status,
      enrolled_completed: "미집계",
      has_source_report: false,
    });
  });

  const organizationOptions = Array.from(new Map([
    ...managedOrganizations,
    ...dbCourses.map((course) => ({ id: course.org_id, name: course.org_name })),
  ].map((organization) => [organization.id, organization] as const)).values())
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return (
    <div className="page-shell space-y-8">
      {/* 1. 상단 페이지 소개 헤더 */}
      <PageIntro eyebrow="COURSE DOCUMENTS" title={label}>
        {result
          ? "담당자가 예산을 입력·확정하면 책임강사가 운영 결과를 작성하고 서명하여 최종 제출합니다."
          : "책임강사가 운영 내용을 작성하고, 담당자가 예산을 완성해 최종 제출합니다."}
      </PageIntro>

      {/* 2. 운영계획서 / 결과보고서 상단 탭 네비게이션 */}
      <nav className="flex flex-wrap gap-3" aria-label="과정 문서 종류">
        {(["plan", "result"] as const).map((entry) => (
          <Link
            key={entry}
            className={entry === kind ? "btn-primary" : "btn-secondary"}
            href={`/operation-documents/${entry}`}
            aria-current={entry === kind ? "page" : undefined}
          >
            {entry === "plan" ? "운영계획서" : "결과보고서"}
          </Link>
        ))}
      </nav>

      {/* 3. 결과보고서 서브 네비게이션 (공식 운영결과보고서 vs 결과 보고·6종 증빙) */}
      {result && manager && (
        <nav
          className="flex flex-wrap gap-2 border-b border-slate-200 pb-3"
          aria-label="결과보고서 자료"
        >
          <Link
            className={
              !evidence
                ? "rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white"
                : "rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            }
            href="/operation-documents/result"
            aria-current={!evidence ? "page" : undefined}
          >
            공식 운영결과보고서
          </Link>
          <Link
            className={
              evidence
                ? "rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white"
                : "rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            }
            href="/operation-documents/result?view=evidence"
            aria-current={evidence ? "page" : undefined}
          >
            결과 보고 · 6종 증빙
          </Link>
        </nav>
      )}

      {/* 4. 공식 운영계획서 / 결과보고서 목록 영역 */}
      {!evidence && (
        <section aria-label={result ? "공식 운영결과보고서" : "운영계획서"}>
          <div className="mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {result ? "공식 운영결과보고서" : "과정별 운영계획서"}
              </h2>
            </div>
          </div>

          {/* 카드형 / 리스트형 인터랙티브 뷰 컴포넌트 */}
          {dbError ? (
            <Empty title="문서 현황을 불러오지 못했습니다">
              추가 인증 상태와 네트워크 연결을 확인한 뒤 다시 시도해 주세요.
            </Empty>
          ) : (
            <DocumentListView
              kind={kind}
              courses={mergedCourses}
              manager={manager}
              organizations={organizationOptions}
            />
          )}
        </section>
      )}

      {/* 5. 결과 보고 · 6종 증빙 관리자 전용 영역 */}
      {evidence && (
        <section aria-label="결과 보고 및 6종 증빙">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">결과 보고 · 6종 증빙</h2>
              <p className="mt-1 text-sm text-slate-600">
                기존 결과 보고의 운영 집계·지급자료·원본 PDF를 검토하고 출력합니다.
              </p>
            </div>
            <Link className="btn-secondary" href="/admin/reports/preview">
              6종 보고서 양식 검토
            </Link>
          </div>
          {legacy?.unavailable ? (
            <Empty title="증빙 현황을 불러오지 못했습니다">
              잠시 후 다시 확인해 주세요.
            </Empty>
          ) : (
            <ReportList courses={legacy?.courses ?? []} />
          )}
        </section>
      )}
    </div>
  );
}
