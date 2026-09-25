import Image from "next/image";
import { attendanceIndex, attendanceSummary, formatMinutes, sessionMinutes, type AttendanceBook } from "@/lib/attendance/model";
import type { QrCheckin } from "@/lib/attendance/qr";
import styles from "./attendance-print.module.css";

const groupsOf = <T,>(items: T[], size: number) => Array.from(
  { length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size),
);
const date = (value: string) => new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", year: "2-digit", month: "2-digit", day: "2-digit",
}).format(new Date(value));
const time = (value: string) => new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false,
}).format(new Date(value));
const qrStamp = (value?: string | null) => value
  ? <span className={styles.stamp}>{date(value)}<br />{time(value)}</span> : "—";

export function AttendancePrint({ book, official = false, title = "출석부", attachmentNumber }: {
  book: AttendanceBook; official?: boolean; title?: string; attachmentNumber?: number;
}) {
  const index = attendanceIndex(book.attendance), now = Date.parse(book.generated_at);
  const sessions = book.sessions.filter((session) => session.status === "SCHEDULED");
  const paper = sessions.length > 22 ? "a0" : sessions.length > 15 ? "a1"
    : sessions.length > 10 ? "a2" : sessions.length > 6 ? "a3" : "a4";
  const peoplePerPage = { a4: 8, a3: 14, a2: 20, a1: 28, a0: 32 }[paper];
  const peoplePages = groupsOf(book.members, peoplePerPage);
  const qr = new Map<string, QrCheckin>((book.qr_checkins ?? []).map((checkin) => [
    `${checkin.session_id}:${checkin.person_id}`, checkin,
  ]));
  const expected = sessions.filter((session) => Date.parse(session.ends_at) <= now).length * book.members.length;
  const finalized = expected > 0 && expected === book.attendance.filter((row) => sessions.some(
    (session) => session.id === row.session_id && Date.parse(session.ends_at) <= now,
  )).length && sessions.every((session) => Date.parse(session.ends_at) <= now);
  if (!sessions.length || !peoplePages.length) return <p className="page-shell">수업 일정과 수강 확정 명단을 등록하면 출석부가 생성됩니다.</p>;

  return <div className="report-output">
    {book.qr_unavailable && <p className="no-print notice mx-auto max-w-4xl">QR 확인 기록을 불러오지 못했습니다. QR 열을 확인한 뒤 다시 출력하세요.</p>}
    {peoplePages.map((people, page) => <section
      className={`report-sheet report-form-20 ${paper === "a4" ? "report-landscape" : `report-${paper}-landscape`} ${styles.sheet}`}
      key={page}>
      {attachmentNumber && <div className="report-attachment-marker">[첨부 #{attachmentNumber}]</div>}
      <h1>{title}</h1>
      <table className={`report-table ${styles.meta}`}><tbody>
        <tr><th>과정명</th><td>{book.offering.name}</td><th>교육기간</th><td>{book.offering.starts_on} ~ {book.offering.ends_on}</td></tr>
        <tr><th>교육시간</th><td>{formatMinutes(sessions.reduce((sum, session) => sum + sessionMinutes(session), 0))}분</td><th>확정 상태</th><td>{official && finalized && !book.qr_unavailable ? "최종 확정" : "확인 중"}</td></tr>
      </tbody></table>
      <p className={styles.caption}>전체 {sessions.length}회차 · 수강생 {book.members.length}명 · {page + 1}/{peoplePages.length}쪽</p>
      <table className={`report-table ${styles.ledger}`}>
        <caption className="sr-only">전체 회차별 수강생 QR 시작·종료 시각과 인정시간</caption>
        <thead>
          <tr><th rowSpan={2} scope="col" className={styles.number}>번호</th><th rowSpan={2} scope="col" className={styles.name}>성명</th>
            {sessions.map((session, si) => <th colSpan={2} scope="colgroup" key={session.id} className={styles.session}>
              {si + 1}회차<br />{date(session.starts_at)}<br />{time(session.starts_at)}–{time(session.ends_at)}
            </th>)}
            <th rowSpan={2} scope="col" className={styles.total}>인정시간<br />출석률</th>
          </tr>
          <tr>{sessions.map((session) => <FragmentPair key={session.id} />)}</tr>
        </thead>
        <tbody>{people.map((person, i) => {
          const summary = attendanceSummary(book.sessions, index, person.person_id, now);
          return <tr key={person.person_id}><td>{page * peoplePerPage + i + 1}</td><th scope="row">{person.name}</th>
            {sessions.map((session) => <FragmentCells key={session.id} checkin={qr.get(`${session.id}:${person.person_id}`)} />)}
            <td>{formatMinutes(summary.credited)}분<br />{summary.missing ? `미확정 ${summary.missing}회` : summary.percent === null ? "—" : `${summary.percent}%`}</td>
          </tr>;
        })}</tbody>
      </table>
      <p className="report-note">QR 시작·종료 시각은 출석 인정시간과 다릅니다. 실제 인정시간은 강사 확정 출결을 따르며 ‘미확정’은 결석을 뜻하지 않습니다.</p>
      <p className="report-note">조회 시각 {new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(book.generated_at))}</p>
      <Image className="report-form-logo" src="/images/anchor-form-logo.png" width={432} height={71} alt="울산과학대학교 지역성장 인재양성체계(앵커)사업단" unoptimized />
    </section>)}
  </div>;
}

function FragmentPair() { return <><th scope="col">시작</th><th scope="col">종료</th></>; }
function FragmentCells({ checkin }: { checkin?: QrCheckin }) {
  return <><td>{qrStamp(checkin?.checked_in_at)}</td><td>{qrStamp(checkin?.checked_out_at)}</td></>;
}
