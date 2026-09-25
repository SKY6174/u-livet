"use client";
import { useActionState } from "react";
import { recordStudentQrCheckin } from "@/app/learning/[id]/attendance/checkin-actions";
export function QrCheckin({ offering, session, token, name }: { offering: string; session: string; token: string; name: string }) {
  const [state, action, pending] = useActionState(recordStudentQrCheckin, { message: "" });
  return <section className="panel text-center">
    <h2 className="text-xl font-bold">{name} 님의 QR 확인</h2>
    {state.ok && <p className="mt-1 text-xs text-slate-600">{state.phase === "END" ? "종료" : "시작"} · {new Date(state.phase === "END" ? state.checkedOutAt! : state.checkedInAt!).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</p>}
    <p className="my-4 text-sm text-slate-600">강의실에서 안내받은 QR의 시작·종료 시각을 확인합니다. 최종 출석 인정시간은 별도로 확정됩니다.</p>
    {!state.ok && <form action={action}>
      <input type="hidden" name="offering" value={offering} />
      <input type="hidden" name="session" value={session} />
      <input type="hidden" name="token" value={token} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "확인 중…" : "내 QR 시각 기록하기"}</button>
    </form>}
    {state.message && <p role={state.ok ? "status" : "alert"} className={`mt-5 ${state.ok ? "text-teal-800" : "text-red-700"}`}>{state.message}</p>}
    {state.ok && <div className="mt-5 rounded-xl bg-teal-50 p-4"><strong>{state.sessionTitle}</strong></div>}
  </section>;
}
