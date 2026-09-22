import { attendanceIndex, attendanceState, attendanceSummary, formatMinutes, type AttendanceBook as Book } from "@/lib/attendance/model";
import { dateTime } from "@/lib/portal/data";
export function AttendanceBook({ book }: { book: Book }) {
  const index = attendanceIndex(book.attendance), now = Date.parse(book.generated_at);
  if (!book.sessions.length || !book.members.length) return <div className="panel mb-6">
    {!book.sessions.length ? "수업 일정을 등록해 출석부를 생성하세요." : "수강 확정자가 등록되면 출석부에 자동으로 표시됩니다."}
  </div>;
  return <section className="mb-8" aria-label="전체 출석부">
    <h2 className="section-title">전체 출석부 · {book.members.length}명 / {book.sessions.length}회차</h2>
    <p className="mb-3 text-sm text-slate-600">칸의 숫자는 인정시간(분)입니다. 미입력은 결석과 다릅니다. 휴강은 집계에서 제외합니다.</p>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white" tabIndex={0} role="region" aria-label="회차별 출석부 표 (좌우 스크롤)">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">수강생별 회차 출석 인정시간</caption>
        <thead className="bg-slate-100"><tr>
          <th scope="col" className="sticky left-0 z-10 min-w-28 bg-slate-100 p-3 text-left">수강생</th>
          {book.sessions.map(s => <th scope="col" key={s.id} className="min-w-36 border-l border-slate-200 p-3 text-center">
            <span className="block">{s.title}{s.replaces_id ? " · 보강" : ""}</span><span className="mt-1 block text-xs font-normal text-slate-500">{dateTime(s.starts_at)}</span>
          </th>)}<th scope="col" className="min-w-32 border-l border-slate-200 p-3">종료 수업 집계</th>
        </tr></thead>
        <tbody>{book.members.map(member => {
          const summary = attendanceSummary(book.sessions, index, member.person_id, now);
          return <tr key={member.person_id} className="border-t border-slate-200">
            <th scope="row" className="sticky left-0 bg-white p-3 text-left">{member.name}</th>
            {book.sessions.map(s => {
              const record = index.get(`${s.id}:${member.person_id}`), state = attendanceState(s, record, now);
              return <td key={s.id} className="border-l border-slate-200 p-3 text-center">
                <span className={state === "미입력" ? "text-amber-800" : state === "결석" ? "text-red-700" : "text-slate-600"}>{state}</span>
                {record && s.status !== "CANCELLED" && <strong className="mt-1 block text-base">{formatMinutes(record.credited_minutes)}분</strong>}
              </td>;
            })}
            <td className="border-l border-slate-200 p-3 text-center"><strong>{formatMinutes(summary.credited)}분</strong><span className="mt-1 block text-xs">{summary.missing ? `미입력 ${summary.missing}회` : summary.percent === null ? "종료 수업 없음" : `${summary.percent}%`}</span></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </section>;
}
