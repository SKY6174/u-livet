import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { getWorkspaceOfferings, statusLabel } from "@/lib/portal/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageIntro, Empty } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import { createOffering } from "@/app/actions";
export default async function Admin() {
  const me = await requireIdentity("/admin");
  if (!me.roles.some((r) => r.role === "COURSE_MANAGER")) notFound();
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
      <details className="panel">
        <summary className="cursor-pointer text-lg font-bold">
          새 과정·기수 초안 등록
        </summary>
        <div className="mt-6">
          <ActionForm action={createOffering} label="초안 저장">
            <input type="hidden" name="org" value={orgs[0] ?? ""} />
            <div className="grid gap-4 md:grid-cols-2">
              <label className="field">
                사업연도
                <select name="year" required>
                  {(years ?? [])
                    .filter((y) => y.org_id === orgs[0])
                    .map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.label}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field">
                과정명
                <input name="title" maxLength={200} required />
              </label>
              <label className="field">
                아카데미·분야
                <input name="academy" maxLength={100} required />
              </label>
              <label className="field">
                교육장소
                <input name="location" maxLength={200} required />
              </label>
              <label className="field">
                운영방식
                <select name="mode">
                  <option value="OFFLINE">대면</option>
                  <option value="ONLINE">온라인</option>
                  <option value="BLENDED">혼합</option>
                </select>
              </label>
              <label className="field">
                선발방식
                <select name="selection_method">
                  <option value="REVIEW">심사</option>
                  <option value="FIRST_COME">선착순</option>
                </select>
              </label>
              <label className="field">
                정원
                <input
                  type="number"
                  name="capacity"
                  min={1}
                  max={1000}
                  required
                />
              </label>
              <p className="notice self-end">
                기수 초안은 무료로 등록됩니다.
                <br />
                유료 과정은 기수 상세에서 승인된 환불 규정과 납부 안내를
                설정하세요.
              </p>
              {[
                ["apply_from", "접수 시작"],
                ["apply_until", "접수 마감"],
              ].map(([name, label]) => (
                <label key={name} className="field">
                  {label} (한국시간)
                  <input type="datetime-local" name={name} required />
                </label>
              ))}
              {[
                ["starts_on", "교육 시작일"],
                ["ends_on", "교육 종료일"],
              ].map(([name, label]) => (
                <label key={name} className="field">
                  {label}
                  <input type="date" name={name} required />
                </label>
              ))}
            </div>
            <label className="field">
              과정 소개
              <textarea name="summary" rows={3} maxLength={3000} required />
            </label>
            <label className="field">
              교육내용·대상·준비사항
              <textarea name="curriculum" rows={6} maxLength={20000} required />
            </label>
          </ActionForm>
        </div>
      </details>
    </div>
  );
}
