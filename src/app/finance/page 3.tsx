import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageIntro, Empty } from "@/components/portal/ui";
import { FinanceLedger } from "@/components/portal/finance-ledger";
import type { FinanceOverview } from "@/lib/finance/types";
export default async function FinancePage() {
  const me = await requireIdentity("/finance");
  if (!me.roles.some((r) => r.role === "FINANCE")) notFound();
  const { data, error } = await (
    await createServerSupabaseClient()
  ).rpc("life_finance_overview", { as_staff: true });
  const overview = data as FinanceOverview | null;
  return (
    <div className="page-shell">
      <PageIntro eyebrow="FINANCE" title="수납·환불 관리">
        은행 입금을 대사하고 환불 산출·승인·지급 확인을 각각 기록합니다.
      </PageIntro>
      <p className="notice mb-8">
        이 화면은 실제 송금을 실행하지 않습니다. 은행 업무 후 정확한 거래 결과를
        기록하세요. 전체 계좌번호는 입력하지 않습니다.
      </p>
      {error || !overview ? (
        <Empty title="수납 정보를 불러오지 못했습니다" />
      ) : !overview.permissions.length ? (
        <Empty title="유효한 회계 처리 위임이 없습니다">
          기관에서 수납·승인·지급 권한을 각각 확인한 뒤 부여해야 합니다.
        </Empty>
      ) : (
        <FinanceLedger data={overview} me={me.id} staff />
      )}
    </div>
  );
}
