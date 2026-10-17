import Link from "next/link";

export function ScholarshipNotice({ archived = false }: { archived?: boolean }) {
  return (
    <section className="panel space-y-4">
      <h2 className="section-title">장학금 안내</h2>
      <p className="leading-7 text-slate-700">
        {archived
          ? "운영이 종료된 과정입니다. 당시 장학금 지원 여부와 지급 내역은 사업단에서 확인해 주세요."
          : "장학금 지원 여부·지급 대상·금액·신청 일정은 과정별 사업단 안내를 확인해 주세요."}
      </p>
      {archived ? <p className="text-sm leading-6 text-slate-600">
        등록된 본인 지급 내역은 나의 공간에서 확인할 수 있습니다. 내역이 없거나 추가 서류·지급 상태 확인이 필요한 경우 사업단에 문의해 주세요.
      </p> : <>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
          <li>지원 대상으로 안내받은 수강생은 수강신청원서 승인과 수료 인정 후 장학금 지급신청서를 제출합니다.</li>
          <li>장학금 지원이 확정된 과정은 수료 처리와 운영 결과보고서 승인 후 지급 절차를 진행합니다.</li>
        </ol>
        <p className="text-sm leading-6 text-slate-600">수료 인정이나 신청서 접수만으로 장학금 지급이 확정되지는 않습니다.</p>
      </>}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <Link href="/mypage#scholarships" className="font-semibold text-teal-800 underline">내 장학금 내역 확인</Link>
        <Link href="/terms#help-title" className="font-semibold text-teal-800 underline">사업단 연락처 확인</Link>
      </div>
    </section>
  );
}
