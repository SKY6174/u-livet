import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getOffering,
  getPolicies,
  dateTime,
  modeLabel,
} from "@/lib/portal/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { FinanceConfig } from "@/lib/finance/types";
import { PageIntro } from "@/components/portal/ui";
export default async function OfferingPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const o = await getOffering(params.id);
  if (!o) notFound();
  const policies = await getPolicies();
  const completion = policies.find((p) => p.id === o.completion_policy_id);
  const { data: financeData } = await (
    await createServerSupabaseClient()
  ).rpc("life_offering_finance", { f: o.id });
  const finance = financeData as FinanceConfig | null;
  const { data: instructorData } = await (
    await createServerSupabaseClient()
  ).rpc("life_public_instructors", { f: o.id });
  const instructors = (instructorData ?? []) as {
    name: string;
    specialty: string;
    introduction: string;
  }[];
  const open =
    o.status === "PUBLISHED" &&
    Date.now() >= Date.parse(o.apply_from) &&
    Date.now() < Date.parse(o.apply_until);
  return (
    <div className="page-shell">
      <Link href="/courses" className="mb-6 inline-block text-sm text-teal-800">
        ← 교육과정 목록
      </Link>
      <PageIntro eyebrow={`${o.academy} · ${o.year_label}`} title={o.name}>
        {o.summary}
      </PageIntro>
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_330px]">
        <div className="space-y-6">
          <section className="panel">
            <h2 className="section-title">무엇을 배우나요?</h2>
            <p className="whitespace-pre-wrap">{o.curriculum}</p>
          </section>
          {!!instructors.length && (
            <section className="panel">
              <h2 className="section-title">함께하는 강사</h2>
              <div className="space-y-5">
                {instructors.map((teacher, i) => (
                  <article key={i}>
                    <h3 className="font-bold">{teacher.name}</h3>
                    <p className="mt-1 text-sm text-teal-800">
                      {teacher.specialty}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap">
                      {teacher.introduction}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}
          <section className="panel">
            <h2 className="section-title">수료 안내</h2>
            <p className="whitespace-pre-wrap">
              {completion?.body ?? "수료기준을 확인 중입니다."}
            </p>
          </section>
        </div>
        <aside className="panel space-y-5">
          <dl className="space-y-4 text-sm">
            {[
              ["교육기간", `${o.starts_on} ~ ${o.ends_on}`],
              [
                "접수기간",
                `${dateTime(o.apply_from)} ~ ${dateTime(o.apply_until)}`,
              ],
              ["운영방식", modeLabel[o.mode]],
              ["교육장소", o.location],
              ["모집정원", `${o.capacity}명`],
              [
                "선발방식",
                o.selection_method === "REVIEW"
                  ? "신청 후 심사"
                  : "선착순 · 정원 초과 시 대기",
              ],
              [
                "수강료",
                o.tuition === 0
                  ? "무료"
                  : `${o.tuition.toLocaleString("ko-KR")}원`,
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-slate-500">{k}</dt>
                <dd className="mt-1 font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {finance && (
            <details>
              <summary className="cursor-pointer font-semibold">
                수납·환불 안내
              </summary>
              <p className="mt-3 whitespace-pre-wrap text-sm">{finance.body}</p>
            </details>
          )}
          {open ? (
            <Link
              href={`/offerings/${o.id}/apply`}
              className="btn-primary block text-center"
            >
              수강신청 안내 확인
            </Link>
          ) : (
            <p className="notice">현재 접수 기간이 아닙니다.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
