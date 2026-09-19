import Link from "next/link";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import { PageIntro, Empty } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import {
  DossierDetail,
  PolicyChoice,
} from "@/components/portal/instructor-detail";
import { startDossier } from "@/app/instructor-development-actions";
import type { Dossier, InstructorOptions } from "@/lib/instructors/types";
export default async function InstructorProfile({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  await requireIdentity("/mypage/instructor");
  const q = await searchParams,
    db = await createServerSupabaseClient();
  const result = await db.rpc("life_instructor_options");
  const options = result.data as InstructorOptions | null;
  if (result.error || !options)
    return (
      <div className="page-shell">
        <Empty title="강사 이력 정보를 불러오지 못했습니다" />
      </div>
    );
  const org =
    options.organizations.find((o) => o.id === q.org) ??
    options.organizations[0];
  const list = org
    ? await db.rpc("life_instructor_dossiers", { o: org.id, staff: false })
    : null;
  const id = list?.data?.items?.[0]?.id;
  const detail =
    id && UUID.test(id)
      ? await db.rpc("life_instructor_dossier", { d: id })
      : null;
  return (
    <div className="page-shell">
      <Link href="/mypage" className="text-sm text-teal-800">
        ← 나의 공간
      </Link>
      <PageIntro eyebrow="MY TEACHING PROFILE" title="강사 이력·심사">
        전문분야와 이력을 제출하고 사업단 확인 결과를 확인하세요.
      </PageIntro>
      <div className="mb-6 flex flex-wrap gap-3">
        <Link href="/development" className="btn-secondary">
          과정 개발·제안
        </Link>
        <Link href="/instructor/records" className="btn-secondary">
          강의실적·경력증명
        </Link>
      </div>
      <form className="panel mb-6 flex flex-wrap items-end gap-3">
        <label className="field grow">
          신청 기관
          <select name="org" defaultValue={org?.id}>
            {options.organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-secondary">기관 선택</button>
      </form>
      {list?.error || detail?.error ? (
        <Empty title="이력 상세를 불러오지 못했습니다" />
      ) : detail?.data ? (
        <DossierDetail
          dossier={detail.data as Dossier}
          policies={options.policies}
        />
      ) : org ? (
        <section className="panel">
          <h2 className="section-title">강사 이력 등록 시작</h2>
          <p className="notice mb-5">
            심사 기준 등록 후 사용할 수 있습니다. 이력 심사와 실제 위촉·배정은
            별도이며, 지급 계좌·신분증은 이곳에서 수집하지 않습니다.
          </p>
          <ActionForm action={startDossier} label="이력 초안 만들기">
            <input type="hidden" name="o" value={org.id} />
            <PolicyChoice
              policies={options.policies.filter(
                (p) => p.org_id === org.id && p.kind === "INSTRUCTOR_PRIVACY",
              )}
              name="privacy"
              label="강사 이력 개인정보 안내"
            />
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="confirmed" required />
              수집 항목·목적·보유기간과 권리 안내를 확인하고 동의합니다.
            </label>
          </ActionForm>
        </section>
      ) : (
        <Empty title="등록된 기관이 없습니다" />
      )}
    </div>
  );
}
