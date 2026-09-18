import { PageIntro } from "@/components/portal/ui";
export default function About() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <PageIntro eyebrow="ABOUT U-LIFE" title="배움을 지역의 일과 연결합니다" />
      <div className="panel space-y-5">
        <p>
          울산과학대학교 앵커사업 평생직업교육 홈페이지는 성인학습자의 직무역량
          향상과 새로운 경력 준비를 지원합니다.
        </p>
        <p>
          수강생은 과정 탐색·신청·학습을, 강사는 교육자료와 과제 평가를,
          사업단은 과정 개설과 신청 심사를 한곳에서 관리합니다.
        </p>
        <p>
          연차별 운영계획에 따라 공개되는 교육과정과 모집 안내를 확인해 주세요.
        </p>
      </div>
    </div>
  );
}
