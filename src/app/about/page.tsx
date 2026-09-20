import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, HeartHandshake, Lightbulb, Sprout } from "lucide-react";

export const metadata: Metadata = {
  title: "앵커사업 소개 | U-LIFE",
  description: "울산과학대학교 앵커사업단의 4대 프로젝트와 지역협업센터(RCC)의 역할을 소개합니다.",
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
    tasks: ["U-LIFE 평생직업교육 기반 취·창업 연계모델 구축", "동남권과 함께 성장하는 돌봄생태계 ‘울산愛’ 구현"],
  },
  {
    id: "care", name: "CARE", color: "#E5480E", theme: "지역사회 상생",
    title: "일상 가까이, 더 나은 지역의 삶",
    description: "생활 안전과 의료, 정주 여건을 함께 살피며 지역문제 해결과 시민의 삶의 질 향상을 돕습니다.",
    imageAlt: "빛나는 디지털 화면을 손끝으로 터치하는 모습",
    tasks: ["지역문제 해결을 위한 울산형 혁신 솔루션 구축", "보건복지 특성화와 인재양성 체계 구축", "에코컬처 도시재생·문화혁신 모델 구축"],
  },
] as const;

const RCC_ROLES = [
  { icon: BookOpen, title: "지역 맞춤형 평생직업교육", description: "지역 주민·재직자·청년의 지속적인 역량 개발을 지원합니다." },
  { icon: Lightbulb, title: "함께 찾고 해결하는 지역문제", description: "지역의 과제를 발굴하고 리빙랩·캡스톤을 통해 해결 방안을 만듭니다." },
  { icon: HeartHandshake, title: "이웃을 위한 보건·복지", description: "사회적 약자를 위한 보건·복지 서비스를 지원합니다." },
  { icon: Sprout, title: "환경·문화와 시민참여", description: "환경·문화를 접목한 도시재생과 시민참여 프로그램을 추진합니다." },
] as const;

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

      <nav aria-label="앵커사업 소개 바로가기" className="mb-12 flex flex-wrap gap-2">
        {PROJECTS.map((project) => (
          <a key={project.id} href={`#${project.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:border-slate-400">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color }} />
            {project.name}<ArrowDown size={14} aria-hidden="true" />
          </a>
        ))}
        <a href="#rcc" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:border-slate-400">
          RCC센터 역할<ArrowDown size={14} aria-hidden="true" />
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
                    U-LIFE 교육과정 보기<ArrowRight size={17} aria-hidden="true" />
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="rcc" aria-labelledby="rcc-title" className="mt-16 scroll-mt-40 border-t border-slate-200 pt-12">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
          <div>
            <p className="eyebrow">REGIONAL COLLABORATION CENTER</p>
            <h2 id="rcc-title" className="text-2xl font-bold text-slate-900 sm:text-3xl">대학과 지역을 잇는 RCC센터</h2>
            <p className="mb-6 mt-4 leading-8 text-slate-600">지역협업센터(RCC)는 대학·지자체·기관·시민이 함께 지역문제를 해결하는 협력 플랫폼입니다. 배움과 보건·복지, 환경·문화 활동을 통해 울산의 정주환경과 시민의 삶을 더 풍요롭게 만듭니다.</p>
            <Image src="/images/anchor/rcc.png" alt="바다 위 바위섬과 산책교가 어우러진 울산 해안 풍경" width={573} height={349} sizes="(min-width: 1024px) 520px, 100vw" className="h-auto w-full rounded-2xl" />
          </div>
          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-6 sm:px-8">
            {RCC_ROLES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-4 py-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800"><Icon size={23} strokeWidth={1.6} aria-hidden="true" /></span>
                <div>
                  <h3 className="font-bold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="learning-title" className="mt-12 flex flex-col gap-6 rounded-2xl bg-teal-50 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="eyebrow mb-2">U-LIFE · Dynamic JUMP</p>
          <h2 id="learning-title" className="text-xl font-bold text-teal-950">오늘의 배움을, 내일의 일로</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">나에게 맞는 평생직업교육 과정을 찾아보세요.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/courses" className="btn-primary gap-2">교육과정 소개<ArrowRight size={17} aria-hidden="true" /></Link>
          <Link href="/terms" className="btn-secondary justify-center">수강안내</Link>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
        <p>자료·사진 출처: 울산과학대학교 앵커사업단 · RCC센터</p>
        <a href="https://anchor.uc.ac.kr/rise/Main.do" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 underline underline-offset-4">앵커사업단 공식 홈페이지<ArrowUpRight size={14} aria-hidden="true" /><span className="sr-only"> (새 창)</span></a>
        <a href="https://rcc.uc.ac.kr/rcc/CMS/Contents/Contents.do?mCode=MN021" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 underline underline-offset-4">RCC센터 소개<ArrowUpRight size={14} aria-hidden="true" /><span className="sr-only"> (새 창)</span></a>
      </div>
    </div>
  );
}
