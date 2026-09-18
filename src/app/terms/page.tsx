import { PageIntro } from "@/components/portal/ui";
export default function Terms() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <PageIntro eyebrow="LEARNING GUIDE" title="수강안내" />
      <div className="panel space-y-6">
        {[
          [
            "과정 찾기",
            "과정별 교육대상, 일정, 장소, 수강료와 수료기준을 확인하세요.",
          ],
          [
            "수강신청",
            "로그인한 뒤 해당 과정의 모집·개인정보 수집 안내를 확인하고 신청합니다. 신청 결과는 나의 공간에서 확인하세요.",
          ],
          [
            "심사와 수강 확정",
            "심사 과정은 사업단 확인 후 수강이 확정됩니다. 선착순 과정은 정원이 차면 대기로 접수됩니다.",
          ],
          [
            "강의실 이용",
            "수강이 확정되면 나의 공간에서 강의실에 입장할 수 있습니다. 자료 열람과 과제 제출·피드백을 제공합니다.",
          ],
          [
            "신청 취소와 환불",
            "교육 시작 전 신청 취소는 나의 공간에서 처리합니다. 교육 시작 후 취소와 유료 과정의 환불은 과정별 안내와 사업단 확인이 필요합니다.",
          ],
          [
            "수료와 증명",
            "수료 여부는 승인된 기준과 사업단 확인에 따라 결정됩니다. 이수증·디지털배지 발급은 준비 중입니다.",
          ],
        ].map(([t, b]) => (
          <section key={t}>
            <h2 className="mb-2 text-lg font-bold">{t}</h2>
            <p className="text-slate-600">{b}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
