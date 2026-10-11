import { ClipboardCheck, Send, Ticket } from "lucide-react";

export function ParkingWorkflow() {
  return <ol aria-label="주차권 신청·처리 순서" className="grid gap-3 text-sm sm:grid-cols-3">
    {[
      { title: "1. 주차권 신청", detail: "교내·교외강사 및 수강생 · 본인 과정, 사용일, 연락처, 매수 입력", icon: Send },
      { title: "2. 관리자 확인", detail: "승인 대기 목록에서 담당 센터 승인자가 승인 또는 사유와 함께 반려", icon: ClipboardCheck },
      { title: "3. 승인·발급 확인", detail: "승인 시 재고 차감 · 내 신청 내역과 관리자 처리 기록에 결과 표시", icon: Ticket },
    ].map(({ title, detail, icon: Icon }) => <li key={title} className="flex items-start gap-3 rounded-xl border border-teal-100 bg-teal-50/50 p-4">
      <Icon size={18} className="mt-0.5 shrink-0 text-teal-800" aria-hidden="true" />
      <div><strong className="text-teal-900">{title}</strong><p className="mt-1 text-xs leading-relaxed text-slate-600">{detail}</p></div>
    </li>)}
  </ol>;
}
