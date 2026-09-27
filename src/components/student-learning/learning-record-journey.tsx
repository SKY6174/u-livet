import Link from "next/link";
import { ArrowUpRight, BookOpenCheck, FileBadge2, Files, Link2 } from "lucide-react";

const NATIONAL_PORTAL = "https://www.all.go.kr/";

const steps = [
  {
    title: "학습이력 등록",
    description: "내 수강·수료 기록을 확인하고, 학력·경력·자격 등 추가 이력은 국가 포털에 등록하세요.",
    icon: BookOpenCheck,
    action: "국가 포털에서 등록",
  },
  {
    title: "연계동의",
    description: "다른 기관의 학습이력을 불러오려면 국가 포털에서 연계 대상과 동의 내용을 확인하세요.",
    icon: Link2,
    action: "연계동의 확인",
  },
  {
    title: "학습이력증명서 발급",
    description: "국가 포털에 등록된 이력을 확인한 뒤 평생학습이력증명서를 신청하세요.",
    icon: FileBadge2,
    action: "국가 증명서 확인",
  },
  {
    title: "학습이력철 발급",
    description: "등록된 학습이력을 하나의 이력철로 모아 국가 포털에서 발급하세요.",
    icon: Files,
    action: "학습이력철 확인",
  },
] as const;

export function LearningRecordJourney() {
  return (
    <div className="mt-6 rounded-2xl border border-violet-100 bg-violet-50/50 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-wider text-violet-700">평생학습 이력 활용 안내</p>
          <h3 className="mt-2 text-lg font-bold text-slate-900">배움을 기록하고 활용하는 4단계</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            온국민평생배움터의 이용 흐름을 참고했습니다. UC Life 수강이력과 국가 포털의 학습이력은 별도로 관리됩니다.
          </p>
        </div>
        <Link href="/mypage/history" className="btn-secondary gap-2">
          내 수강이력 확인 <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <ol className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map(({ title, description, icon: Icon, action }, index) => (
          <li key={title} className="flex h-full flex-col rounded-xl border border-violet-100 bg-white p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-xs font-bold text-violet-700">{index + 1}단계</span>
            </div>
            <h4 className="mt-4 font-bold text-slate-900">{title}</h4>
            <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{description}</p>
            <a
              href={NATIONAL_PORTAL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-violet-800 hover:underline focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700"
              aria-label={`${action} (온국민평생배움터, 새 창)`}
            >
              {action} <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs leading-5 text-slate-600">
        국가 포털의 이력 등록·연계동의·증명서와 이력철 발급은 온국민평생배움터 로그인 후 진행합니다. UC Life의 사업단 이수증은 아래에서 별도로 신청할 수 있습니다.
      </p>
    </div>
  );
}
