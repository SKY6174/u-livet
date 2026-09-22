import { randomUUID } from "node:crypto";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { ActionForm } from "@/components/portal/action-form";
import { PageIntro } from "@/components/portal/ui";
import { OFFICE_POSITIONS } from "@/lib/auth/login-audience";
import { memberEntryOperator } from "@/lib/members/data";
import { MEMBER_GROUPS, memberGroup } from "@/lib/members/model";
import { createMember } from "../actions";

export default async function NewMember({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await memberEntryOperator();
  const group = memberGroup((await searchParams).group);
  const orgs = me.member_entry_orgs!;
  return <div className="page-shell max-w-5xl">
    <PageIntro eyebrow="NEW MEMBER" title="구성원 수동 등록">입력한 정보는 등록과 동시에 저장됩니다.</PageIntro>
    <nav aria-label="등록할 구성원 구분" className="mb-6 flex flex-wrap gap-2">{Object.entries(MEMBER_GROUPS).map(([key, label]) => <Link key={key} href={`/admin/accounts/new?group=${key}`} aria-current={key === group ? "page" : undefined} className={key === group ? "btn-primary" : "btn-secondary"}>{label}</Link>)}</nav>
    <section className="panel max-w-3xl">
      <h2 className="mb-6 flex items-center gap-2 text-lg font-bold"><UserPlus aria-hidden="true" className="h-5 w-5 text-teal-700" />{MEMBER_GROUPS[group]} 정보</h2>
      <ActionForm key={group} action={createMember} label="구성원 등록" resetOnSuccess={false}>
        <input type="hidden" name="request_id" value={randomUUID()} /><input type="hidden" name="group" value={group} />
        {orgs.length === 1 ? <input type="hidden" name="org_id" value={orgs[0].org_id} /> : <label className="field">소속 사업단<select name="org_id" required>{orgs.map(org => <option key={org.org_id} value={org.org_id}>{org.org_name}</option>)}</select></label>}
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="field">성명 <span className="sr-only">필수</span><input name="name" required maxLength={100} autoComplete="off" placeholder="성명 입력" /></label>
          <label className="field">이메일 <span className="sr-only">필수</span><input name="email" type="email" required maxLength={254} autoComplete="off" placeholder="name@example.com" /></label>
          {group === "office" && <>
            <label className="field">직책<select name="office_position" defaultValue=""><option value="">미등록</option>{Object.entries(OFFICE_POSITIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="field">사무실 전화번호<input name="office_phone" type="tel" maxLength={30} placeholder="052-230-0000" /></label>
          </>}
          {group === "instructor" ? <>
            <label className="field">교내/교외<select name="instructor_kind" required defaultValue="EXTERNAL"><option value="INTERNAL">교내</option><option value="EXTERNAL">교외</option></select></label>
            <label className="field">연락처<input name="instructor_phone" type="tel" maxLength={30} placeholder="010-1234-5678" /><span className="text-xs font-normal text-slate-500">수강생 Q&amp;A 응대가 가능한 번호</span></label>
          </> : <label className="field">핸드폰 전화번호<input name="mobile_phone" type="tel" maxLength={30} placeholder="010-1234-5678" /></label>}
          {group === "learner" && <label className="field">생년월일<input name="birth_date" type="date" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} /></label>}
          <label className="field sm:col-span-2">비고<textarea name="notes" maxLength={2000} rows={4} className="w-full rounded-lg border border-slate-300 p-3 font-normal" placeholder="구성원 관리에 필요한 메모" /></label>
        </div>
        <p className="rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-500">명부에 구성원을 등록합니다. 서비스 이용을 위한 로그인 계정은 별도로 가입해야 합니다.</p>
      </ActionForm>
    </section>
  </div>;
}
