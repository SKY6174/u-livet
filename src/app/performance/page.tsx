import Link from "next/link";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageIntro, Empty } from "@/components/portal/ui";
import type { PerformanceYear } from "@/lib/performance/types";
export default async function Performance() {
  await requireIdentity("/performance");
  const { data, error } = await (
    await createServerSupabaseClient()
  ).rpc("life_performance_options");
  const years = (data ?? []) as PerformanceYear[];
  return (
    <div className="page-shell">
      <PageIntro eyebrow="QUALITY & PERFORMANCE" title="연차 평가·성과 관리">
        사업연도별 운영 현황과 과정 개선, 등록 지표의 보고 이력을 확인합니다.
      </PageIntro>
      {error ? (
        <Empty title="사업연도를 불러오지 못했습니다" />
      ) : !years.length ? (
        <Empty title="조회 가능한 사업연도가 없습니다">
          기관의 과정담당 또는 성과담당 역할이 필요합니다.
        </Empty>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {years.map((y) => (
            <Link className="panel" key={y.id} href={"/performance/" + y.id}>
              <span className="badge">{y.org_name}</span>
              <h2 className="mt-3 text-xl font-bold">{y.label}</h2>
              <p className="mt-2 text-sm text-slate-500">
                {y.starts_on} ~ {y.ends_on}
              </p>
              <p className="mt-5 text-teal-800">운영 통계·지표·보고 보기 →</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
