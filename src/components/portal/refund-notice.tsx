import Link from "next/link";
import type { FinanceConfig } from "@/lib/finance/types";
import { isOperationalRefundPolicy } from "@/lib/portal/recruitment-policy";

export function RefundNotice({ tuition, finance = null }: {
  tuition: number | null;
  finance?: FinanceConfig | null;
}) {
  const policy = finance?.valid && isOperationalRefundPolicy(finance) ? finance : null;
  return <section className="panel space-y-4">
    <h2 className="section-title">취소·환불 안내</h2>
    {tuition === 0 ? <p>이 과정은 수강료가 무료이므로 환불할 수강료가 없습니다.</p>
      : tuition === null ? <p>수강료 정보가 등록되지 않았습니다. 취소·환불 안내는 사업단에 문의해 주세요.</p>
        : policy ? <div>
          <p className="mb-2 text-sm text-slate-500">{policy.title} · {policy.version}</p>
          <p className="whitespace-pre-wrap leading-7">{policy.body}</p>
        </div> : <p>승인된 수강료 환불 규정을 확인 중입니다. 신청 전 사업단에 문의해 주세요.</p>}
    <p className="text-sm leading-6 text-slate-600">교육 시작 전 신청 취소는 나의 공간에서 확인해 주세요. 교육 시작 후 취소·환불이나 직접 처리가 어려운 경우 사업단에 문의해 주세요.</p>
    <p className="text-sm leading-6 text-slate-600">자격시험 응시료·자격증 발급비 등 별도 비용이 있는 경우, 해당 기관의 취소·환불 안내를 확인해 주세요.</p>
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
      <Link href="/mypage" className="font-semibold text-teal-800 underline">나의 신청 현황 확인</Link>
      <Link href="/terms#help-title" className="font-semibold text-teal-800 underline">사업단 연락처 확인</Link>
    </div>
  </section>;
}
