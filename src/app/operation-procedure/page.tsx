import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight, Building2, Check, ClipboardCheck, Info, ShieldCheck, UsersRound } from "lucide-react";

export const metadata: Metadata = {
  title: "평생직업교육 운영절차 | U-LIFE",
  description: "내부·외부 평생직업교육과정의 개설과 운영, 모집 미달 시 조율·폐강 기준, 결과보고 및 정산 절차를 안내합니다.",
};

const PROCESS_TYPES = [
  {
    id: "internal",
    title: "내부 교육과정",
    subtitle: "학과 교수진과 함께하는 정기 운영",
    icon: Building2,
    accent: "text-uc-navy",
    background: "bg-blue-50",
    border: "border-t-uc-navy",
    details: [
      ["추진 방식", "전 학과 대상 공식 공문 발송"],
      ["계획 수립", "학과 교수가 운영계획서 작성·회신 후 심의를 거쳐 확정"],
      ["운영 기간", "5월~12월 정기 운영"],
      ["미달 시 조율", "교수와 협의 후 재홍보 · 최대 3회 조율"],
      ["결과 정산", "결과보고 완료 후 강사료·장학금 지급 절차 진행"],
    ],
    steps: [
      { title: "공문 안내", description: "각 학과에 운영계획 신청서와 안내 공문을 발송합니다." },
      { title: "계획서 회신", description: "교수진이 작성한 운영계획서를 접수하고 취합합니다." },
      { title: "심의위원회", description: "운영계획서를 심의하고 최종 개설 과정을 확정합니다." },
      { title: "홍보·운영", description: "수강생을 모집하고 5월~12월에 교육과정을 운영합니다." },
      { title: "결과보고·정산", description: "결과보고서를 작성하고 강사료·장학금 지급 절차를 진행합니다." },
    ],
    note: "모집 홍보 채널의 한계를 보완할 수 있도록 과정 책임 교원의 유관기관·네트워크를 통한 연계 홍보 협조가 필요합니다.",
  },
  {
    id: "external",
    title: "외부 교육과정",
    subtitle: "현장 수요에 맞춘 수시·상시 운영",
    icon: UsersRound,
    accent: "text-teal-800",
    background: "bg-teal-50",
    border: "border-t-teal-700",
    details: [
      ["추진 방식", "별도 공문 없이 필요에 따라 외부 강사 개별 섭외"],
      ["계획 수립", "외부 강사와 회의·협의 후 계획서 작성 및 심의 확정"],
      ["운영 기간", "필요 시 수시·상시 개설 운영"],
      ["미달 시 조율", "강사와 협의 후 일정 재공고 · 최대 3회 조율"],
      ["결과 정산", "내부 과정과 동일하게 결과보고 완료 후 정산 진행"],
    ],
    steps: [
      { title: "수요 파악·섭외", description: "교육 수요에 따라 개별 강사를 섭외하고 회의를 진행합니다." },
      { title: "계획서 작성", description: "외부 강사와 협의해 상세 운영계획서를 작성합니다." },
      { title: "심의위원회", description: "제출된 운영계획서를 심의하고 개설을 확정합니다." },
      { title: "홍보·운영", description: "수강생을 모집해 운영하며, 미달 시 일정 조율 후 재공고합니다." },
      { title: "결과보고·정산", description: "결과보고 후 내부 과정과 동일하게 강사료·장학금 지급 절차를 진행합니다." },
    ],
    note: "별도의 공문 절차 없이 필요에 따라 운영하여 최신 직업 동향과 산업체의 요구를 유연하게 반영합니다.",
  },
] as const;

const RECRUITMENT_STEPS = [
  { title: "1차 홍보·수강생 모집", description: "과정을 공고하고 수강생을 모집합니다. 적정 인원이 충족되면 개강합니다.", badge: "인원 충족 시 개강", style: "border-slate-200 bg-white", numberStyle: "bg-slate-800 text-white" },
  { title: "최소인원 미달 시 일정 조율", description: "교수·강사와 협의하여 일정을 재조정하고 재홍보·재공고합니다. 일정 조율은 최대 3회까지 진행합니다.", badge: "최대 3회 조율", style: "border-amber-200 bg-amber-50", numberStyle: "bg-amber-700 text-white" },
  { title: "3회 조율 후에도 미달이면 폐강", description: "총 3차례 일정 조율 후에도 적정 인원을 충족하지 못하면 해당 과정을 최종 폐강합니다.", badge: "최종 폐강", style: "border-rose-200 bg-rose-50", numberStyle: "bg-rose-700 text-white" },
] as const;

const SETTLEMENT_STEPS = [
  { title: "교육 종료·출결 확인", description: "정해진 수료 기준에 따라 출석률을 확인하고 교육 이수 처리를 완료합니다." },
  { title: "결과보고서 작성·제출", description: "운영 성과, 수강생 만족도 조사, 총 지출 내역을 정리하여 제출합니다." },
  { title: "강사료·장학금 지급 정산", description: "결과보고서 승인 후 강사료 지급과 수료생 대상 장학금 지급 수속을 진행합니다." },
] as const;

const SECTION_LINKS = [
  ["overview", "운영 개요"],
  ["internal", "내부 교육과정"],
  ["external", "외부 교육과정"],
  ["recruitment", "모집·폐강 기준"],
  ["settlement", "결과보고·정산"],
] as const;

export default function OperationProcedure() {
  return (
    <div className="page-shell break-keep">
      <div className="mb-8">
        <p className="eyebrow">OPERATION GUIDE</p>
        <h1 className="page-title">평생직업교육 운영절차</h1>
        <p className="max-w-3xl leading-8 text-slate-600">교육과정 기획부터 모집·운영, 결과보고와 정산까지의 절차를 안내합니다. 내부·외부 교육과정은 개설 방식에 따라 구분하며, 모집 미달 기준과 정산 원칙은 공통으로 적용합니다.</p>
      </div>

      <nav aria-label="운영절차 바로가기" className="mb-12 flex flex-wrap gap-2">
        {SECTION_LINKS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-teal-600 hover:text-teal-900">
            {label}<ArrowDown size={15} aria-hidden="true" />
          </a>
        ))}
      </nav>

      <section id="overview" aria-labelledby="overview-title" className="scroll-mt-48">
        <h2 id="overview-title" className="mb-5 text-2xl font-bold">두 가지 방식, 하나의 운영 원칙</h2>
        <div className="grid gap-5 md:grid-cols-2">
          {PROCESS_TYPES.map(({ id, title, subtitle, icon: Icon, accent, background, border, details }) => (
            <article key={id} aria-labelledby={`${id}-overview-title`} className={`overflow-hidden rounded-2xl border border-slate-200 border-t-4 bg-white ${border}`}>
              <div className={`flex items-center gap-4 p-6 ${background}`}>
                <Icon size={28} className={`shrink-0 ${accent}`} aria-hidden="true" />
                <div>
                  <h3 id={`${id}-overview-title`} className={`text-xl font-bold ${accent}`}>{title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
                </div>
              </div>
              <dl className="divide-y divide-slate-100 px-6">
                {details.map(([label, description]) => (
                  <div key={label} className="grid gap-1 py-4 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-4">
                    <dt className="font-semibold text-slate-900">{label}</dt>
                    <dd className="leading-7 text-slate-600">{description}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </section>

      {PROCESS_TYPES.map(({ id, title, accent, background, border, steps, note }, processIndex) => (
        <section key={id} id={id} aria-labelledby={`${id}-title`} className="mt-14 scroll-mt-48">
          <p className={`mb-2 text-sm font-bold ${accent}`}>0{processIndex + 1} · 개설과 운영</p>
          <h2 id={`${id}-title`} className="mb-5 text-2xl font-bold">{title} 운영 흐름</h2>
          <ol className="grid gap-4 lg:grid-cols-5">
            {steps.map(({ title: stepTitle, description }, index) => (
              <li key={stepTitle} className={`relative rounded-xl border border-slate-200 border-t-4 bg-white p-5 ${border}`}>
                <div className="mb-4 flex items-center justify-between">
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${background} ${accent}`}>
                    <span className="sr-only">단계 </span>0{index + 1}
                  </span>
                  {index < steps.length - 1 && <ArrowRight size={18} className={`rotate-90 lg:rotate-0 ${accent}`} aria-hidden="true" />}
                </div>
                <h3 className="mb-2 text-lg font-bold">{stepTitle}</h3>
                <p className="leading-7 text-slate-600">{description}</p>
              </li>
            ))}
          </ol>
          <p className={`mt-4 flex items-start gap-3 rounded-xl p-5 leading-7 ${background} ${accent}`}>
            <Info size={20} className="mt-1 shrink-0" aria-hidden="true" />
            <span>{note}</span>
          </p>
        </section>
      ))}

      <section id="recruitment" aria-labelledby="recruitment-title" className="mt-14 scroll-mt-48 border-t border-slate-200 pt-12">
        <p className="eyebrow">공통 운영 기준</p>
        <h2 id="recruitment-title" className="mb-6 text-2xl font-bold">모집 미달 시 조율·폐강 기준</h2>
        <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
          <ol className="space-y-4">
            {RECRUITMENT_STEPS.map(({ title, description, badge, style, numberStyle }, index) => (
              <li key={title} className={`flex items-start gap-4 rounded-xl border p-5 sm:p-6 ${style}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold ${numberStyle}`}><span className="sr-only">단계 </span>{index + 1}</span>
                <div>
                  <span className="text-sm font-semibold text-slate-600">{badge}</span>
                  <h3 className="mb-2 mt-1 text-lg font-bold">{title}</h3>
                  <p className="leading-7 text-slate-600">{description}</p>
                </div>
              </li>
            ))}
          </ol>
          <aside aria-labelledby="quality-title" className="rounded-2xl bg-uc-navy p-7 text-white sm:p-8">
            <ShieldCheck size={32} className="mb-5 text-teal-200" aria-hidden="true" />
            <h3 id="quality-title" className="text-xl font-bold">운영 품질과 예산 효율을 위한 원칙</h3>
            <p className="mt-4 leading-8 text-slate-200">무기한 일정 연기로 인한 행정력 소모를 방지하고, 예산과 시설을 효율적으로 운영하기 위해 조율 횟수의 상한을 정합니다.</p>
            <p className="mt-6 flex items-center gap-2 border-t border-white/20 pt-5 font-bold text-teal-200"><Check size={20} className="shrink-0" aria-hidden="true" />내부·외부 과정 모두 최대 3회 조율</p>
          </aside>
        </div>
      </section>

      <section id="settlement" aria-labelledby="settlement-title" className="mt-14 scroll-mt-48">
        <p className="eyebrow">과정 종료 후</p>
        <h2 id="settlement-title" className="mb-5 text-2xl font-bold">결과보고 및 정산 절차</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {SETTLEMENT_STEPS.map(({ title, description }, index) => (
            <li key={title} className="rounded-xl border border-slate-200 bg-white p-6">
              <span className="text-sm font-bold text-teal-800"><span className="sr-only">단계 </span>0{index + 1}</span>
              <h3 className="mb-3 mt-4 text-lg font-bold">{title}</h3>
              <p className="leading-8 text-slate-600">{description}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 p-5 leading-7 text-teal-900">
          <ClipboardCheck size={22} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span><strong>정산 원칙</strong> · 내부·외부 과정 모두 결과보고가 완료된 건에 한하여 진행합니다. 강사료·장학금 지급 수속은 결과보고서 승인 후 진행합니다.</span>
        </p>
      </section>

      <div className="mt-12 flex flex-wrap gap-3 border-t border-slate-200 pt-8">
        <Link href="/terms" className="btn-primary gap-2">수강안내<ArrowRight size={18} aria-hidden="true" /></Link>
        <Link href="/courses" className="btn-secondary">교육과정 소개</Link>
      </div>
    </div>
  );
}
