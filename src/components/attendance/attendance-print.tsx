import Image from "next/image";
import { attendanceIndex, attendanceState, attendanceSummary, formatMinutes, sessionMinutes, type AttendanceBook } from "@/lib/attendance/model";
import styles from "./attendance-print.module.css";

const groupsOf = <T,>(items: T[], size: number) => Array.from(
  { length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i+1)*size),
);
const date = (value: string) => new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit",
}).format(new Date(value));
const time = (value: string) => new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false,
}).format(new Date(value));

export function AttendancePrint({ book, official = false }: { book: AttendanceBook; official?: boolean }) {
  const index = attendanceIndex(book.attendance), now = Date.parse(book.generated_at);
  const sessions = book.sessions.filter((session) => session.status === "SCHEDULED");
  const landscape = sessions.length >= 5;
  const groups = groupsOf(sessions,landscape ? 5 : 4), members = groupsOf(book.members,landscape ? 18 : 20);
  const qr = new Map((book.qr_checkins ?? []).map((checkin) => [`${checkin.session_id}:${checkin.person_id}`,checkin.checked_in_at]));
  const expected = sessions.filter((session) => Date.parse(session.ends_at) <= now).length * book.members.length;
  const finalized = expected > 0 && expected === book.attendance.filter((row) => sessions.some((session) => session.id === row.session_id && Date.parse(session.ends_at) <= now)).length
    && sessions.every((session) => Date.parse(session.ends_at) <= now);
  if (!groups.length || !members.length) return <p className="page-shell">수업 일정과 수강 확정 명단을 등록하면 출석부가 생성됩니다.</p>;
  return <div className="report-output">
    {book.qr_unavailable && <p className="no-print notice mx-auto max-w-4xl">QR 확인 기록을 불러오지 못했습니다. QR 열을 확인한 뒤 다시 출력하세요.</p>}
    {groups.flatMap((part, si) => members.map((people, pi) => <section
      className={`report-sheet report-form-20 ${landscape ? "report-landscape" : "report-portrait"} ${styles.sheet}`}
      key={`${si}:${pi}`}>
      <h1>출석부</h1>
      <table className={`report-table ${styles.meta}`}><tbody>
        <tr><th>과정명</th><td>{book.offering.name}</td><th>교육기간</th><td>{book.offering.starts_on} ~ {book.offering.ends_on}</td></tr>
        <tr><th>교육시간</th><td>{formatMinutes(sessions.reduce((sum,s) => sum+sessionMinutes(s),0))}분</td><th>확정 상태</th><td>{official && finalized && !book.qr_unavailable ? "최종 확정" : "확인 중"}</td></tr>
      </tbody></table>
      <p className={styles.caption}>회차별 QR 입실 및 강사 확정 출결 · {book.members.length}명 · {si*members.length+pi+1}/{groups.length*members.length}쪽</p>
      <table className={`report-table ${styles.ledger}`}>
        <caption className="sr-only">수강생별 QR 입실 시각과 최종 확정 출결</caption>
        <thead><tr><th rowSpan={2} scope="col" className={styles.number}>번호</th><th rowSpan={2} scope="col" className={styles.name}>성명</th>
          {part.map((session) => <th colSpan={2} scope="colgroup" key={session.id}>
            {book.sessions.indexOf(session)+1}회 · {date(session.starts_at)}<br />{time(session.starts_at)}~{time(session.ends_at)}
          </th>)}<th rowSpan={2} scope="col" className={styles.total}>인정시간<br />출석률</th></tr>
          <tr>{part.map((session) => <FragmentPair key={session.id} />)}</tr>
        </thead>
        <tbody>{people.map((person,i) => {
          const summary = attendanceSummary(book.sessions,index,person.person_id,now);
          return <tr key={person.person_id}><td>{pi*(landscape ? 18 : 20)+i+1}</td><th scope="row">{person.name}</th>
            {part.map((session) => {
              const key = `${session.id}:${person.person_id}`, checked = qr.get(key);
              const record = index.get(key), state = attendanceState(session,record,now);
              return <GroupCells key={session.id} qr={checked ? time(checked) : "—"} state={state} minutes={record?.credited_minutes} />;
            })}
            <td>{formatMinutes(summary.credited)}분<br />{summary.missing ? `미확정 ${summary.missing}회` : summary.percent === null ? "—" : `${summary.percent}%`}</td>
          </tr>;
        })}</tbody>
      </table>
      <p className="report-note">QR 입실 확인은 최종 출석 인정이 아닙니다. 확정 출결은 강사가 수업 종료 후 입력한 인정시간입니다. ‘미확정’은 결석을 뜻하지 않습니다.</p>
      <p className="report-note">조회 시각 {new Intl.DateTimeFormat("ko-KR", { timeZone:"Asia/Seoul",dateStyle:"medium",timeStyle:"short" }).format(new Date(book.generated_at))}</p>
      <Image className="report-form-logo" src="/images/anchor-form-logo.png" width={432} height={71} alt="울산과학대학교 지역성장 인재양성체계(앵커)사업단" unoptimized />
    </section>))}
  </div>;
}

function FragmentPair() { return <><th scope="col">QR 입실</th><th scope="col">확정 출결</th></>; }
function GroupCells({ qr, state, minutes }: { qr: string; state: string; minutes?: number }) {
  return <><td>{qr}</td><td>{state === "미입력" ? "미확정" : state}{minutes !== undefined && <><br />{formatMinutes(minutes)}분</>}</td></>;
}
