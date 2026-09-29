import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { History, Pencil, Trash2 } from "lucide-react";
import { OFFICE_POSITIONS } from "@/lib/auth/login-audience";
import { UUID } from "@/lib/portal/data";
import { PageIntro, Empty } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import { getMembers, getMemberHistory, memberAdmin } from "@/lib/members/data";
import { HISTORY_STATUS, memberGroup, memberPage, displayPhone } from "@/lib/members/model";
import { saveMember, deleteMember } from "../actions";

export default async function MemberDetail({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await memberAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const query = await searchParams;
  const group = memberGroup(query.group);
  const view = query.view === "delete" ? "delete" : query.view === "history" && group !== "office" ? "history" : "edit";
  const { data, error } = await getMembers(group, "", 1, id);
  if (error || !data) return <div className="page-shell"><Empty title="구성원 정보를 불러오지 못했습니다" /></div>;
  const member = data.items[0];
  if (!member) notFound();
  const isAdmin = me.roles.some(role => role.role === "SYSTEM_ADMIN");
  const canEdit = isAdmin && (member.can_edit ?? member.can_manage ?? true);
  const canDelete = isAdmin && member.can_manage !== false && !member.is_super_admin && member.id !== me.id;
  if ((view === "edit" && !canEdit) || (view === "delete" && !canDelete)) notFound();
  const page = memberPage(query.page);
  const history = view === "history" ? await getMemberHistory(id, group, page) : null;
  const detail = `/admin/accounts/${id}?group=${group}`;
  if (history?.data && page > Math.max(1, Math.ceil(history.data.total / 20))) {
    redirect(`${detail}&view=history&page=${Math.max(1, Math.ceil(history.data.total / 20))}`);
  }
  const historyName = group === "instructor" ? "강의이력" : "수강이력";
  return <div className="page-shell">
    <PageIntro eyebrow="MEMBERS" title={`${member.name} · ${view === "delete" ? "구성원 삭제" : view === "history" ? historyName : "구성원 수정"}`}>{member.email || "이메일 미등록"}</PageIntro>
    <nav aria-label="구성원 관리" className="mb-6 flex flex-wrap gap-2">
      {canEdit && <Link className={view === "edit" ? "btn-primary gap-2" : "btn-secondary gap-2"} href={detail} aria-current={view === "edit" ? "page" : undefined}><Pencil aria-hidden="true" className="h-4 w-4" />정보 수정</Link>}
      {group !== "office" && <Link className={view === "history" ? "btn-primary gap-2" : "btn-secondary gap-2"} href={`${detail}&view=history`} aria-current={view === "history" ? "page" : undefined}><History aria-hidden="true" className="h-4 w-4" />{historyName}</Link>}
      {canDelete && <Link className="btn-secondary gap-2 text-rose-700" href={`${detail}&view=delete`} aria-current={view === "delete" ? "page" : undefined}><Trash2 aria-hidden="true" className="h-4 w-4" />삭제</Link>}
    </nav>
    {view === "edit" && <section className="panel max-w-3xl">
      <ActionForm action={saveMember} label="변경사항 저장" resetOnSuccess={false}>
        <input type="hidden" name="person_id" value={id} /><input type="hidden" name="group" value={group} /><input type="hidden" name="revision" value={member.revision} />
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="field">성명<input name="name" defaultValue={member.name} required maxLength={100} autoComplete="off" /></label>
          <label className="field">이메일(아이디)<input value={member.email || ""} readOnly className="bg-slate-50 text-slate-500" /><span className="text-xs font-normal text-slate-500">{member.is_manual ? "수동 등록된 이메일입니다. 로그인 계정은 별도로 가입해야 합니다." : "인증된 로그인 아이디로, 이 화면에서는 변경되지 않습니다."}</span></label>
          {group === "office" && <>
            <label className="field">직책<select name="office_position" defaultValue={member.office_position || ""}><option value="">미등록</option>{Object.entries(OFFICE_POSITIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="field">사무실 전화번호<input name="office_phone" type="tel" defaultValue={member.office_phone ? displayPhone(member.office_phone) : ""} placeholder="052-230-0000" maxLength={30} /></label>
          </>}
          {group === "instructor" ? <>
            <label className="field">교내/교외<select name="instructor_kind" defaultValue={member.instructor_kind || ""} required><option value="" disabled>구분 선택</option><option value="INTERNAL">교내</option><option value="EXTERNAL">교외</option></select></label>
            <label className="field">연락처<input name="instructor_phone" type="tel" defaultValue={member.instructor_phone ? displayPhone(member.instructor_phone) : ""} placeholder="010-1234-5678" maxLength={30} /><span className="text-xs font-normal text-slate-500">수강생 Q&amp;A 응대가 가능한 번호를 입력해 주세요.</span></label>
          </> : <label className="field">핸드폰 전화번호<input name="mobile_phone" type="tel" defaultValue={member.mobile_phone ? displayPhone(member.mobile_phone) : ""} placeholder="010-1234-5678" maxLength={30} /></label>}
          {group === "learner" && <label className="field">생년월일<input type="date" name="birth_date" defaultValue={member.birth_date || ""} min="1900-01-01" max={new Date().toISOString().slice(0, 10)} /></label>}
          <label className="field sm:col-span-2">비고<textarea name="notes" defaultValue={member.notes} maxLength={2000} rows={4} className="w-full rounded-lg border border-slate-300 p-3 font-normal" placeholder="구성원 관리에 필요한 메모" /></label>
        </div>
      </ActionForm>
    </section>}
    {view === "delete" && <section className="max-w-2xl rounded-2xl border border-rose-200 bg-white p-6">
      <h2 className="text-lg font-bold">이 구성원을 삭제하시겠습니까?</h2>
      <p className="my-4 text-sm leading-7 text-slate-600">삭제하면 모든 구성원 목록에서 제외되고 U-LiVET 서비스 이용이 중지됩니다. 기존 강의·수강·증명 이력은 보존됩니다.</p>
      {me.id === id ? <p role="status" className="rounded-lg bg-slate-50 p-4 text-sm">현재 로그인한 자신의 계정은 삭제할 수 없습니다.</p> : <ActionForm action={deleteMember} label="구성원 삭제" className="space-y-4 [&>button]:bg-rose-700 [&>button]:hover:bg-rose-800">
        <input type="hidden" name="person_id" value={id} /><input type="hidden" name="group" value={group} /><input type="hidden" name="revision" value={member.revision} />
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirmed" value="yes" required className="mt-1 h-4 w-4" /><span><strong>{member.name}</strong> 님의 서비스 이용 중지와 목록 삭제를 확인했습니다.</span></label>
      </ActionForm>}
    </section>}
    {view === "history" && <section className="panel">
      <h2 className="mb-5 text-lg font-bold">{historyName} <span className="ml-2 text-sm font-normal text-slate-500">{history?.data ? `${history.data.total}건` : ""}</span></h2>
      {history?.error || !history?.data ? <Empty title="이력을 불러오지 못했습니다" /> : !history.data.items.length ? <Empty title="등록된 이력이 없습니다" /> : <>
        <div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm"><caption className="sr-only">{member.name} {historyName}</caption><thead className="border-b text-slate-500"><tr>{["과정명", "기간", "상태"].map(label => <th key={label} scope="col" className="px-3 py-3 font-semibold">{label}</th>)}</tr></thead>
          <tbody className="divide-y">{history.data.items.map(item => <tr key={item.id}><th scope="row" className="px-3 py-4 font-medium">{item.name}</th><td className="whitespace-nowrap px-3 py-4 tabular-nums">{item.starts_on} ~ {item.ends_on}</td><td className="whitespace-nowrap px-3 py-4">{HISTORY_STATUS[item.status] || item.status}</td></tr>)}</tbody></table></div>
        <nav aria-label="구성원 이력 페이지" className="mt-5 flex justify-between text-sm"><span className="text-slate-500">{page} / {Math.max(1, Math.ceil(history.data.total / 20))} 페이지</span><div className="flex gap-4">{page > 1 && <Link className="text-teal-800" href={`${detail}&view=history&page=${page - 1}`}>← 이전</Link>}{page * 20 < history.data.total && <Link className="text-teal-800" href={`${detail}&view=history&page=${page + 1}`}>다음 →</Link>}</div></nav>
      </>}
    </section>}
  </div>;
}
