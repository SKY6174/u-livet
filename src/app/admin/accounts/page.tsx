import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OFFICE_POSITIONS, type OfficePosition } from "@/lib/auth/login-audience";
import { ActionForm } from "@/components/portal/action-form";
import { PageIntro, Empty } from "@/components/portal/ui";
import { saveAccountClassification } from "./actions";

type Account = { person_id: string; name: string; email: string; roles: string[]; office_position: OfficePosition | null; instructor_kind: string | null };
export default async function AccountClassifications() {
  const me = await requireIdentity("/admin/accounts");
  if (!me.roles.some(r => r.role === "SYSTEM_ADMIN")) notFound();
  const result = await (await createServerSupabaseClient()).rpc("life_manageable_accounts");
  const accounts = (result.data ?? []) as Account[];
  return <div className="page-shell">
    <PageIntro eyebrow="ACCOUNTS" title="사업단 직책·강사 구분 관리">
      등록된 업무 계정의 직책과 강사 구분을 관리합니다. 업무 권한은 기존 승인 내역을 따릅니다.
    </PageIntro>
    {result.error ? <Empty title="계정 목록을 불러오지 못했습니다" /> : <ul aria-label="업무 계정 목록" className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {accounts.map(account => <li className="p-5 sm:px-6" key={account.person_id}>
        <ActionForm action={saveAccountClassification} label="구분 저장" resetOnSuccess={false}
          className="grid min-w-0 items-end gap-4 lg:grid-cols-[minmax(12rem,1fr)_minmax(16rem,1.2fr)_auto] [&>button]:justify-self-start lg:[&>p]:col-span-full lg:[&>a]:col-span-full">
          <input type="hidden" name="person_id" value={account.person_id} />
          <div className="min-w-0 lg:self-center">
            <h2 className="break-words text-lg font-bold">{account.name}</h2>
            <p className="mt-1 break-all text-sm text-slate-600">{account.email}</p>
          </div>
          <div className={`grid min-w-0 gap-3 ${account.roles.includes("INSTRUCTOR") && account.roles.some(role => role !== "INSTRUCTOR") ? "sm:grid-cols-2" : ""}`}>
            {account.roles.some(role => role !== "INSTRUCTOR") && <label className="field">사업단 직책
              <select name="office_position" defaultValue={account.office_position ?? ""}>
                <option value="">미등록</option>
                {Object.entries(OFFICE_POSITIONS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>}
            {account.roles.includes("INSTRUCTOR") && <label className="field">강사 구분
              <select name="instructor_kind" defaultValue={account.instructor_kind ?? ""} required>
                <option value="" disabled>구분 선택</option>
                <option value="INTERNAL">교내 강사</option><option value="EXTERNAL">교외 강사</option>
              </select>
            </label>}
          </div>
        </ActionForm>
      </li>)}
    </ul>}
  </div>;
}
