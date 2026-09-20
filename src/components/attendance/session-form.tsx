import { scheduleClass } from "@/app/evaluation-actions";
import { ActionForm } from "@/components/portal/action-form";
import type { AttendanceBook } from "@/lib/attendance/model";
export function SessionForm({ book }: { book: AttendanceBook }) {
  return <details className="panel mb-6">
    <summary className="cursor-pointer font-semibold text-teal-800">출석부 생성 · 수업/보강 일정 추가</summary>
    <p className="my-4 text-sm text-slate-600">수업을 등록하면 수강 확정 명단으로 출석부가 구성됩니다. 출석 인정은 수업 종료 후 별도로 기록합니다.</p>
    <ActionForm action={scheduleClass} label="수업 등록·출석부 생성">
      <input type="hidden" name="offering" value={book.offering.id} />
      <label className="field">수업명<input name="title" maxLength={200} required placeholder="예: 1차시 · 기초 실습" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">시작 (한국시간)<input type="datetime-local" name="starts_at" min={`${book.offering.starts_on}T00:00`} max={`${book.offering.ends_on}T23:59`} required /></label>
        <label className="field">종료 (한국시간)<input type="datetime-local" name="ends_at" min={`${book.offering.starts_on}T00:00`} max={`${book.offering.ends_on}T23:59`} required /></label>
      </div>
      <label className="field">수업 구분<select name="replaces"><option value="">정규 수업</option>
        {book.sessions.filter(s => s.status === "CANCELLED" && !book.sessions.some(other => other.replaces_id === s.id)).map(s => <option key={s.id} value={s.id}>{s.title} · 보강</option>)}
      </select></label>
    </ActionForm>
  </details>;
}
