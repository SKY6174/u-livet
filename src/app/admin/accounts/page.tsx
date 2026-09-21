import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, UsersRound } from "lucide-react";
import { OFFICE_POSITIONS } from "@/lib/auth/login-audience";
import { PageIntro, Empty } from "@/components/portal/ui";
import { getMembers, memberAdmin } from "@/lib/members/data";
import { MEMBER_GROUPS, memberGroup, memberPage, displayPhone, type MemberGroup } from "@/lib/members/model";

export default async function Members({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await memberAdmin();
  const params = await searchParams;
  const group = memberGroup(params.group);
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const page = memberPage(params.page);
  const result = await getMembers(group, query, page);
  const data = result.data;
  const href = (nextPage: number) => `/admin/accounts?${new URLSearchParams({ group, q: query, page: String(nextPage) })}`;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));
  if (data && page > pages) redirect(href(pages));
  const phoneHeading = group === "instructor" ? "연락처" : "핸드폰 전화번호";
  const columns = ["순번", ...(group === "office" ? ["직책"] : group === "instructor" ? ["교내/교외"] : []), "성명", group === "learner" ? "이메일" : "이메일(아이디)", ...(group === "office" ? ["사무실 전화번호"] : []), phoneHeading, ...(group === "learner" ? ["생년월일", "수강이력"] : group === "instructor" ? ["강의이력"] : []), "비고", "관리"];
  return <div className="page-shell">
    <PageIntro eyebrow="MEMBERS" title="구성원 관리">사업단·강사·수강생의 정보와 활동 이력을 관리합니다.</PageIntro>
    {params.saved === "1" && <p role="status" className="mb-5 rounded-xl bg-teal-50 p-4 text-sm text-teal-900">구성원 정보를 저장했습니다.</p>}
    {params.deleted === "1" && <p role="status" className="mb-5 rounded-xl bg-teal-50 p-4 text-sm text-teal-900">구성원을 삭제했습니다. 서비스 이용은 중지되고 기존 이력은 보존됩니다.</p>}
    <nav aria-label="구성원 구분" className="mb-6 flex flex-wrap gap-2">
      {Object.entries(MEMBER_GROUPS).map(([key, label]) => <Link key={key} href={`/admin/accounts?group=${key}`} aria-current={key === group ? "page" : undefined}
        className={`inline-flex min-h-12 items-center gap-3 rounded-xl border px-5 text-sm font-semibold transition-colors ${key === group ? "border-teal-800 bg-teal-800 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-800"}`}>
        {label}<span className={`rounded-md px-2 py-0.5 text-xs tabular-nums ${key === group ? "bg-white/15" : "bg-slate-100"}`}>{data?.counts[key as MemberGroup] ?? "—"}</span>
      </Link>)}
    </nav>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2"><UsersRound aria-hidden="true" className="h-5 w-5 text-teal-700" /><h2 className="font-bold">{MEMBER_GROUPS[group]} 목록</h2><span className="text-sm text-slate-500">{data ? `${data.total}명` : ""}</span></div>
        <form action="/admin/accounts" className="flex min-w-0 gap-2">
          <input type="hidden" name="group" value={group} />
          <label className="sr-only" htmlFor="member-search">이름 또는 이메일 검색</label>
          <input id="member-search" name="q" defaultValue={query} maxLength={100} placeholder="이름 또는 이메일 검색" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-64" />
          <button className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg bg-slate-800 px-3 text-sm font-semibold text-white"><Search aria-hidden="true" className="h-4 w-4" />검색</button>
        </form>
      </div>
      {result.error || !data ? <div className="p-6"><Empty title="구성원 목록을 불러오지 못했습니다">잠시 후 다시 시도해 주세요.</Empty></div> : data.items.length === 0 ? <div className="p-8"><Empty title={query ? "검색 조건에 맞는 구성원이 없습니다" : "등록된 구성원이 없습니다"} /></div> : <>
        <div role="region" aria-label={`${MEMBER_GROUPS[group]} 구성원 표`} tabIndex={0} className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <caption className="sr-only">{MEMBER_GROUPS[group]} 구성원 정보 및 관리</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500"><tr>{columns.map(column => <th scope="col" key={column} className="whitespace-nowrap px-4 py-4 font-semibold">{column}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{data.items.map((member, index) => {
              const detail = `/admin/accounts/${member.id}?group=${group}`;
              return <tr key={member.id} className="hover:bg-teal-50/30">
                <td className="px-4 py-5 tabular-nums text-slate-400">{(page - 1) * 20 + index + 1}</td>
                {group === "office" && <td className="whitespace-nowrap px-4 py-5">{member.office_position ? OFFICE_POSITIONS[member.office_position] : "미등록"}</td>}
                {group === "instructor" && <td className="whitespace-nowrap px-4 py-5"><span className="rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800">{member.instructor_kind === "INTERNAL" ? "교내" : member.instructor_kind === "EXTERNAL" ? "교외" : "미등록"}</span></td>}
                <th scope="row" className="whitespace-nowrap px-4 py-5 font-semibold">{member.name}</th>
                <td className="max-w-64 break-all px-4 py-5 text-slate-600">{member.email || "—"}</td>
                {group === "office" && <td className="whitespace-nowrap px-4 py-5 tabular-nums">{displayPhone(member.office_phone)}</td>}
                <td className="whitespace-nowrap px-4 py-5 tabular-nums">{displayPhone(group === "instructor" ? member.instructor_phone : member.mobile_phone)}</td>
                {group === "learner" && <td className="whitespace-nowrap px-4 py-5 tabular-nums">{member.birth_date || "—"}</td>}
                {group !== "office" && <td className="px-4 py-5"><Link aria-label={`${member.name} ${group === "instructor" ? "강의" : "수강"}이력 보기`} className="whitespace-nowrap font-semibold text-teal-800 underline underline-offset-4" href={`${detail}&view=history`}>이력 보기</Link></td>}
                <td className="min-w-28 max-w-52 break-words px-4 py-5 text-slate-500"><span className="line-clamp-2" title={member.notes}>{member.notes || "—"}</span></td>
                <td className="px-4 py-5"><div className="flex items-center gap-2"><Link href={detail} aria-label={`${member.name} 수정`} className="inline-flex min-h-10 items-center whitespace-nowrap rounded-lg border border-slate-200 px-3 font-medium hover:border-teal-400">수정</Link><Link href={`${detail}&view=delete`} aria-label={`${member.name} 삭제`} className="inline-flex min-h-10 items-center whitespace-nowrap rounded-lg px-2 text-rose-700 hover:bg-rose-50">삭제</Link></div></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <nav aria-label="구성원 목록 페이지" className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-sm">
          <span className="text-slate-500">{page} / {pages} 페이지</span><div className="flex gap-3">{page > 1 && <Link className="font-semibold text-teal-800" href={href(page - 1)}>← 이전</Link>}{page < pages && <Link className="font-semibold text-teal-800" href={href(page + 1)}>다음 →</Link>}</div>
        </nav>
      </>}
    </div>
    {group === "instructor" && <p className="mt-3 text-xs text-slate-500">연락처는 수강생 Q&amp;A 응대가 가능한 번호입니다.</p>}
  </div>;
}
