import Link from "next/link";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageIntro, Empty } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import { DevelopmentFilters } from "@/components/portal/development-filters";
import { startDevelopment } from "@/app/instructor-development-actions";
import {
  reviewLabels,
  type DevelopmentBoardData,
  type InstructorOptions,
} from "@/lib/instructors/types";

const PROJECT_YEARS = [2025, 2026, 2027, 2028, 2029] as const;
const ANCHOR_TRACKS = ["ECC", "ICC", "RCC", "AID-X"] as const;
const SANHAK_TRACKS = ["SANHAK_PLANNING", "SANHAK_SUPPORT"] as const;
const ACADEMIES = ["스마트테크", "라이프케어", "로컬창업", "팝업"] as const;
const trackLabel = (track: string | null) =>
  track === "WORKER" ? "재직자 과정" :
  track === "SANHAK_PLANNING" ? "산학기획팀" :
  track === "SANHAK_SUPPORT" ? "산학지원팀" : track ?? "미분류";

export async function DevelopmentBoard({
  orgId,
  year,
  track,
  academy,
  staff,
}: {
  orgId?: string;
  year?: string;
  track?: string;
  academy?: string;
  staff: boolean;
}) {
  await requireIdentity(staff ? "/admin/development" : "/development");
  const db = await createServerSupabaseClient(),
    r = await db.rpc("life_instructor_options"),
    options = r.data as InstructorOptions | null;
  const orgs = (options?.organizations.filter((o) => !staff || o.manager) ?? [])
      .sort((a, b) =>
        (a.slug === "uc-anchor" ? 0 : a.slug === "uc-sanhak" ? 1 : 2) -
        (b.slug === "uc-anchor" ? 0 : b.slug === "uc-sanhak" ? 1 : 2),
      ),
    org = orgs.find((o) => o.id === orgId) ?? orgs[0],
    today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }),
    businessYear = Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 3 ? 1 : 0),
    selectedYear = PROJECT_YEARS.includes(Number(year) as typeof PROJECT_YEARS[number])
      ? Number(year)
      : Math.max(2025, Math.min(2029, businessYear)),
    selectedYearRecord = options?.years.find((y) =>
      y.org_id === org?.id && (y.label === `${selectedYear}년 (${selectedYear - 2024}차년도)`
        || (org?.slug === "uc-anchor" && selectedYear === 2026 && y.label === "2차년도 · 2026")),
    ),
    tracks: string[] = org?.slug === "uc-anchor" ? [...ANCHOR_TRACKS] : org?.slug === "uc-sanhak" ? [...SANHAK_TRACKS] : [],
    selectedTrack = tracks.includes(track ?? "") ? track : undefined,
    selectedAcademy = ACADEMIES.includes(academy as typeof ACADEMIES[number]) ? academy : undefined,
    basePath = staff ? "/admin/development" : "/development";
  const b = org && selectedYearRecord
      ? await db.rpc("life_development_board_classified", {
          o: org.id, staff, y: selectedYearRecord.id, track: selectedTrack ?? null,
          academy: selectedAcademy ?? null,
        })
      : null,
    board = b?.data as DevelopmentBoardData | null;
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="COURSE DEVELOPMENT"
        title={staff ? "과정 개발·심의 관리" : "나의 과정 개발·제안"}
      >
        수요와 역량을 교육과정으로 구체화하고 승인본을 기수 운영에 연결합니다.
      </PageIntro>
      <DevelopmentFilters
        basePath={basePath}
        organizations={orgs}
        organizationId={org?.id ?? ""}
        organizationSlug={org?.slug ?? ""}
        year={selectedYear}
        track={selectedTrack ?? ""}
        academy={selectedAcademy ?? ""}
      />
      {r.error || b?.error || !board || !org || !selectedYearRecord ? (
        <Empty title={selectedYearRecord ? "과정 제안 정보를 불러오지 못했습니다" : "선택한 사업연도가 등록되지 않았습니다"} />
      ) : (
        <>
          {staff && (
            <section className="panel mb-6">
              <h2 className="section-title">{selectedYear}년 ({selectedYear - 2024}차년도) · {selectedTrack ? trackLabel(selectedTrack) : "전체"} · {selectedAcademy ?? "아카데미 전체"} 승인 개발·개편</h2>
              <p className="notice mb-4">
                승인 취소를 제외한 심의 버전 수입니다. 같은 버전의 여러 개설
                기수는 중복하지 않습니다. 공식 RISE 성과 산식과 대외 제출은 별도
                확인합니다.
              </p>
              {board.counts.length ? (
                <div className="space-y-3">
                  {board.counts.map((c) => (
                    <p key={c.project_year_id}>
                      {
                        `${selectedYear}년 (${selectedYear - 2024}차년도)`
                      }{" "}
                      · 신규 {c.new_count}건 · 개편 {c.revision_count}건
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  승인된 개발·개편 기록이 없습니다.
                </p>
              )}
            </section>
          )}
          <h2 className="section-title">{staff ? "제출된 과정 제안" : "내가 작성한 과정"} · {selectedYear}년 · {selectedTrack ? trackLabel(selectedTrack) : "전체"} · {selectedAcademy ?? "아카데미 전체"}</h2>
          {!board.items.length ? (
            <Empty title="과정 제안이 없습니다" />
          ) : (
            <div className="mb-6 grid gap-4 md:grid-cols-2">
              {board.items.map((p) => (
                <Link
                  className="panel"
                  href={`/development/${p.id}`}
                  key={p.id}
                >
                  <span className="badge">
                    {p.revoked_at ? "승인 취소" : reviewLabels[p.status]} · v
                    {p.version}
                  </span>
                  <h3 className="mt-3 text-lg font-bold">
                    {p.title || "과정명 작성 전"}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {trackLabel(p.track)} · {p.name} · 최초 제안: {reviewLabels[p.kind]}
                  </p>
                  <p className="mt-3 text-sm text-teal-800">
                    계획·심의·개설 이력 →
                  </p>
                </Link>
              ))}
            </div>
          )}
          {board.more && (
            <p className="notice mb-4">
              최근 등록 100건을 표시합니다. 추가 기록은 사업단 관리 경로에서
              확인하세요.
            </p>
          )}
          {!staff &&
            (org.proposer ? (
              <section className="panel mt-6">
                <h2 className="section-title">새 과정 제안 시작</h2>
                <ActionForm
                  action={startDevelopment}
                  label="과정 제안 초안 만들기"
                >
                  <input type="hidden" name="o" value={org.id} />
                  <label className="field">
                    개발 귀속 사업연도
                    <select name="y" required defaultValue={selectedYearRecord.id}>
                      <option value="" disabled>
                        연도 선택
                      </option>
                      {options?.years
                        .filter((y) => y.org_id === org.id && PROJECT_YEARS.some((n) =>
                          y.label === `${n}년 (${n - 2024}차년도)` ||
                          (org.slug === "uc-anchor" && n === 2026 && y.label === "2차년도 · 2026")))
                        .sort((a, b) => a.starts_on.localeCompare(b.starts_on))
                        .map((y) => (
                          <option key={y.id} value={y.id}>
                            {Number(y.starts_on.slice(0, 4))}년 ({Number(y.starts_on.slice(0, 4)) - 2024}차년도)
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    주관 구분
                    <select name="track" required defaultValue={selectedTrack ?? ""}>
                      <option value="" disabled>주관 선택</option>
                      {tracks.map((t) => <option key={t} value={t}>{trackLabel(t)}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    개발 구분
                    <select name="kind">
                      <option value="NEW">신규 과정 개발</option>
                      <option value="REVISION">기존 과정 개편</option>
                    </select>
                  </label>
                  <label className="field">
                    개편 대상 과정 (개편 시 선택)
                    <select name="target" defaultValue="">
                      <option value="">신규 개발 · 대상 없음</option>
                      {board.courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="notice">
                    신규 개발은 대상을 비워 두세요. 승인된 개발 기준이 있어야
                    시작할 수 있습니다. 개발 승인 후 기수는 사업단이 별도로
                    개설합니다.
                  </p>
                </ActionForm>
              </section>
            ) : (
              <p className="notice mt-6">
                현재 강사 역할 또는 유효한 이력 확인을 받은 뒤 과정 제안을
                작성할 수 있습니다.{" "}
                <Link
                  className="underline"
                  href={`/mypage/instructor?org=${org.id}`}
                >
                  이력 심사 확인
                </Link>
              </p>
            ))}
        </>
      )}
    </div>
  );
}
