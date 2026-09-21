import Link from "next/link";
import { getAttendanceBook } from "@/lib/attendance/data";
import { attendanceIndex, attendanceState, attendanceSummary, formatMinutes, sessionMinutes } from "@/lib/attendance/model";
import { PageIntro, Empty } from "@/components/portal/ui";
import { dateTime } from "@/lib/portal/data";
export default async function MyAttendance({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { book } = await getAttendanceBook(id, "learner");
  if (!book) return <div className="page-shell"><Empty title="출석 현황을 불러오지 못했습니다">잠시 후 다시 시도해 주세요.</Empty></div>;
  const index = attendanceIndex(book.attendance), now = Date.parse(book.generated_at);
  const summary = attendanceSummary(book.sessions, index, book.viewer_id, now);
  return <div className="page-shell">
    <Link className="text-sm text-teal-800" href={`/learning/${id}`}>← 나의 강의실</Link>
    <PageIntro eyebrow="MY ATTENDANCE" title="나의 출석 확인">{book.offering.name} · 담당 강사가 기록한 본인의 출결입니다.</PageIntro>
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[["종료된 수업", `${summary.ended}회`], ["출결 확인", `${summary.recorded}회 / 미입력 ${summary.missing}회`], ["인정시간", `${formatMinutes(summary.credited)} / ${formatMinutes(summary.total)}분`], ["진행 수업 출석률", summary.percent === null ? summary.missing ? "확인 중" : "종료 수업 없음" : `${summary.percent}%`]].map(([label, value]) => <div key={label} className="panel"><p className="text-sm text-slate-500">{label}</p><p className="mt-3 text-lg font-bold">{value}</p></div>)}
    </div>
    <p className="notice mb-8">종료된 정상 수업만 집계합니다. 미입력은 결석이 아니며 모두 기록된 뒤 출석률을 표시합니다. 최종 수료는 전체 수업과 승인된 기준에 따라 별도로 판정합니다. 기록 정정은 담당 강사에게 문의해 주세요.</p>
    {book.qr_unavailable && <p className="notice mb-5">QR 입실 기록을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>}
    <h2 className="section-title">수업별 출석 내역</h2>
    {!book.sessions.length ? <Empty title="수업 일정이 준비 중입니다" /> : <div className="grid gap-4 md:grid-cols-2">{book.sessions.map(session => {
      const record = index.get(`${session.id}:${book.viewer_id}`), state = attendanceState(session, record, now);
      const checkin = book.qr_checkins?.find(q => q.session_id === session.id && q.person_id === book.viewer_id);
      return <article key={session.id} className="panel">
        <span className="badge">{state}{session.replaces_id ? " · 보강" : ""}</span>
        <h3 className="mt-4 text-lg font-bold">{session.title}</h3>
        <p className="my-3 text-sm text-slate-500">{dateTime(session.starts_at)} ~ {dateTime(session.ends_at)}</p>
        {checkin && <p className="mb-3 text-sm text-teal-800">QR 입실 확인 {dateTime(checkin.checked_in_at)} · 최종 인정시간은 강사가 확인합니다.</p>}
        {session.status === "CANCELLED" ? <p>휴강 사유: {session.reason}</p> : record ? <>
          <p className="font-bold text-teal-800">인정시간 {formatMinutes(record.credited_minutes)} / {formatMinutes(sessionMinutes(session))}분</p>
          <p className="mt-3 break-words text-sm">확인 근거: {record.reason}</p><p className="mt-2 text-xs text-slate-500">최종 기록 {dateTime(record.recorded_at)}</p>
        </> : <p className="text-sm text-slate-600">{state === "미입력" ? "강사의 출결 확인을 기다리고 있습니다." : "수업 종료 후 출결이 기록됩니다."}</p>}
      </article>;
    })}</div>}
  </div>;
}
