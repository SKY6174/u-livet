import Link from "next/link";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageIntro, Empty } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import { startDevelopment } from "@/app/instructor-development-actions";
import {
  reviewLabels,
  type DevelopmentBoardData,
  type InstructorOptions,
} from "@/lib/instructors/types";
export async function DevelopmentBoard({
  orgId,
  staff,
}: {
  orgId?: string;
  staff: boolean;
}) {
  await requireIdentity(staff ? "/admin/development" : "/development");
  const db = await createServerSupabaseClient(),
    r = await db.rpc("life_instructor_options"),
    options = r.data as InstructorOptions | null;
  const orgs = options?.organizations.filter((o) => !staff || o.manager) ?? [],
    org = orgs.find((o) => o.id === orgId) ?? orgs[0];
  const b = org
      ? await db.rpc("life_development_board", { o: org.id, staff })
      : null,
    board = b?.data as DevelopmentBoardData | null;
  return (
    <div className="page-shell">
      <Link
        href={staff ? "/admin" : "/mypage/instructor"}
        className="text-sm text-teal-800"
      >
        ← {staff ? "사업단 관리" : "강사 이력"}
      </Link>
      <PageIntro
        eyebrow="COURSE DEVELOPMENT"
        title={staff ? "과정 개발·심의 관리" : "나의 과정 개발·제안"}
      >
        수요와 역량을 교육과정으로 구체화하고 승인본을 기수 운영에 연결합니다.
      </PageIntro>
      <form className="panel mb-6 flex flex-wrap items-end gap-3">
        <label className="field grow">
          기관
          <select name="org" defaultValue={org?.id}>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-secondary">기관 선택</button>
      </form>
      {r.error || b?.error || !board || !org ? (
        <Empty title="과정 제안 정보를 불러오지 못했습니다" />
      ) : (
        <>
          {staff && (
            <section className="panel mb-6">
              <h2 className="section-title">사업연도별 승인 개발·개편</h2>
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
                        options?.years.find((y) => y.id === c.project_year_id)
                          ?.label
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
          <h2 className="section-title">
            {staff ? "제출된 과정 제안" : "내가 작성한 과정"}
          </h2>
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
                    {p.name} · 최초 제안: {reviewLabels[p.kind]}
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
                    <select name="y" required defaultValue="">
                      <option value="" disabled>
                        연도 선택
                      </option>
                      {options?.years
                        .filter((y) => y.org_id === org.id)
                        .map((y) => (
                          <option key={y.id} value={y.id}>
                            {y.label}
                          </option>
                        ))}
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
