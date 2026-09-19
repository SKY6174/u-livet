import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { getOffering, getPolicies } from "@/lib/portal/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { FinanceConfig } from "@/lib/finance/types";
import { applyForCourse } from "@/app/actions";
import { ActionForm } from "@/components/portal/action-form";
import { PageIntro } from "@/components/portal/ui";
export default async function ApplyPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  await requireIdentity(`/offerings/${params.id}/apply`);
  const o = await getOffering(params.id);
  if (!o) notFound();
  const policy = (await getPolicies("ENROLLMENT")).find(
    (p) => p.id === o.enrollment_policy_id,
  );
  const { data: financeData } = await (
    await createServerSupabaseClient()
  ).rpc("life_offering_finance", { f: o.id });
  const finance = financeData as FinanceConfig | null;
  const open =
    o.status === "PUBLISHED" &&
    Date.now() >= Date.parse(o.apply_from) &&
    Date.now() < Date.parse(o.apply_until) &&
    (o.tuition === 0 || !!finance?.valid);
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <PageIntro eyebrow="APPLICATION" title="수강신청">
        {o.name}
      </PageIntro>
      <div className="panel">
        <ActionForm
          action={applyForCourse}
          label="신청서 제출"
          disabled={!policy || !open}
        >
          <input type="hidden" name="offering" value={o.id} />
          <input type="hidden" name="policy" value={policy?.id ?? ""} />
          {o.tuition > 0 && (
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
              <label className="flex items-start gap-3 border-t pt-5">
                <input
                  className="mt-1"
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
