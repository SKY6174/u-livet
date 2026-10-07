import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { dateTime, getOffering, getPolicies } from "@/lib/portal/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { FinanceConfig } from "@/lib/finance/types";
import { applyForCourse } from "@/app/actions";
import { ActionForm } from "@/components/portal/action-form";
import { PageIntro } from "@/components/portal/ui";
import { DocumentPopup } from "@/components/instructor-documents/document-popup";
import { applicationDocumentHref } from "@/lib/learner-documents/model";
export default async function ApplyPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  await requireIdentity(`/offerings/${params.id}/apply`);
  const o = await getOffering(params.id);
  if (!o) notFound();
  const db = await createServerSupabaseClient();
  const [policies, { data: financeData }] = await Promise.all([
    getPolicies("ENROLLMENT", o.enrollment_policy_id),
    db.rpc("life_offering_finance", { f: o.id }),
  ]);
  const policy = policies.find(
    (p) => p.id === o.enrollment_policy_id,
  );
  const finance = financeData as FinanceConfig | null;
  const open =
    o.status === "PUBLISHED" &&
    !!o.apply_from && !!o.apply_until &&
    Date.now() >= Date.parse(o.apply_from) &&
    Date.now() < Date.parse(o.apply_until) &&
    (o.tuition === 0 || !!finance?.valid);
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <PageIntro eyebrow="APPLICATION" title="수강신청">
        {o.name}
      </PageIntro>
      <section className="panel mb-6" aria-labelledby="application-info-title">
        <h2 id="application-info-title" className="section-title">신청 전 확인하세요</h2>
        <dl className="grid gap-5 text-base sm:grid-cols-2">
          <div><dt className="text-sm text-slate-600">교육기간</dt><dd className="mt-1 font-semibold">{o.starts_on} ~ {o.ends_on}</dd></div>
          <div><dt className="text-sm text-slate-600">수강료</dt><dd className="mt-1 font-semibold">{o.tuition === null ? "별도 안내 확인" : o.tuition === 0 ? "무료" : `${o.tuition.toLocaleString("ko-KR")}원`}</dd></div>
          <div className="sm:col-span-2"><dt className="text-sm text-slate-600">신청기간</dt><dd className="mt-1 font-semibold">{dateTime(o.apply_from)} ~ {dateTime(o.apply_until)}</dd></div>
        </dl>
        <DocumentPopup href={applicationDocumentHref(o.id)} windowName="learner-documents" className="btn-primary mt-6">이 과정의 수강신청원서 작성</DocumentPopup>
      </section>
      <div className="panel">
        <ActionForm
          action={applyForCourse}
          label="신청서 제출"
          disabled={!policy || !open}
        >
          <input type="hidden" name="offering" value={o.id} />
          <input type="hidden" name="policy" value={policy?.id ?? ""} />
          {o.tuition !== null && o.tuition > 0 && (
            <div className="notice">
              <p className="font-bold">
                수강료 {o.tuition.toLocaleString("ko-KR")}원 · 선발 후 입금 확인
                시 수강 확정
              </p>
              <p className="mt-2">
                {finance?.title} · {finance?.version}
              </p>
              <p className="whitespace-pre-wrap mt-2">{finance?.body}</p>
              <p className="mt-2">
                선발 후 {finance?.reservation_hours}시간 이내, 교육 시작 전까지
                납부해야 합니다. 정확한 기한은 청구에서 확인하세요.
              </p>
            </div>
          )}
          <h2 className="section-title">모집·개인정보 수집 안내</h2>
          {policy ? (
            <>
              <p className="text-sm text-slate-500">
                {policy.title} · {policy.version}
              </p>
              <p className="whitespace-pre-wrap">{policy.body}</p>
              <label className="flex min-h-12 items-start gap-3 border-t py-5 text-base leading-relaxed">
                <input
                  className="mt-1 h-5 w-5 shrink-0"
                  type="checkbox"
                  name="consent"
                  required
                />
                <span>
                  [필수] 위 수강료·환불 규정 및 신청 안내와 개인정보 수집·이용
                  내용을 확인하고 동의합니다.
                </span>
              </label>
            </>
          ) : (
            <p className="notice">신청 안내를 준비하고 있습니다.</p>
          )}
          {!open && (
            <p className="notice">
              현재 신청을 접수할 수 없습니다. 모집 기간과 수강료 안내를 확인해
              주세요.
            </p>
          )}
        </ActionForm>
        <Link
          href="/mypage"
          className="mt-6 inline-block text-teal-800 underline"
        >
          나의 신청 현황 확인 →
        </Link>
      </div>
    </div>
  );
}
