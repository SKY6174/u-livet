import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import { getManagedInstructorOrganizations } from "@/lib/instructors/organizations";
import { Empty } from "@/components/portal/ui";
import { DossierDetail } from "@/components/portal/instructor-detail";
import {
  reviewLabels,
  type Dossier,
  type InstructorOptions,
  type InstructorPolicy,
} from "@/lib/instructors/types";
import {
  pageNumber,
  type PoolBoard,
  type Allowance,
} from "@/lib/instructors/pool";
import {
  PoolDashboard,
  type PoolQuery,
} from "@/components/instructors/pool-dashboard";
async function Review({
  org,
  policies,
  d,
}: {
  org: string;
  policies: InstructorPolicy[];
  d?: string;
}) {
  const db = await createServerSupabaseClient();
  if (d) {
    if (!UUID.test(d)) notFound();
    const { data, error } = await db.rpc("life_instructor_dossier", { d });
    if (error || !data || data.org_id !== org)
      return <Empty title="열람 가능한 제출 이력이 없습니다" />;
    return (
      <>
        <Link
          className="btn-primary mb-5"
          href={`/admin/instructors/documents?person=${data.person_id}&org=${org}`}
        >
          비공개 서류 확인
        </Link>
        <DossierDetail dossier={data as Dossier} policies={policies} />
      </>
    );
  }
  const { data, error } = await db.rpc("life_instructor_dossiers", {
    o: org,
    staff: true,
  });
  if (error) return <Empty title="심사 목록을 불러오지 못했습니다" />;
  const items = (data?.items ?? []) as {
    id: string;
    name: string;
    status: string;
    specialty: string;
    version: number;
    current: boolean;
  }[];
  return (
    <section className="panel">
      <h2 className="section-title">강사 이력 심사</h2>
      <p className="mb-5 text-sm text-slate-500">
        강사가 제출한 학력·경력·자격 이력을 검토합니다. 신규 강사 등록과 서류
        확인은 강사 마스터에서 진행하세요.
      </p>
      {items.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((x) => (
            <Link
              key={x.id}
              href={`/admin/instructors?org=${org}&tab=review&d=${x.id}`}
              className="rounded-xl border border-slate-200 p-5 hover:border-blue-300"
            >
              <span className="badge">
                {reviewLabels[x.status]} · v{x.version}
              </span>
              <h3 className="mt-3 font-bold">{x.name}</h3>
              <p className="mt-2 text-sm text-slate-600">{x.specialty}</p>
              <p className="mt-3 text-xs text-blue-700">
                {x.current ? "확인 유효" : "검토 필요"} · 상세 →
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <Empty title="심사를 기다리는 제출 이력이 없습니다" />
      )}
      {data?.more && <p className="notice mt-4">최근 100건을 표시합니다.</p>}
    </section>
  );
}
export default async function InstructorPoolPage({
  searchParams,
}: {
  searchParams: Promise<PoolQuery>;
}) {
  const identity = await requireIdentity("/admin/instructors");
  const query = await searchParams,
    db = await createServerSupabaseClient();
  const { organizations: orgs, unavailable } =
    await getManagedInstructorOrganizations(identity);
  const org = orgs.find((o) => o.id === query.org) ?? orgs[0];
  if (unavailable || !org)
    return (
      <div className="page-shell">
        <Empty title="전문가 관리 권한이 있는 담당 기관을 확인해 주세요" />
      </div>
    );
  if (query.person && !UUID.test(query.person)) notFound();
  if (query.d && !UUID.test(query.d)) notFound();
  let detail: Allowance | undefined;
  if (query.allowance) {
    if (!UUID.test(query.allowance)) notFound();
    const result = await db.rpc("life_instructor_allowance_detail", {
      o: org.id,
      a: query.allowance,
    });
    if (result.error || !result.data) notFound();
    detail = result.data as Allowance;
    query.person = detail.person_id;
  }
  const kind = ["ALL", "INTERNAL", "EXTERNAL", "UNSPECIFIED"].includes(
    query.kind ?? "",
  )
    ? query.kind!
    : "ALL";
  const [result, optionsResult] = await Promise.all([
    db.rpc("life_instructor_pool_board", {
      o: org.id,
      q: (query.q ?? "").slice(0, 100),
      kind,
      page: pageNumber(query.page),
      p: query.person ?? null,
      activity_page: pageNumber(query.activity_page),
    }),
    query.d ? db.rpc("life_instructor_options") : Promise.resolve(null),
  ]);
  if (result.error || !result.data)
    return (
      <div className="page-shell">
        <Empty title="강사 대장을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요." />
      </div>
    );
  if (query.d && (optionsResult?.error || !optionsResult?.data))
    return (
      <div className="page-shell">
        <Empty title="심사 기준을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요." />
      </div>
    );
  const policies =
    (optionsResult?.data as InstructorOptions | null)?.policies ?? [];
  const normalized = { ...query, kind, tab: query.d ? "review" : query.tab };
  return (
    <PoolDashboard
      org={org.id}
      orgs={orgs}
      board={{ ...result.data, selected_allowance: detail } as PoolBoard}
      query={normalized}
      review={
        normalized.tab === "review" ? (
          <Review org={org.id} policies={policies} d={query.d} />
        ) : undefined
      }
    />
  );
}
