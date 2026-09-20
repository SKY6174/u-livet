import { attendanceIndex, attendanceState, attendanceSummary, formatMinutes, type AttendanceBook } from "@/lib/attendance/model";
import styles from "./attendance-print.module.css";
import { dateTime } from "@/lib/portal/data";
function chunks<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
}
export function AttendancePrint({ book }: { book: AttendanceBook }) {
  const index = attendanceIndex(book.attendance), now = Date.parse(book.generated_at);
  const groups = chunks(book.sessions, 6), members = chunks(book.members, 20);
  if (!groups.length || !members.length) return <p className="page-shell">수업 일정과 수강 확정 명단을 등록하면 인쇄용 출석부가 생성됩니다.</p>;
  return <div className="report-output">
    {groups.flatMap((sessions, si) => members.map((people, pi) => <section className={`report-sheet report-landscape ${styles.sheet}`} key={`${si}:${pi}`}>
      <h1 className="text-center text-2xl font-bold">강사 출석부</h1>
      <h2 className="my-4 text-lg font-bold">{book.offering.name}</h2>
      <p className="mb-4 text-sm">교육기간 {book.offering.starts_on} ~ {book.offering.ends_on} · 전체 {book.members.length}명 · {si * members.length + pi + 1}/{groups.length * members.length}표</p>
      <table className="report-table w-full table-fixed text-xs">
        <caption className="sr-only">수강생별 출석 인정시간과 서명란</caption>
        <thead><tr><th scope="col" className="w-9">번호</th><th scope="col" className="w-20">성명</th>
          {sessions.map(s => <th scope="col" key={s.id}><span className="block">{s.title}{s.replaces_id ? " · 보강" : ""}</span><span className="block font-normal">{dateTime(s.starts_at)}</span></th>)}
          <th scope="col" className="w-32">종료 수업 인정시간<br/>진행 출석률</th><th scope="col" className="w-20">서명</th>
        </tr></thead>
        <tbody>{people.map((member, i) => {
          const summary = attendanceSummary(book.sessions, index, member.person_id, now);
          return <tr key={member.person_id}><td>{pi * 20 + i + 1}</td><th scope="row">{member.name}</th>
            {sessions.map(s => {
              const record = index.get(`${s.id}:${member.person_id}`), state = attendanceState(s, record, now);
              return <td key={s.id}>{state}{record && s.status !== "CANCELLED" && <strong> · {formatMinutes(record.credited_minutes)}분</strong>}</td>;
            })}
            <td>{formatMinutes(summary.credited)}분 · {summary.missing ? `미입력 ${summary.missing}회` : summary.percent === null ? "종료 수업 없음" : `${summary.percent}%`}</td><td aria-label={`${member.name} 서명란`} />
          </tr>;
        })}</tbody>
      </table>
      <p className="mt-4 text-xs">미입력은 결석과 다릅니다. 휴강·예정 수업은 진행 출석률에서 제외하며, 미입력이 있으면 비율을 확정하지 않습니다. 수료 판정과는 별도입니다.</p>
      <p className="mt-2 text-xs text-slate-500">출력 기준 {dateTime(book.generated_at)}</p>
    </section>))}
  </div>;
}
