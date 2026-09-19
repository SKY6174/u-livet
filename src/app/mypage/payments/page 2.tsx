import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageIntro, Empty } from "@/components/portal/ui";
import { FinanceLedger } from "@/components/portal/finance-ledger";
import type { FinanceOverview } from "@/lib/finance/types";
export default async function PaymentsPage() {
  const me = await requireIdentity("/mypage/payments");
  const { data, error } = await (
    await createServerSupabaseClient()
  ).rpc("life_finance_overview", { as_staff: false });
  return (
    <div className="page-shell">
      <PageIntro eyebrow="MY PAYMENTS" title="나의 납부·환불">
        청구와 입금 확인, 적용 환불 규정과 처리 현황을 확인하세요.
      </PageIntro>
      <p className="notice mb-8">
        입금 신고 후 사업단의 확인이 필요합니다. 기한이 지난 입금은 수강이 자동
        확정되지 않으니 사업단에 문의해 주세요. 최근 청구 100건을 표시합니다.
      </p>
      {error || !data ? (
        <Empty title="납부 정보를 불러오지 못했습니다" />
      ) : (
        <FinanceLedger data={data as FinanceOverview} me={me.id} />
      )}
    </div>
  );
}
