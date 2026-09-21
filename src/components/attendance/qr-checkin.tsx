"use client";
import { useActionState } from "react";
import { recordStudentQrCheckin } from "@/app/learning/[id]/attendance/checkin-actions";
export function QrCheckin({ offering, session, token, name }: { offering: string; session: string; token: string; name: string }) {
  const [state, action, pending] = useActionState(recordStudentQrCheckin, { message: "" });
  return <section className="panel text-center">
    <h2 className="text-xl font-bold">{name} 님의 입실 확인</h2>
    <p className="my-4 text-sm text-slate-600">강의실에 도착했다면 아래 버튼을 눌러 주세요. 입실 확인과 최종 출석 인정시간은 구분됩니다.</p>
    {!state.ok && <form action={action}>
      <input type="hidden" name="offering" value={offering} />
      <input type="hidden" name="session" value={session} />
      <input type="hidden" name="token" value={token} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "확인 중…" : "내 입실 확인하기"}</button>
    </form>}
    {state.message && <p role={state.ok ? "status" : "alert"} className={`mt-5 ${state.ok ? "text-teal-800" : "text-red-700"}`}>{state.message}</p>}
    {state.ok && <div className="mt-5 rounded-xl bg-teal-50 p-4"><strong>{state.sessionTitle}</strong><p className="mt-2 text-sm">최초 확인 {new Date(state.checkedInAt!).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</p></div>}
  </section>;
}
