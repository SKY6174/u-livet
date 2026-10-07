import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/portal/action-form";
import { PageIntro, Empty } from "@/components/portal/ui";
import { approvePolicyDraft, createPolicyDraft, updatePolicyDraft } from "@/app/policy-actions";

type PolicyRow = {
  id: string;
  org_id: string;
  kind: "ENROLLMENT" | "COMPLETION";
  status: "DRAFT" | "APPROVED";
  title: string;
  version: string;
  body: string;
  approved_at: string | null;
};

const POLICY_GUIDES = {
  ENROLLMENT: {
    label: "모집·개인정보 수집·이용 안내",
    items: [
      "신청 자격, 모집기간·정원, 선발 방법과 결과 안내, 취소·문의 경로",
      "개인정보 처리 주체와 수집·이용 목적, 필요한 항목, 보유·이용기간",
      "동의를 받는 경우 거부할 권리와 거부 시 불이익; 제3자 제공·선택 동의는 필요한 경우 별도 구분",
    ],
  },
  COMPLETION: {
    label: "수료기준",
    items: [
      "인정 출석률과 지각·조퇴·결석·보강의 계산 방법",
      "과제·시험·실습 등 평가 항목별 통과 기준과 재평가·미제출 처리",
      "최종 판정·이의신청 절차, 수료증 발급 조건과 결과 통지 시점",
    ],
  },
} as const;

export default async function PolicyManagement({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const me = await requireIdentity("/admin/policies");
  const orgIds = Array.from(new Set(me.roles.filter((role) => role.role === "COURSE_MANAGER").map((role) => role.org_id)));
  if (!orgIds.length) notFound();
  const params = await searchParams;
  const orgId = params.org && orgIds.includes(params.org) ? params.org : orgIds[0];
  const db = await createServerSupabaseClient();
  const [{ data: organizations }, { data: rows, error }] = await Promise.all([
    db.from("life_organizations").select("id,name").in("id", orgIds),
    db.from("life_policy_versions")
      .select("id,org_id,kind,status,title,version,body,approved_at")
      .eq("org_id", orgId)
      .in("kind", ["ENROLLMENT", "COMPLETION"])
      .order("effective_from", { ascending: false }),
  ]);
  const policies = (rows ?? []) as PolicyRow[];
  const orgName = organizations?.find((org) => org.id === orgId)?.name ?? "담당 조직";

  return (
    <div className="page-shell">
      <PageIntro eyebrow="POLICIES" title="모집·수료 정책 관리">
        {orgName}의 모집 공개 전에 문안을 작성하고 기관 검토를 거쳐 승인하세요.
      </PageIntro>
      {orgIds.length > 1 && (
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="정책 관리 조직">
          {orgIds.map((id) => (
            <Link key={id} href={`/admin/policies?org=${id}`}
              className={id === orgId ? "btn-primary" : "btn-secondary"}>
              {organizations?.find((org) => org.id === id)?.name ?? "조직"}
            </Link>
          ))}
        </nav>
      )}
      <div className="notice mb-8 space-y-2">
        <p className="font-bold">작성 → 기관 문안 검토 → 승인 → 과정의 모집 공개에서 선택</p>
        <p>승인 전 초안은 공개 선택지에 나오지 않습니다. 승인된 원문은 신청·수료 근거로 보존되며 수정할 수 없습니다. 바뀐 내용은 새 버전으로 작성하세요.</p>
        <p>검증용 정책은 실제 모집에 사용하지 마세요. 기관의 개인정보 담당자와 과정 책임자가 목적·보유기간·수료 수치를 확정해야 합니다.</p>
      </div>
      {error && <Empty title="정책 목록을 불러오지 못했습니다" />}
      {!error && (["ENROLLMENT", "COMPLETION"] as const).map((kind) => {
        const guide = POLICY_GUIDES[kind];
        const own = policies.filter((policy) => policy.kind === kind);
        return (
          <section key={kind} className="panel mb-8">
            <h2 className="section-title">{guide.label}</h2>
            <ul className="mb-6 list-disc space-y-1 pl-6 text-sm leading-relaxed text-slate-700">
              {guide.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
            {kind === "COMPLETION" && (
              <p className="mb-6 text-sm text-slate-600">공개하는 수료 문안과 실제 수료 계산 기준은 일치해야 합니다. 출석률·평가점수의 계산 규칙은 과정의 수료 검토 화면에서 별도로 제안·승인합니다.</p>
            )}
            <details className="mb-8 rounded-xl border border-slate-200 p-5">
              <summary className="cursor-pointer font-semibold">새 버전 초안 작성</summary>
              <ActionForm action={createPolicyDraft} label="초안 저장" className="mt-5 space-y-4">
                <input type="hidden" name="org_id" value={orgId} />
                <input type="hidden" name="policy_kind" value={kind} />
                <label className="field">버전
                  <input name="policy_version" required maxLength={50} placeholder="예: 2026-1" />
                </label>
                <label className="field">정책 제목
                  <input name="policy_title" required minLength={3} maxLength={120} placeholder={guide.label} />
                </label>
                <label className="field">정책 원문
                  <textarea name="policy_body" required minLength={20} maxLength={20000} rows={12}
                    placeholder={guide.items.join("\n\n")} />
                </label>
                <p className="text-sm text-slate-600">위 항목은 작성 안내입니다. 실제 기준·기간·항목을 확인해 원문으로 작성하세요.</p>
              </ActionForm>
            </details>
            <h3 className="mb-4 text-lg font-bold">등록된 버전 {own.length}건</h3>
            {!own.length ? <p className="text-sm text-slate-600">아직 등록된 정책이 없습니다.</p> : (
              <div className="space-y-4">
                {own.map((policy) => (
                  <article key={policy.id} className="rounded-xl border border-slate-200 p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <h4 className="font-bold">{policy.title} · {policy.version}</h4>
                      <span className="badge">{policy.status === "APPROVED" ? "승인됨" : "초안"}</span>
                      {policy.title.startsWith("[검증용]") && <span className="text-sm font-semibold text-amber-800">검증용 · 실제 모집 사용 금지</span>}
                    </div>
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-semibold text-teal-800">원문 확인</summary>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{policy.body}</p>
                    </details>
                    {policy.status === "DRAFT" && (
                      <div className="mt-5 grid gap-5 border-t border-slate-200 pt-5 lg:grid-cols-2">
                        <details>
                          <summary className="cursor-pointer font-semibold">초안 수정</summary>
                          <ActionForm action={updatePolicyDraft} label="수정 저장" className="mt-4 space-y-4">
                            <input type="hidden" name="org_id" value={orgId} />
                            <input type="hidden" name="policy_id" value={policy.id} />
                            <input type="hidden" name="expected_title" value={policy.title} />
                            <input type="hidden" name="expected_body" value={policy.body} />
                            <label className="field">제목<input name="policy_title" defaultValue={policy.title} required minLength={3} maxLength={120} /></label>
                            <label className="field">원문<textarea name="policy_body" defaultValue={policy.body} required minLength={20} maxLength={20000} rows={9} /></label>
                          </ActionForm>
                        </details>
                        <div>
                          <p className="font-semibold">기관 검토 후 승인</p>
                          <p className="mt-2 text-sm text-slate-600">승인하면 원문을 수정할 수 없으며 모집 공개에서 선택할 수 있습니다. 내용과 버전을 다시 확인하세요.</p>
                          <ActionForm action={approvePolicyDraft} label="이 버전 승인" className="mt-4 space-y-4">
                            <input type="hidden" name="org_id" value={orgId} />
                            <input type="hidden" name="policy_id" value={policy.id} />
                            <input type="hidden" name="expected_title" value={policy.title} />
                            <input type="hidden" name="expected_body" value={policy.body} />
                            <label className="flex items-start gap-2 text-sm leading-relaxed"><input type="checkbox" name="review_confirmed" required className="mt-1" />기관의 문안 검토와 승인 절차를 완료했습니다.</label>
                          </ActionForm>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
