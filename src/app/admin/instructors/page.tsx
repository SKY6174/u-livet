import Link from "next/link";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import { PageIntro, Empty } from "@/components/portal/ui";
import { DossierDetail } from "@/components/portal/instructor-detail";
import {
  reviewLabels,
  type Dossier,
  type InstructorOptions,
} from "@/lib/instructors/types";
export default async function InstructorReview({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; d?: string }>;
}) {
  await requireIdentity("/admin/instructors");
  const q = await searchParams,
    db = await createServerSupabaseClient();
  const result = await db.rpc("life_instructor_options"),
    options = result.data as InstructorOptions | null;
  const orgs = options?.organizations.filter((o) => o.manager) ?? [],
    org = orgs.find((o) => o.id === q.org) ?? orgs[0];
  const list = org
    ? await db.rpc("life_instructor_dossiers", { o: org.id, staff: true })
    : null;
  const detail =
    q.d && UUID.test(q.d)
      ? await db.rpc("life_instructor_dossier", { d: q.d })
      : null;
  const items = (list?.data?.items ?? []) as {
    id: string;
    name: string;
    status: string;
    specialty: string;
    version: number;
    current: boolean;
  }[];
  return (
    <div className="page-shell">
      <Link href="/admin" className="text-sm text-teal-800">
        ← 사업단 관리
      </Link>
      <PageIntro eyebrow="INSTRUCTOR REVIEW" title="강사 이력 심사">
        제출 이력과 외부 증빙을 대조하고 확인 근거·유효기간을 남깁니다.
      </PageIntro>
      <form className="panel mb-6 flex flex-wrap items-end gap-3">
        <label className="field grow">
          담당 기관
          <select name="org" defaultValue={org?.id}>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-secondary">기관 선택</button>
      </form>
      {result.error || list?.error || !org ? (
        <Empty title="담당 기관·심사 목록을 불러오지 못했습니다" />
      ) : q.d ? (
        detail?.error || !detail?.data ? (
          <Empty title="열람 가능한 제출 이력이 없습니다" />
        ) : (
          <DossierDetail
            dossier={detail.data as Dossier}
            policies={options?.policies ?? []}
          />
        )
      ) : (
        <>
          <p className="notice mb-6">
            최근 등록 100건까지 표시합니다. 미제출 초안은 보이지 않습니다.
            승인만으로 위촉·강사 역할·배정이 생성되지 않습니다. 실제 위촉 근거를
            확인한 뒤 별도 권한 등록 절차를 사용하세요.
          </p>
          {!items.length ? (
            <Empty title="제출된 강사 이력이 없습니다" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((x) => (
                <Link
                  key={x.id}
                  className="panel"
                  href={`/admin/instructors?org=${org.id}&d=${x.id}`}
                >
                  <span className="badge">
                    {reviewLabels[x.status]} · v{x.version}
                  </span>
                  <h2 className="mt-3 text-xl font-bold">{x.name}</h2>
                  <p className="mt-2">{x.specialty}</p>
                  <p className="mt-3 text-sm text-teal-800">
                    {x.current ? "확인 유효" : "현재 승인 확인 필요"} · 심사
                    상세 →
                  </p>
                </Link>
              ))}
            </div>
          )}
          {list?.data?.more && (
            <p className="notice mt-4">
              추가 이력이 있습니다. 전체 내역은 사업단 관리 경로에서 확인하세요.
            </p>
          )}
        </>
      )}
    </div>
  );
}
