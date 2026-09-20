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
    <p className="mb-6 rounded-xl bg-teal-50 p-5 text-base leading-7">교내 강사는 학교 이메일과 U-LIFE 전용 비밀번호를 사용합니다. 교외 강사는 간편 로그인도 이용할 수 있습니다. 사업단 직책은 단장·센터장·연구원으로 표시되며, 미등록 직책은 기존 역할 이름으로 표시됩니다.</p>
    {result.error ? <Empty title="계정 목록을 불러오지 못했습니다" /> : <div className="grid gap-5 lg:grid-cols-2">
      {accounts.map(account => <article className="panel" key={account.person_id}>
        <h2 className="text-xl font-bold">{account.name}</h2>
        <p className="mt-2 break-all text-slate-600">{account.email}</p>
        <ActionForm action={saveAccountClassification} label="구분 저장" resetOnSuccess={false}>
          <input type="hidden" name="person_id" value={account.person_id} />
          {account.roles.some(role => role !== "INSTRUCTOR") && <label className="field mt-5">사업단 직책
            <select name="office_position" defaultValue={account.office_position ?? ""}>
              <option value="">미등록</option>
              {Object.entries(OFFICE_POSITIONS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>}
          {account.roles.includes("INSTRUCTOR") && <label className="field mt-5">강사 구분
            <select name="instructor_kind" defaultValue={account.instructor_kind ?? ""} required>
              <option value="" disabled>구분 선택</option>
              <option value="INTERNAL">교내 강사</option><option value="EXTERNAL">교외 강사</option>
            </select>
          </label>}
        </ActionForm>
      </article>)}
    </div>}
  </div>;
}
