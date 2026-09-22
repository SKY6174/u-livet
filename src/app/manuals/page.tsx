import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Download, History, Search } from "lucide-react";
import { getManualRelease, manualFile, manualHref, searchManuals } from "@/lib/manuals/data";

export const metadata: Metadata = { title: "이용 매뉴얼 | U-LIFE", description: "운영대상별 업무 안내와 버전별 PDF 매뉴얼" };

export default async function ManualsPage({ searchParams }: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const release = getManualRelease()!;
  const manuals = searchManuals(release, query);
  return <div className="page-shell">
    <section className="relative overflow-hidden rounded-3xl bg-teal-900 px-6 py-9 text-white sm:px-10 sm:py-12">
      <p className="mb-4 text-xs font-semibold tracking-widest text-teal-200">U-LIFE GUIDE</p>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">내 업무에 맞는 이용 매뉴얼</h1>
          <p className="mt-4 leading-7 text-teal-50">처음 시작하는 수강부터 과정 운영과 행정까지.<br className="hidden sm:block" />대상별 업무 순서와 완료 확인 방법을 한곳에서 확인하세요.</p>
        </div>
        <span className="rounded-full border border-teal-600 bg-teal-800 px-4 py-2 text-sm">현재 버전 {release.version}</span>
      </div>
      <div className="mt-7 flex flex-wrap gap-3">
        <a className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-teal-900 hover:bg-teal-50" href={manualFile(release.version)} download><Download className="h-4 w-4" aria-hidden="true" />전체 매뉴얼 PDF</a>
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-teal-500 px-5 py-3 text-sm font-semibold hover:bg-teal-800" href="/manuals/history"><History className="h-4 w-4" aria-hidden="true" />버전·개정 이력</Link>
      </div>
      <p className="mt-5 text-xs leading-6 text-teal-100">개정일 {release.releasedOn} · {release.status}</p>
    </section>
    <form action="/manuals" className="my-8 rounded-2xl border border-slate-200 bg-white p-5" role="search">
      <label htmlFor="manual-search" className="mb-2 block text-sm font-semibold">대상이나 업무로 찾기</label>
      <div className="flex flex-wrap gap-3">
        <input id="manual-search" type="search" name="q" defaultValue={query} maxLength={100} placeholder="예: 수강신청, 출석, 환불, 최종 제출" className="min-h-12 min-w-0 flex-1 basis-52 rounded-lg border border-slate-300 px-4" />
        <button className="btn-primary gap-2" type="submit"><Search className="h-4 w-4" aria-hidden="true" />검색</button>
        {query && <Link className="btn-secondary" href="/manuals">초기화</Link>}
      </div>
    </form>
    <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{query ? `“${query}” 검색 결과` : "대상별 매뉴얼"}</h2><span className="shrink-0 text-sm text-slate-500">{manuals.length}종</span></div>
    {!manuals.length ? <p className="panel py-12 text-center text-slate-600">일치하는 매뉴얼이 없습니다. 다른 업무명이나 대상명으로 검색해 주세요.</p> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {manuals.map(manual => <article key={manual.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between"><BookOpen className="h-6 w-6 text-teal-700" aria-hidden="true" /><span className="text-xs text-slate-500">{manual.code} · v{release.version}</span></div>
        <h3 className="text-xl font-bold"><Link className="hover:text-teal-800 hover:underline" href={manualHref(manual)}>{manual.title}</Link></h3>
        <p className="mt-2 text-xs font-medium text-teal-800">{manual.audience}</p>
        <p className="mb-6 mt-3 text-sm leading-6 text-slate-600">{manual.summary}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-800" href={manualHref(manual)} aria-label={`${manual.title} 읽기`}>매뉴얼 읽기<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
          <a className="inline-flex min-h-11 items-center gap-1.5 text-sm text-slate-600 underline underline-offset-4" href={manualFile(release.version, manual.id)} download aria-label={`${manual.title} PDF 다운로드`}><Download className="h-4 w-4" aria-hidden="true" />PDF</a>
        </div>
      </article>)}
    </div>}
    <p className="mt-8 text-sm leading-7 text-slate-500">{release.scope} 메뉴는 본인의 권한과 담당 범위에 따라 다르게 표시됩니다.</p>
  </div>;
}
