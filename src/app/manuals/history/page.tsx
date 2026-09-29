import type { Metadata } from "next";
import Link from "next/link";
import { CURRENT_MANUAL_VERSION, MANUAL_RELEASES, manualFile, manualHref } from "@/lib/manuals/data";

export const metadata: Metadata = { title: "매뉴얼 버전·개정 이력 | U-LiVET" };
export default function ManualHistory() {
  return <div className="page-shell max-w-4xl">
    <Link className="text-sm font-semibold text-teal-800 underline" href="/manuals">이용 매뉴얼</Link>
    <h1 className="mb-4 mt-6 text-3xl font-bold">버전·개정 이력</h1>
    <p className="mb-8 leading-7 text-slate-600">매뉴얼은 문서 묶음 단위로 버전을 관리합니다. 개정판이 발행되어도 이전 판의 주소와 배포본은 보존됩니다.</p>
    <div className="mb-8 grid gap-3 sm:grid-cols-3">{[["큰 개정 · 2.0.0", "업무 절차·권한의 큰 변경"], ["기능 추가 · 1.1.0", "새 업무·화면 안내 추가"], ["내용 보완 · 1.0.1", "오탈자 수정·설명 보충"]].map(([title, text]) => <div className="rounded-xl bg-slate-100 p-4" key={title}><h2 className="text-sm font-bold">{title}</h2><p className="mt-2 text-sm text-slate-600">{text}</p></div>)}</div>
    <div className="space-y-6">{[...MANUAL_RELEASES].reverse().map(release => <section className="panel" key={release.version}>
      <div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-bold">v{release.version} · {release.title}</h2>{release.version === CURRENT_MANUAL_VERSION && <span className="badge">현재 버전</span>}</div>
      <p className="mt-3 text-sm text-slate-500">{release.releasedOn} · {release.status}</p>
      <ul className="my-5 list-disc space-y-2 pl-5 text-sm leading-6">{release.changes.map(change => <li key={change}>{change}</li>)}</ul>
      <p className="mb-5 text-sm leading-6 text-slate-500">{release.scope}</p>
      <a className="btn-primary" href={manualFile(release.version)} download>이 버전 전체 PDF</a>
      <nav className="mt-5 flex flex-wrap gap-x-5 gap-y-3" aria-label={`${release.version} 대상별 매뉴얼`}>{release.manuals.map(manual => <Link key={manual.id} className="text-sm text-teal-800 underline underline-offset-4" href={manualHref(manual, release.version)}>{manual.title}</Link>)}</nav>
    </section>)}</div>
  </div>;
}
