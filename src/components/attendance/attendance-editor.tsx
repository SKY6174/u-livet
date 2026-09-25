"use client";
import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAttendanceBatch } from "@/app/attendance-actions";
import { cancelClass } from "@/app/evaluation-actions";
import { ActionForm } from "@/components/portal/action-form";
import { attendanceIndex, formatMinutes, sessionMinutes, type AttendanceBook } from "@/lib/attendance/model";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";
type Draft = { minutes: string; reason: string; expected_revision: number };
export function AttendanceEditor({ book }: { book: AttendanceBook }) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState(book.sessions.find(s => s.status === "SCHEDULED" && Date.parse(s.ends_at) <= Date.parse(book.generated_at))?.id ?? book.sessions[0]?.id ?? "");
  const [drafts, setDrafts] = useState<Record<string, Record<string, Draft>>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const savingSession = useRef("");
  const [state, action, pending] = useActionState(saveAttendanceBatch, { message: "" });
  useEffect(() => {
    if (!state.ok) return;
    setDrafts(current => { const next = { ...current }; delete next[savingSession.current]; return next; });
    setReasons(current => { const next = { ...current }; delete next[savingSession.current]; return next; });
    router.refresh();
  }, [state, router]);
  const index = useMemo(() => attendanceIndex(book.attendance), [book.attendance]);
  const session = book.sessions.find(s => s.id === sessionId);
  if (!session) return null;
  const rows = drafts[sessionId] ?? {}, commonReason = reasons[sessionId] ?? "";
  const minutes = sessionMinutes(session);
  const locked = pending || session.status === "CANCELLED" || Date.parse(session.ends_at) > Date.parse(book.generated_at);
  const records = Object.entries(rows).map(([person_id, row]) => ({ person_id, minutes: row.minutes === "" ? null : Number(row.minutes), reason: row.reason.trim() || commonReason.trim(), expected_revision: row.expected_revision }));
  function change(person: string, row: Draft | null) {
    setDrafts(current => { const next = { ...current[sessionId] }; if (row) next[person] = row; else delete next[person]; return { ...current, [sessionId]: next }; });
  }
  return <section className="panel" aria-label="회차별 출결 기록">
    <h2 className="section-title">회차별 출결 기록</h2>
    <label className="field mb-5">기록할 수업<select value={sessionId} onChange={e => setSessionId(e.target.value)} disabled={pending}>
      {book.sessions.map(s => <option key={s.id} value={s.id}>{s.title}{s.status === "CANCELLED" ? " · 휴강" : ""}</option>)}
    </select></label>
    {locked && !pending && <p className="notice mb-5">{session.status === "CANCELLED" ? "휴강한 수업입니다. 보강 수업을 등록해 주세요." : "수업 종료 후 출결을 기록할 수 있습니다. 종료 후 새로고침해 주세요."}</p>}
    {book.qr_unavailable && <p className="notice mb-5">QR 입실 기록을 불러오지 못했습니다. 수강생에게 직접 확인한 뒤 출결을 기록해 주세요.</p>}
    <form onSubmit={event => {
      event.preventDefault();
      if (locked) return;
      savingSession.current = sessionId;
      const data = new FormData(event.currentTarget);
      startTransition(() => action(data));
    }} className="space-y-5">
      <input type="hidden" name="session" value={sessionId} />
      <input type="hidden" name="records" value={JSON.stringify(records)} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="field min-w-0 flex-1">공통 확인 근거<input value={commonReason} onChange={e => setReasons(current => ({ ...current, [sessionId]: e.target.value }))} disabled={locked} maxLength={1000} placeholder="예: 강의실에서 직접 출석 확인" /></label>
        <button type="button" className="btn-secondary" disabled={locked || !book.members.length} onClick={() => {
          const next = { ...rows };
          for (const member of book.members) if (member.person_id !== book.viewer_id && !index.has(`${sessionId}:${member.person_id}`) && !next[member.person_id]) {
            next[member.person_id] = { minutes: String(minutes), reason: "", expected_revision: 0 };
          }
          setDrafts(current => ({ ...current, [sessionId]: next }));
        }}>미입력자 전원 출석 선택</button>
      </div>
      <p className="text-sm text-slate-600">선택한 수강생만 저장합니다. 결석은 0분, 지각·조퇴는 실제 인정시간을 입력하세요. 전원 선택은 저장 전 초안이며 기존 기록을 덮어쓰지 않습니다.</p>
      <div className="space-y-4">{book.members.map(member => {
        const prior = index.get(`${sessionId}:${member.person_id}`), row = rows[member.person_id], self = member.person_id === book.viewer_id;
        const checkin = book.qr_checkins?.find(q => q.session_id === sessionId && q.person_id === member.person_id);
        return <fieldset key={member.person_id} disabled={locked || self} className="rounded-xl border border-slate-200 p-4">
          <legend className="px-2 font-semibold"><label className="inline-flex items-center gap-2"><input type="checkbox" disabled={locked || self} checked={!!row} onChange={e => change(member.person_id, e.target.checked ? { minutes: prior ? String(prior.credited_minutes) : "", reason: "", expected_revision: prior?.revision ?? 0 } : null)} />{member.name}</label></legend>
          <p className="mb-3 text-sm text-slate-500">{self ? "본인 출석 기록 불가" : prior ? `현재 ${formatMinutes(prior.credited_minutes)}분 · ${prior.reason}` : "아직 기록되지 않았습니다."}</p>
          {checkin && <p className="mb-3 text-xs font-semibold text-teal-800">
            QR 시작 {new Date(checkin.checked_in_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
            {checkin.checked_out_at && <> · 종료 {new Date(checkin.checked_out_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</>}
            <span className="block font-normal">QR 시각을 참고해 실제 인정시간을 확인해 주세요.</span>
          </p>}
          {row && row.expected_revision !== (prior?.revision ?? 0) && <div className="notice mb-3">
            <p>다른 작업에서 기록이 변경되었습니다. 위의 현재 기록을 확인해 주세요.</p>
            <button type="button" className="mt-2 text-sm font-bold underline" onClick={() => change(member.person_id, { ...row, expected_revision: prior?.revision ?? 0 })}>현재 기록을 확인했으며 입력 내용으로 정정</button>
          </div>}
          {row && <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <label className="field">인정시간 (최대 {formatMinutes(minutes)}분)<input type="number" min={0} max={minutes} step="any" value={row.minutes} required onChange={e => change(member.person_id, { ...row, minutes: e.target.value })} /></label>
            <label className="field">개별 근거·정정 사유<input maxLength={1000} value={row.reason} required={!commonReason.trim()} placeholder="비워두면 공통 근거 적용" onChange={e => change(member.person_id, { ...row, reason: e.target.value })} /></label>
          </div>}
        </fieldset>;
      })}</div>
      <div className="flex flex-wrap gap-3">
        <button className="btn-primary" disabled={locked || !records.length || records.length > 200}>{pending ? "저장 중…" : `선택 ${records.length}명 출결 저장`}</button>
        <button type="button" className="btn-secondary" disabled={pending} onClick={() => router.refresh()}>최신 출석부 확인</button>
      </div>
      {records.length > 200 && <p role="alert" className="text-red-700">한 번에 200명까지 선택할 수 있습니다.</p>}
      {state.message && <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-teal-800" : "text-red-700"}>{state.message}</p>}
      {state.message === MFA_REAUTH_MESSAGE && <a className="btn-secondary" target="_blank" rel="noopener noreferrer" href={`/auth/security?next=${encodeURIComponent(`/instructor/offerings/${book.offering.id}/attendance`)}`}>추가 인증하기 (새 창)</a>}
    </form>
    {session.status !== "CANCELLED" && <details className="mt-6 border-t pt-5"><summary className="cursor-pointer text-sm text-slate-600">선택 수업 휴강 처리</summary><div className="mt-4"><ActionForm action={cancelClass} label="휴강 기록" disabled={pending}>
      <input type="hidden" name="session" value={sessionId} /><label className="field">휴강 사유<input name="reason" maxLength={1000} required /></label>
    </ActionForm></div></details>}
  </section>;
}
