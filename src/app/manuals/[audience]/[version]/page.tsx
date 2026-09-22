import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { ManualPrintButton } from "@/components/manuals/print-button";
import { CURRENT_MANUAL_VERSION, MANUAL_RELEASES, getManual, manualFile, manualHref } from "@/lib/manuals/data";
import "../../manuals.css";

type Props = { params: Promise<{ audience: string; version: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { audience, version } = await params;
  const result = getManual(audience, version);
  return { title: result ? `${result.manual.title} v${version} | U-LIFE` : "매뉴얼을 찾을 수 없습니다" };
}
export default async function ManualDetail({ params }: Props) {
  const { audience, version } = await params;
  const result = getManual(audience, version);
  if (!result) notFound();
  const { manual, release } = result;
  const latest = getManual(audience);
  return <div className="page-shell manual-document">
    <nav className="no-print mb-7 flex flex-wrap gap-5 text-sm font-semibold text-teal-800" aria-label="매뉴얼 탐색"><Link href="/manuals" className="underline">이용 매뉴얼</Link><Link href="/manuals/history" className="underline">버전·개정 이력</Link></nav>
    {version !== CURRENT_MANUAL_VERSION && <p className="no-print mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">이 문서는 이전 버전입니다. {latest ? <Link className="font-semibold underline" href={manualHref(latest.manual)}>현재 버전 {CURRENT_MANUAL_VERSION} 보기</Link> : <Link className="underline" href="/manuals">현재 매뉴얼 목록 확인</Link>}</p>}
    <div className="mb-8 border-b border-slate-200 pb-8">
      <p className="eyebrow">U-LIFE MANUAL · {manual.code}</p>
      <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{manual.title}</h1>
      <p className="mt-4 text-lg leading-8 text-slate-600">{manual.summary}</p>
      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="inline font-semibold">대상 </dt><dd className="inline text-slate-600">{manual.audience}</dd></div><div><dt className="inline font-semibold">버전·개정일 </dt><dd className="inline text-slate-600">{version} · {release.releasedOn}</dd></div><div><dt className="inline font-semibold">업무 문의 </dt><dd className="inline text-slate-600">{manual.owner}</dd></div><div><dt className="inline font-semibold">검수 상태 </dt><dd className="inline text-slate-600">{release.status}</dd></div></dl>
      <div className="no-print mt-6 flex flex-wrap gap-3"><a className="btn-primary gap-2" href={manualFile(version, audience)} download><Download className="h-4 w-4" aria-hidden="true" />이 매뉴얼 PDF</a><ManualPrintButton /><a className="btn-secondary" href={manualFile(version, audience, "md")} download>텍스트 원문</a></div>
      <nav className="no-print mt-5 flex flex-wrap items-center gap-3 text-sm" aria-label="문서 버전"><span className="text-slate-500">열람 버전</span>{MANUAL_RELEASES.filter(item => item.manuals.some(m => m.id === audience)).map(item => <Link key={item.version} href={manualHref(manual, item.version)} aria-current={version === item.version ? "page" : undefined} className={version === item.version ? "rounded-full bg-teal-100 px-3 py-1.5 font-semibold text-teal-900" : "rounded-full border px-3 py-1.5 underline"}>v{item.version}</Link>)}</nav>
    </div>
    <div className="manual-columns grid items-start gap-9 lg:grid-cols-[240px_minmax(0,1fr)]">
      <nav className="no-print rounded-2xl border border-slate-200 bg-white p-5 lg:sticky lg:top-40" aria-label="매뉴얼 목차"><h2 className="mb-4 font-bold">이 문서의 내용</h2><ol className="space-y-3 text-sm leading-6"><li><a href="#start" className="text-teal-800 hover:underline">시작하기 전에</a></li>{manual.sections.map((section, i) => <li key={section.id}><a className="text-slate-600 hover:text-teal-800 hover:underline" href={`#${section.id}`}>{String(i + 1).padStart(2, "0")} {section.title}</a></li>)}<li><a href="#checklist" className="text-teal-800 hover:underline">업무 점검표</a></li><li><a href="#faq" className="text-teal-800 hover:underline">문제 해결</a></li><li><a href="#revision" className="text-teal-800 hover:underline">이 버전의 변경 내용</a></li></ol></nav>
      <article className="min-w-0 space-y-8">
        <section id="start" className="manual-section panel scroll-mt-6"><h2 className="section-title">시작하기 전에</h2><ul className="mb-6 list-disc space-y-2 pl-5 leading-7">{manual.prerequisites.map(text => <li key={text}>{text}</li>)}</ul>{release.common.map(item => <div className="mt-5" key={item.title}><h3 className="font-semibold">{item.title}</h3><p className="mt-2 leading-7 text-slate-600">{item.body}</p></div>)}<p className="mt-6 text-sm leading-6 text-slate-500">{release.scope}</p></section>
        {manual.sections.map((section, i) => <section id={section.id} key={section.id} className="manual-section panel scroll-mt-6">
          <p className="mb-2 text-xs font-bold tracking-widest text-teal-700">STEP {String(i + 1).padStart(2, "0")}</p><h2 className="text-xl font-bold sm:text-2xl">{section.title}</h2>
          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6"><span className="font-semibold">메뉴 경로</span><br />{section.entry}</p>
          <p className="my-5 text-sm leading-6 text-slate-600"><strong className="text-slate-800">준비할 것 · </strong>{section.prepare}</p>
          <ol className="list-decimal space-y-4 pl-6 leading-8 marker:font-semibold marker:text-teal-800">{section.steps.map(step => <li className="pl-1" key={step}>{step}</li>)}</ol>
          <div className="mt-6 rounded-xl bg-teal-50 p-4"><h3 className="text-sm font-bold text-teal-900">완료 확인</h3><p className="mt-2 text-sm leading-7 text-teal-950">{section.done}</p></div>
          {section.note && <p className="mt-4 border-l-2 border-amber-400 pl-4 text-sm leading-7 text-slate-600"><strong className="text-slate-800">확인하세요 · </strong>{section.note}</p>}
          <Link href={section.path} className="no-print mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-teal-800 underline underline-offset-4">{section.title} 시작 화면 열기 →</Link>
        </section>)}
        <section id="checklist" className="manual-section panel scroll-mt-6"><h2 className="section-title">업무 점검표</h2><ul className="list-disc space-y-3 pl-5 leading-7">{manual.checklist.map(text => <li key={text}>{text}</li>)}</ul></section>
        <section id="faq" className="manual-section panel scroll-mt-6"><h2 className="section-title">문제 해결</h2><dl className="space-y-6">{manual.faq.map(item => <div key={item.question}><dt className="font-semibold">{item.question}</dt><dd className="mt-2 leading-7 text-slate-600">{item.answer}</dd></div>)}</dl></section>
        <section id="revision" className="manual-section panel scroll-mt-6"><h2 className="section-title">이 버전의 변경 내용</h2><p className="mb-4 text-sm text-slate-500">v{release.version} · {release.releasedOn}</p><ul className="list-disc space-y-2 pl-5 text-sm leading-7">{release.changes.map(text => <li key={text}>{text}</li>)}</ul></section>
      </article>
    </div>
  </div>;
}
