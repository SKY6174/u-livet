import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, ShieldCheck, UsersRound } from "lucide-react";
import { OFFICE_POSITIONS } from "@/lib/auth/login-audience";
import { PageIntro, Empty } from "@/components/portal/ui";
import { MemberNotice } from "@/components/portal/member-notice";
import { getFilteredMembers, memberAdmin } from "@/lib/members/data";
import { MEMBER_GROUPS, MEMBER_SORT_OPTIONS, MEMBER_YEARS, memberFilters, memberGroup, memberPage, displayPhone, type MemberGroup } from "@/lib/members/model";
import { MemberExcel } from "@/components/members/member-excel";

export default async function Members({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await memberAdmin();
  const params = await searchParams;
  const group = memberGroup(params.group);
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const page = memberPage(params.page);
  const filters = memberFilters(group, params);
  const result = await getFilteredMembers(group, query, page, filters);
  const data = result.data;
  const href = (nextPage: number) => `/admin/accounts?${new URLSearchParams({ group, q: query,
    ...(filters.year ? { year: String(filters.year) } : {}), ...(filters.kind ? { kind: filters.kind } : {}),
    sort: filters.sort, dir: filters.direction, page: String(nextPage) })}`;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));
  if (data && page > pages) redirect(href(pages));
  const phoneHeading = group === "instructor" ? "연락처" : "핸드폰 전화번호";
  const notice = params.created === "1" ? "created" : params.saved === "1" ? "saved" : params.deleted === "1" ? "deleted" : undefined;
  const columns = ["순번", ...(group === "office" ? ["직책"] : group === "instructor" ? ["교내/교외"] : []), "성명", group === "learner" ? "이메일" : "이메일(아이디)", ...(group === "office" ? ["사무실 전화번호"] : []), phoneHeading, ...(group === "learner" ? ["생년월일", filters.year ? `${filters.year}년 수강과목` : "올해 수강과목", "수강이력"] : group === "instructor" ? ["강의이력"] : []), "비고", "관리"];
  return <div className="page-shell">
    <PageIntro eyebrow="MEMBERS" title="구성원 관리">사업단·강사·수강생의 정보와 활동 이력을 관리합니다.</PageIntro>
    <div className="mb-6">
      <span className="inline-flex items-center gap-2 text-sm text-slate-500"><ShieldCheck aria-hidden="true" className="h-4 w-4 text-teal-700" />{me.is_super_admin ? "최고 관리자 · " + me.name : "구성원 명부"}</span>
    </div>
    <MemberNotice key={notice ?? "none"} kind={notice} />
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
    <nav aria-label="구성원 구분" className="flex flex-wrap gap-2">
      {Object.entries(MEMBER_GROUPS).map(([key, label]) => <Link key={key} href={`/admin/accounts?group=${key}`} aria-current={key === group ? "page" : undefined}
        className={`inline-flex min-h-12 items-center gap-3 rounded-xl border px-5 text-sm font-semibold transition-colors ${key === group ? "border-teal-800 bg-teal-800 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-800"}`}>
        {label}<span className={`rounded-md px-2 py-0.5 text-xs tabular-nums ${key === group ? "bg-white/15" : "bg-slate-100"}`}>{data?.counts[key as MemberGroup] ?? "—"}</span>
      </Link>)}
    </nav>
      <MemberExcel key={group} group={group} query={query} filters={filters} orgs={me.member_entry_orgs ?? []} canEdit={me.roles.some(role => role.role === "SYSTEM_ADMIN")} />
    </div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2"><UsersRound aria-hidden="true" className="h-5 w-5 text-teal-700" /><h2 className="font-bold">{MEMBER_GROUPS[group]} 목록</h2><span className="text-sm text-slate-500">{data ? `${data.total}명` : ""}</span></div>
        <form action="/admin/accounts" className="flex min-w-0 flex-wrap items-end gap-2">
          <input type="hidden" name="group" value={group} />
          {group !== "office" && <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">사업연도
            <select name="year" defaultValue={filters.year ?? ""} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800">
              <option value="">전체 연도</option>{MEMBER_YEARS.map(year => <option key={year} value={year}>{year}년 ({year - 2024}차년도)</option>)}
            </select>
          </label>}
          {group === "instructor" && <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">강사 구분
            <select name="kind" defaultValue={filters.kind ?? ""} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800">
              <option value="">교내·교외 전체</option><option value="INTERNAL">교내</option><option value="EXTERNAL">교외</option>
            </select>
          </label>}
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">정렬 기준
            <select name="sort" defaultValue={filters.sort} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800">
              {MEMBER_SORT_OPTIONS[group].map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">정렬 방향
            <select name="dir" defaultValue={filters.direction} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800">
              <option value="asc">오름차순</option><option value="desc">내림차순</option>
            </select>
          </label>
          <label className="sr-only" htmlFor="member-search">이름 또는 이메일 검색</label>
          <input id="member-search" name="q" defaultValue={query} maxLength={100} placeholder="이름 또는 이메일 검색" className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm sm:w-48" />
          <button className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg bg-slate-800 px-3 text-sm font-semibold text-white"><Search aria-hidden="true" className="h-4 w-4" />적용</button>
        </form>
      </div>
      {result.error || !data ? <div className="p-6"><Empty title="구성원 목록을 불러오지 못했습니다">잠시 후 다시 시도해 주세요.</Empty></div> : data.items.length === 0 ? <div className="p-8"><Empty title={query || filters.year || filters.kind ? "조회 조건에 맞는 구성원이 없습니다" : "등록된 구성원이 없습니다"} /></div> : <>
        <div role="region" aria-label={`${MEMBER_GROUPS[group]} 구성원 표`} tabIndex={0} className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <caption className="sr-only">{MEMBER_GROUPS[group]} 구성원 정보 및 관리</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500"><tr>{columns.map(column => <th scope="col" key={column} className="whitespace-nowrap px-4 py-4 font-semibold">{column}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{data.items.map((member, index) => {
              const detail = `/admin/accounts/${member.id}?group=${group}`;
              const isAdmin = me.roles.some(role => role.role === "SYSTEM_ADMIN");
              const canEdit = isAdmin && (member.can_edit ?? member.can_manage ?? true);
              const canDelete = isAdmin && member.can_manage !== false && !member.is_super_admin && member.id !== me.id;
              return <tr key={member.id} className="hover:bg-teal-50/30">
                <td className="px-4 py-5 tabular-nums text-slate-400">{(page - 1) * 20 + index + 1}</td>
                {group === "office" && <td className="whitespace-nowrap px-4 py-5">{member.office_position ? OFFICE_POSITIONS[member.office_position] : "미등록"}</td>}
                {group === "instructor" && <td className="whitespace-nowrap px-4 py-5"><span className="rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800">{member.instructor_kind === "INTERNAL" ? "교내" : member.instructor_kind === "EXTERNAL" ? "교외" : "미등록"}</span></td>}
                <th scope="row" className="whitespace-nowrap px-4 py-5 font-semibold">{member.name}{member.is_super_admin && <span className="ml-2 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-medium text-teal-800">최고 관리자</span>}{member.is_pool_only && <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">계정 미연결</span>}{(member.is_manual || member.account_verified) && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{member.account_verified ? "인증 완료" : group === "office" || (group === "instructor" && member.instructor_kind === "INTERNAL") ? "인증 대기" : "수동 등록"}</span>}</th>
                <td className="max-w-64 break-all px-4 py-5 text-slate-600">{member.email || "—"}</td>
                {group === "office" && <td className="whitespace-nowrap px-4 py-5 tabular-nums">{displayPhone(member.office_phone)}</td>}
                <td className="whitespace-nowrap px-4 py-5 tabular-nums">{displayPhone(group === "instructor" ? member.instructor_phone : member.mobile_phone)}</td>
                {group === "learner" && <td className="whitespace-nowrap px-4 py-5 tabular-nums">{member.birth_date || "—"}</td>}
                {group === "learner" && <td className="min-w-44 max-w-64 px-4 py-5">{member.current_courses?.length ? <ul className="space-y-1.5">{member.current_courses.map(course => <li key={course.id} className="rounded-md bg-teal-50 px-2.5 py-1.5 text-xs font-medium leading-5 text-teal-900">{course.name}</li>)}</ul> : <span className="text-slate-400">—</span>}</td>}
                {group !== "office" && <td className="px-4 py-5"><Link aria-label={`${member.name} ${member.is_pool_only ? "강사 정보" : group === "instructor" ? "강의이력" : "수강이력"} 보기`} className="whitespace-nowrap font-semibold text-teal-800 underline underline-offset-4" href={member.is_pool_only && member.pool_org_id ? `/admin/instructors?org=${member.pool_org_id}&person=${member.id}` : `${detail}&view=history`}>{member.is_pool_only ? "강사 정보" : "이력 보기"}</Link></td>}
                <td className="min-w-28 max-w-52 break-words px-4 py-5 text-slate-500"><span className="line-clamp-2" title={member.notes}>{member.notes || "—"}</span></td>
                <td className="px-4 py-5">{member.is_pool_only && member.pool_org_id ? <Link href={`/admin/instructors?org=${member.pool_org_id}&person=${member.id}`} aria-label={`${member.name} 강사 정보 관리`} className="inline-flex min-h-10 items-center whitespace-nowrap rounded-lg border border-slate-200 px-3 font-medium hover:border-teal-400">강사 정보</Link> : canEdit || canDelete ? <div className="flex items-center gap-2">{canEdit && <Link href={detail} aria-label={`${member.name} 수정`} className="inline-flex min-h-10 items-center whitespace-nowrap rounded-lg border border-slate-200 px-3 font-medium hover:border-teal-400">수정</Link>}{canDelete && <Link href={`${detail}&view=delete`} aria-label={`${member.name} 삭제`} className="inline-flex min-h-10 items-center whitespace-nowrap rounded-lg px-2 text-rose-700 hover:bg-rose-50">삭제</Link>}</div> : <span className="text-slate-400">—</span>}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <nav aria-label="구성원 목록 페이지" className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-sm">
          <span className="text-slate-500">{page} / {pages} 페이지</span><div className="flex gap-3">{page > 1 && <Link className="font-semibold text-teal-800" href={href(page - 1)}>← 이전</Link>}{page < pages && <Link className="font-semibold text-teal-800" href={href(page + 1)}>다음 →</Link>}</div>
        </nav>
      </>}
    </div>
    {group === "learner" && <p className="mt-3 text-xs leading-6 text-slate-500">{filters.year ? `${filters.year}년 수강과목은 선택한 사업연도의` : `올해 수강과목은 ${data?.current_year ?? "올해"}년 운영 기간에 해당하는`} 수강 확정 과정입니다. 수강이력에서는 과거 연도를 포함한 전체 기록을 확인할 수 있습니다.</p>}
    {group === "instructor" && <p className="mt-3 text-xs text-slate-500">연락처는 수강생 Q&amp;A 응대가 가능한 번호입니다.</p>}
  </div>;
}
