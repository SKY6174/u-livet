import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ClipboardCheck,
  FilePenLine,
  Phone,
  Search,
} from "lucide-react";
import { PageIntro } from "@/components/portal/ui";
import { SupportContact } from "@/components/common/support-contact";

const STEPS = [
  {
    title: "과정 찾기",
    description: "나에게 맞는 교육과정을 고르고, 교육대상과 운영 일정을 확인하세요.",
    icon: Search,
    href: "/courses",
    action: "교육과정 둘러보기",
  },
  {
    title: "로그인·수강신청",
    description: "로그인 후 과정 상세 화면에서 모집·개인정보 수집 안내를 확인하고 신청하세요.",
    icon: FilePenLine,
    href: "/courses",
    action: "신청할 과정 찾기",
  },
  {
    title: "심사·수강 확정",
    description: "과정별 선발 방식에 따라 수강이 확정됩니다. 나의 공간에서 신청 결과를 확인하세요.",
    icon: ClipboardCheck,
    href: "/mypage",
    action: "신청 현황 확인",
  },
  {
    title: "강의실 이용",
    description: "수강 확정 후 나의 공간에서 강의실에 입장해 자료 열람, 과제 제출과 피드백을 이용하세요.",
    icon: BookOpen,
    href: "/mypage",
    action: "나의 강의실 찾기",
  },
];

const QUESTIONS = [
  {
    category: "심사·대기",
    question: "신청하면 바로 수강할 수 있나요?",
    answer: "심사 과정은 사업단 확인 후 수강이 확정됩니다. 선착순 과정은 정원이 차면 대기로 접수됩니다. 신청 상태와 수강 확정 여부는 나의 공간에서 확인하세요.",
    href: "/mypage",
    action: "나의 신청 현황 보기",
  },
  {
    category: "취소·환불",
    question: "신청을 취소하거나 환불받으려면 어떻게 하나요?",
    answer: "교육 시작 전 신청 취소는 나의 공간에서 처리합니다. 교육 시작 후 취소와 유료 과정의 환불은 과정별 안내와 사업단 확인이 필요합니다.",
    href: "/mypage",
    action: "신청 내역 확인하기",
  },
  {
    category: "수료·증명",
    question: "수료 여부와 증명서 발급은 어디서 확인하나요?",
    answer: "수료 여부는 승인된 기준과 사업단 확인에 따라 결정됩니다. 나의 수강이력에서 수료 상태를 확인할 수 있습니다. 이수증·디지털배지 발급은 준비 중입니다.",
    href: "/mypage/history",
    action: "나의 수강이력 보기",
    notice: "이수증·디지털배지 발급 준비 중",
  },
];

export default function Terms() {
  return (
    <div className="page-shell">
      <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="[&>div]:mb-0">
          <PageIntro eyebrow="LEARNING GUIDE" title="수강안내" />
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/courses" className="btn-primary gap-2">
            교육과정 찾기 <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link href="/mypage" className="btn-secondary justify-center">
            신청 현황 확인
          </Link>
        </div>
      </div>

      <section aria-labelledby="preparation-title" className="mb-10 flex flex-col gap-4 rounded-2xl border border-teal-100 bg-teal-50 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 id="preparation-title" className="font-bold text-teal-900">신청 전, 다섯 가지만 확인하세요</h2>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-teal-900">
          {["교육대상", "일정", "장소", "수강료", "수료기준"].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <Check size={18} className="shrink-0" aria-hidden="true" />{item}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="steps-title">
        <h2 id="steps-title" className="mb-5 text-2xl font-bold text-slate-900">한눈에 보는 수강 절차</h2>
        <ol className="grid divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-4 lg:divide-x lg:divide-y-0">
          {STEPS.map(({ title, description, icon: Icon, href, action }, index) => (
            <li key={title} className="flex flex-col p-6 lg:p-7">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-sm font-bold tracking-label text-teal-800">
                  <span className="sr-only">단계 </span>0{index + 1}
                </span>
                <Icon size={26} className="text-teal-700" strokeWidth={1.6} aria-hidden="true" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">{title}</h3>
              <p className="mb-5 mt-3 leading-relaxed text-slate-600">{description}</p>
              <Link href={href} className="mt-auto inline-flex min-h-11 items-center gap-2 self-start font-semibold text-teal-800 underline-offset-4 hover:underline">
                {action}<ArrowRight size={16} className="shrink-0" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-12 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section aria-labelledby="questions-title">
          <h2 id="questions-title" className="mb-5 text-2xl font-bold text-slate-900">궁금한 점을 확인하세요</h2>
          <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {QUESTIONS.map(({ category, question, answer, href, action, notice }) => (
              <details key={category} className="group">
                <summary className="flex min-h-20 cursor-pointer list-none items-center gap-4 p-5 hover:bg-slate-50 sm:p-6 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1">
                    <span className="mb-1 block text-sm font-semibold text-teal-800">{category}</span>
                    <span className="font-bold text-slate-900">{question}</span>
                  </span>
                  <ChevronDown size={20} className="shrink-0 text-slate-500 group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="px-5 pb-6 sm:px-6">
                  <p className="leading-relaxed text-slate-600">{answer}</p>
                  {notice && <p className="mt-3 inline-block rounded-md bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-900">{notice}</p>}
                  <Link href={href} className="mt-3 flex min-h-11 w-fit items-center gap-2 font-semibold text-teal-800 underline-offset-4 hover:underline">
                    {action}<ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </details>
            ))}
          </div>
        </section>

        <aside aria-labelledby="help-title" className="rounded-2xl bg-[#102b5b] p-7 text-white lg:mt-14">
          <Phone size={26} className="mb-5 text-teal-200" aria-hidden="true" />
          <h2 id="help-title" className="text-xl font-bold">도움이 필요하신가요?</h2>
          <p className="mb-5 mt-3 leading-relaxed text-slate-200">과정별 모집 안내를 먼저 확인해 주세요. 추가 문의는 해당 과정을 운영하는 센터로 연락해 주세요.</p>
          <SupportContact className="text-teal-50 [&_a:focus-visible]:outline-white" />
        </aside>
      </div>
    </div>
  );
}
