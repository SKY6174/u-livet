/**
 * @file src/components/operation-documents/document-list.tsx
 * @description 2026년 RISE사업 평생직업교육과정 운영계획서 및 운영결과보고서 메인 목록 화면 컴포넌트입니다.
 *              데이터베이스에 등록된 과정뿐만 아니라 16개 전체 과정(PREFILLED_COURSES)을 안전하게 병합하여
 *              카드형 및 리스트형(테이블)으로 시각화하고 검색, 아카데미별/상태별 필터링을 제공합니다.
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
  starts_on: string;
  ends_on: string;
  responsible: string | null;
  plan_status: keyof typeof STATUS_LABELS | null;
  result_status: keyof typeof RESULT_STATUS_LABELS | null;
};

type GuideLink = { source_id: string; offering_id: string | null };

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
  const result = kind === "result";
  const evidence = result && view === "evidence";

  // 6종 증빙자료 뷰는 관리자만 접근 가능
  if (evidence && !manager) notFound();

  // 2. 데이터베이스 과정 및 기존 증빙 데이터 조회
  let dbCourses: DbCourseRow[] = [];
  let guideLinks: GuideLink[] = [];
  let dbError = false;

  if (!evidence) {
    try {
      const client = await createServerSupabaseClient();
      const [response, guides] = await Promise.all([
        client.rpc("life_operation_list"),
        client.from("life_course_guides").select("source_id,offering_id").eq("year", 2026),
      ]);
      if (!response.error && Array.isArray(response.data) && !guides.error && Array.isArray(guides.data)) {
        dbCourses = response.data as DbCourseRow[];
        guideLinks = guides.data as GuideLink[];
      } else {
        dbError = true;
      }
    } catch {
      dbError = true;
    }
  }

  const legacy = evidence ? await getCourseWorkspaces() : null;
  const label = result ? "결과보고서" : "운영계획서";

  // 3. 관리자는 16개 원문 이관 현황을 모두 보고, 책임강사는 DB에서
  //    접근이 허용된 실제 과정만 봅니다. 작성 링크와 상태는 DB 행에만 부여합니다.
  const mergedCourses: DocumentCourseItem[] = PREFILLED_COURSES.flatMap(
    (prefilled, idx) => {
      const guide = guideLinks.find((entry) => entry.source_id === prefilled.sourceId);
      const matchedDb = guide
        ? dbCourses.find((db) => db.id === guide.offering_id)
        : dbCourses.find((db) =>
            db.name === prefilled.title || findPrefilledCourse(db.name)?.id === prefilled.id,
          );
      if (!manager && !matchedDb) return [];

      return [
        {
          id: matchedDb ? matchedDb.id : prefilled.id,
          source_id: prefilled.sourceId,
          registered: Boolean(matchedDb),
          sort_order: idx + 1,
          program_id: prefilled.programId,
          name: prefilled.title,
          academy: prefilled.academy,
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

  // 원문 16개 목록에 없는 실제 DB 과정도 책임강사의 작업 목록에서 누락하지 않습니다.
  // 관리자 화면은 2026년 원문 이관 대상 16개 과정에 집중하고, 책임강사 화면에서는
  // Supabase가 허용한 모든 실제 과정이 최종 권한 기준입니다.
  if (!manager) {
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
        program_id: "DB",
        name: course.name,
        academy: "등록 과정",
        capacity: null,
        teaching_hours: null,
        starts_on: course.starts_on,
        ends_on: course.ends_on,
        period_label: `${course.starts_on} ~ ${course.ends_on}`,
        time_label: "운영정보 확인",
        location: "운영정보 확인",
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
  }

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
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {result ? "공식 운영결과보고서" : "과정별 운영계획서"}
              </h2>
            </div>
            <a
              className="btn-secondary"
              href={result ? "/forms/operation-result.pdf" : "/forms/operation-plan.pdf"}
              target="_blank"
              rel="noreferrer"
            >
              원본 양식 보기
            </a>
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
