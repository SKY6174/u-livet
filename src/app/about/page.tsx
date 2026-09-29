import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, Building2 } from "lucide-react";

export const metadata: Metadata = {
  title: "앵커사업 소개 | U-LiVET",
  description: "울산과학대학교 앵커사업단의 4대 프로젝트와 여러 센터가 함께 활용하는 평생직업교육 플랫폼 U-LiVET을 소개합니다.",
};

// Official project colors and image provenance: docs/operations/anchor-about-sources.md.
const PROJECTS = [
  {
    id: "talent", name: "TALENT", color: "#4DFFC2", theme: "인재 양성",
    title: "울산에 뿌리내리는 실전 인재",
    description: "지역에서 배우고 성장하며 정착할 수 있도록 전문기술과 창업, 글로벌 역량을 키웁니다.",
    imageAlt: "푸른 바다와 등대가 보이는 울산 해안 풍경",
    tasks: ["UC-HYPER 전문기술인재 양성", "지역 창업 생태계와 글로컬 창업문화 조성", "지역산업과 연계한 글로벌 협력 거점 대학 육성"],
  },
  {
    id: "bridge", name: "BRIDGE", color: "#FFC938", theme: "산학 협력",
    title: "기업과 함께 만드는 연결의 힘",
    description: "지자체·산업계·대학·연구기관이 협력해 지역산업의 전환과 지속가능한 성장을 지원합니다.",
    imageAlt: "강과 다리를 중심으로 펼쳐진 울산 도심의 저녁 풍경",
    tasks: ["울산 주력·신산업 분야 산학협력 체계 구축", "지·산·학 협력 탄소중립 실천 플랫폼 구축", "복합재난에 대응하는 산업안전·보건 통합 운영", "AID 역량 강화로 지역산업 전환 지원"],
  },
  {
    id: "jump", name: "JUMP", color: "#FF86C0", theme: "평생직업교육",
    title: "새로운 일을 향한 생애 도약",
    description: "생애 전반의 직무 역량을 높이고, 평생직업교육을 취업·창업과 연결합니다.",
    imageAlt: "간절곶 소망우체통과 해안 너머로 펼쳐진 노을",
    tasks: ["U-LiVET 평생직업교육 기반 취·창업 연계모델 구축", "동남권과 함께 성장하는 돌봄생태계 ‘울산愛’ 구현"],
  },
  {
    id: "care", name: "CARE", color: "#E5480E", theme: "지역사회 상생",
    title: "일상 가까이, 더 나은 지역의 삶",
    description: "생활 안전과 의료, 정주 여건을 함께 살피며 지역문제 해결과 시민의 삶의 질 향상을 돕습니다.",
    imageAlt: "빛나는 디지털 화면을 손끝으로 터치하는 모습",
    tasks: ["지역문제 해결을 위한 울산형 혁신 솔루션 구축", "보건복지 특성화와 인재양성 체계 구축", "에코컬처 도시재생·문화혁신 모델 구축"],
  },
] as const;

const OPERATING_CENTERS = ["RCC센터", "ECC센터", "ICC센터", "AID-X지원센터"] as const;

export default function About() {
  return (
    <div className="page-shell break-keep">
      <div className="mb-10 grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-end">
        <div>
          <p className="eyebrow">ANCHOR · ULSAN COLLEGE</p>
          <h1 className="page-title mb-0">앵커사업 소개</h1>
        </div>
        <div>
          <p className="text-xl font-bold leading-relaxed text-slate-900 sm:text-2xl">지역의 인재, 산업, 일과 삶을 잇습니다.</p>
          <p className="mt-3 leading-relaxed text-slate-600">울산과학대학교 앵커사업단은 4대 프로젝트를 통해 대학과 지역이 함께 성장하는 미래를 만들어갑니다.</p>
        </div>
      </div>

      <section aria-label="U-LiVET 브랜드" className="mb-10 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-6 lg:flex-row lg:items-center lg:gap-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <div className="h-20 w-24 shrink-0 overflow-hidden sm:h-28 sm:w-32">
            <Image src="/images/u-livet-logo.png" alt="" width={1360} height={380} className="h-full w-auto max-w-none" priority />
          </div>
          <div>
            <p className="whitespace-nowrap text-3xl font-extrabold tracking-tight text-[#082b68] sm:text-5xl">U-LiVE<span className="text-[#6b9fc4]">T</span></p>
            <p className="mt-1 whitespace-nowrap text-xs font-bold text-teal-700 sm:text-base">Ulsan Lifelong T-VET</p>
          </div>
        </div>
        <div>
          <p className="mt-1 text-base font-semibold leading-7 text-slate-800">Ulsan Lifelong Vocational Education &amp; Training</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">울산의 배움과 직업교육을 잇는 평생직업교육 플랫폼입니다.</p>
        </div>
      </section>

      <nav aria-label="앵커사업 소개 바로가기" className="mb-12 flex flex-wrap gap-2">
        {PROJECTS.map((project) => (
          <a key={project.id} href={`#${project.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:border-slate-400">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color }} />
            {project.name}<ArrowDown size={14} aria-hidden="true" />
          </a>
        ))}
        <a href="#centers" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:border-slate-400">
          평생직업교육 플랫폼<ArrowDown size={14} aria-hidden="true" />
        </a>
      </nav>

      <section aria-labelledby="projects-title">
        <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
          <h2 id="projects-title" className="text-2xl font-bold text-slate-900">4대 프로젝트</h2>
          <span className="text-sm text-slate-500">울산과 함께하는 네 가지 변화</span>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {PROJECTS.map((project, index) => (
            <article key={project.id} id={project.id} aria-labelledby={`${project.id}-title`} className="relative isolate flex min-h-[28rem] scroll-mt-40 flex-col gap-8 overflow-hidden rounded-2xl bg-[#0b162b] text-white">
              <Image src={`/images/anchor/${project.id}.jpg`} alt={project.imageAlt} fill sizes="(min-width: 1280px) 608px, (min-width: 768px) 48vw, 100vw" className="object-cover" />
              <span className="relative m-5 self-start rounded-full bg-slate-950/85 px-3 py-1.5 text-sm font-semibold text-white">0{index + 1} · {project.theme}</span>
              <div className="relative mt-auto flex flex-col border-t-4 bg-[#0b162b]/70 p-5 sm:p-6" style={{ borderColor: project.color }}>
                <h3 id={`${project.id}-title`} className="text-2xl font-bold tracking-tight sm:text-3xl">
                  <span className="font-normal text-slate-200">Dynamic </span><span style={{ color: project.color }}>{project.name}</span>
                </h3>
                <p className="mt-4 text-lg font-bold">{project.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-300">{project.description}</p>
                <ul className="mt-5 space-y-3 border-t border-white/15 pt-5">
                  {project.tasks.map((task, taskIndex) => (
                    <li key={task} className="flex gap-3 text-sm leading-6 text-slate-100">
                      <span aria-hidden="true" className="shrink-0 font-bold tabular-nums" style={{ color: project.color }}>0{taskIndex + 1}</span>
                      <span>{task}</span>
                    </li>
                  ))}
                </ul>
                {project.id === "jump" && (
                  <Link href="/courses" className="mt-6 inline-flex min-h-11 items-center gap-2 self-start rounded-lg px-4 py-2 text-sm font-bold text-slate-950 hover:brightness-110" style={{ backgroundColor: project.color }}>
                    U-LiVET 교육과정 보기<ArrowRight size={17} aria-hidden="true" />
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="centers" aria-labelledby="centers-title" className="mt-16 scroll-mt-40 border-t border-slate-200 pt-12">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
          <div>
            <p className="eyebrow">U-LiVET · LIFELONG LEARNING</p>
            <h2 id="centers-title" className="text-2xl font-bold text-slate-900 sm:text-3xl">함께 운영하는 평생직업교육</h2>
            <p className="mt-4 leading-8 text-slate-600">U-LiVET은 지역 주민의 배움부터 재직자의 직무 역량 향상까지, 다양한 평생직업교육을 위한 공동 플랫폼입니다. 각 센터의 교육을 한곳에서 안내하고 신청부터 학습·이력 관리까지 연결합니다.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <h3 className="font-bold text-slate-900">여러 센터가 함께 활용하는 교육 공간</h3>
            <ul className="my-5 grid gap-3 sm:grid-cols-2">
              {OPERATING_CENTERS.map((center) => (
                <li key={center} className="flex items-center gap-3 rounded-xl bg-teal-50 px-4 py-3 font-semibold text-teal-900">
                  <Building2 size={20} className="shrink-0" aria-hidden="true" />{center}
                </li>
              ))}
            </ul>
            <p className="text-sm leading-7 text-slate-600">재직자 교육도 평생직업교육의 한 과정입니다. 교육대상과 신청·수료 요건은 각 과정의 모집 안내와 운영 기준을 확인해 주세요.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="learning-title" className="mt-12 flex flex-col gap-6 rounded-2xl bg-teal-50 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="eyebrow mb-2">U-LiVET · LIFELONG LEARNING</p>
          <h2 id="learning-title" className="text-xl font-bold text-teal-950">오늘의 배움을, 내일의 일로</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">나에게 맞는 평생직업교육 과정을 찾아보세요.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/courses" className="btn-primary gap-2">교육과정 소개<ArrowRight size={17} aria-hidden="true" /></Link>
          <Link href="/terms" className="btn-secondary justify-center">수강안내</Link>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
        <p>4대 프로젝트 자료·사진 출처: 울산과학대학교 앵커사업단</p>
        <a href="https://anchor.uc.ac.kr/rise/Main.do" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 underline underline-offset-4">앵커사업단 공식 홈페이지<ArrowUpRight size={14} aria-hidden="true" /><span className="sr-only"> (새 창)</span></a>
      </div>
    </div>
  );
}
