import Link from "next/link";
import { getPolicies, statusLabel, dateTime } from "@/lib/portal/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Empty } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import {
  decideApplication,
  publishOffering,
} from "@/app/actions";
import { configureFinance } from "@/app/finance-actions";
import type { FinanceConfig } from "@/lib/finance/types";
import { CourseHeader } from "@/components/course-workspace/course-header";
import { ResponsibleInstructorSection } from "@/components/course-workspace/responsible-instructor-section";
import { getManagedCourse } from "@/lib/course-workspace/data";
import type { RosterRow } from "@/lib/portal/types";
export default async function ManageOffering(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const { offering: o, workspace } = await getManagedCourse(params.id);
  if (o.status === "ARCHIVED")
    return (
      <div className="page-shell">
        <CourseHeader
          offering={o}
          active="manage"
          operator={workspace?.operator}
        />
        <ResponsibleInstructorSection offeringId={o.id} />
        <section className="panel space-y-4">
          <h2 className="section-title">운영이 완료된 보관 과정입니다</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            원본 결과보고서의 교육기간·장소·정원을 기준으로 보관하고 있습니다.
            보고서 내용과 지급 자료는 결과보고서 메뉴에서 확인·보완할 수
            있습니다.
          </p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">교육장소</dt>
              <dd className="mt-1 font-semibold">{o.location}</dd>
            </div>
            <div>
              <dt className="text-slate-500">정원</dt>
              <dd className="mt-1 font-semibold">{o.capacity}명</dd>
            </div>
          </dl>
          <Link
            href={`/admin/offerings/${o.id}/reports`}
            className="btn-primary"
          >
            원본·보고서 확인
          </Link>
        </section>
      </div>
    );
  const [{ data, error }, policies, financeResult] =
    await Promise.all([
      (await createServerSupabaseClient()).rpc("life_roster", { f: o.id }),
      getPolicies(),
      (await createServerSupabaseClient()).rpc("life_offering_finance", {
        f: o.id,
      }),
    ]);
  const finance = financeResult.data as FinanceConfig | null;
  return (
    <div className="page-shell">
      <CourseHeader
        offering={o}
        active="manage"
        operator={workspace?.operator}
      />
      <section className="panel mb-8">
        <h2 className="section-title">수강료·환불 규정</h2>
        <p className="mb-4">
          {o.tuition === null
            ? "수강료: 원본 미기재"
            : `현재 수강료 ${o.tuition.toLocaleString("ko-KR")}원`}
          {finance ? ` · ${finance.title} ${finance.version}` : ""}
        </p>
        {o.status === "DRAFT" ? (
          <details>
            <summary className="cursor-pointer font-semibold">
              유료 과정 설정
            </summary>
            <div className="mt-4">
              <ActionForm
                action={configureFinance}
                label="수강료·납부 안내 저장"
              >
                <input type="hidden" name="f" value={o.id} />
                <label className="field">
                  수강료 (원)
                  <input
                    type="number"
                    name="tuition"
                    min={1}
                    max={100000000}
                    defaultValue={o.tuition || undefined}
                    required
                  />
                </label>
                <label className="field">
                  환불 규정
                  <select
                    name="policy"
                    required
                    defaultValue={finance?.policy_id ?? ""}
                  >
                    <option value="" disabled>
                      승인 규정 선택
                    </option>
                    {policies
                      .filter(
                        (p) => p.org_id === o.org_id && p.kind === "REFUND",
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} · {p.version}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field">
                  선발 후 납부기한 (시간)
                  <input
                    type="number"
                    name="hours"
                    min={1}
                    max={720}
                    defaultValue={finance?.reservation_hours}
                    required
                  />
                </label>
                <p className="text-sm text-slate-600">
                  실제 납부기한은 교육 시작 자정을 넘지 않습니다. 기한까지
                  좌석을 예약합니다.
                </p>
                <label className="field">
                  기관이 승인한 납부 안내
                  <textarea
                    name="instructions"
                    maxLength={3000}
                    defaultValue={finance?.instructions}
                    required
                    rows={3}
                  />
                </label>
                <p className="notice">
                  환불 규정과 조항별 계산 기준이 등록되어 있어야 저장할 수
                  있습니다. 공개 후에는 수강료·규정을 변경할 수 없습니다.
                </p>
              </ActionForm>
            </div>
          </details>
        ) : (
          <p className="whitespace-pre-wrap text-sm">
            {finance?.instructions ??
              (o.tuition === null
                ? "기존 운영 결과보고서를 보관하는 과정입니다. 모집·납부를 진행하지 않습니다."
                : "무료 과정입니다.")}
          </p>
        )}
      </section>
      <ResponsibleInstructorSection offeringId={o.id} />
      {o.status === "DRAFT" && (
        <section className="panel mb-8">
          <h2 className="section-title">모집 공개</h2>
          <p className="mb-4 text-sm text-slate-600">
            과정 내용과 아래 승인 정책을 확인한 뒤 공개하세요. 정책 원문은
            승인된 버전으로 보존됩니다.
          </p>
          <p className="mb-4 whitespace-pre-wrap">{o.curriculum}</p>
          <ActionForm action={publishOffering} label="과정 승인·모집 공개">
            <input type="hidden" name="offering" value={o.id} />
            {[
              ["enrollment_policy", "ENROLLMENT", "모집·수집이용 정책"],
              ["completion_policy", "COMPLETION", "수료기준"],
            ].map(([name, kind, label]) => (
              <label key={name} className="field">
                {label}
                <select name={name} required defaultValue="">
                  <option value="" disabled>
                    승인 정책 선택
                  </option>
                  {policies
                    .filter((p) => p.org_id === o.org_id && p.kind === kind)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} · {p.version}
                      </option>
                    ))}
                </select>
              </label>
            ))}
          </ActionForm>
        </section>
      )}
      <h2 className="section-title scroll-mt-6" id="applications">
        신청 심사
      </h2>
      {error ? (
        <Empty title="신청 내역을 불러오지 못했습니다" />
      ) : !data?.length ? (
        <Empty title="접수된 신청이 없습니다" />
      ) : (
        <div className="space-y-4">
          {(data as RosterRow[]).map((r) => (
            <article
              key={r.application_id}
              className="panel flex flex-wrap justify-between gap-5"
            >
              <div className="min-w-0">
                <h3 className="break-words text-xl font-bold">{r.name}</h3>
                <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-4 text-base">
                  <div><dt className="text-sm text-slate-600">신청 상태</dt><dd className="mt-1"><span className="badge">{statusLabel[r.status] ?? r.status}</span></dd></div>
                  <div><dt className="text-sm text-slate-600">신청일시</dt><dd className="mt-1 font-medium">{dateTime(r.submitted_at)}</dd></div>
                </dl>
              </div>
              {["SUBMITTED", "WAITLISTED"].includes(r.status) && (
                <ActionForm action={decideApplication} label="심사 결과 저장">
                  <input
                    type="hidden"
                    name="application"
                    value={r.application_id}
                  />
                  <label className="field">
                    결정
                    <select name="decision" required>
                      <option value="ACCEPTED">
                        {o.tuition !== null && o.tuition > 0
                          ? "선발 · 납부 대기"
                          : "수강 확정"}
                      </option>
                      <option value="REJECTED">미선정</option>
                    </select>
                  </label>
                </ActionForm>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
