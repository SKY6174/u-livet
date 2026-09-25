import Image from "next/image";
import { formatMinutes, sessionMinutes, type AttendanceBook } from "@/lib/attendance/model";
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

export function AttendancePrint({ book, title = "출석부", attachmentNumber }: {
  book: AttendanceBook; title?: string; attachmentNumber?: number;
}) {
  const sessions = book.sessions.filter((session) => session.status === "SCHEDULED");
  const sessionPages = groupsOf(sessions, 4);
  const peoplePages = groupsOf(book.members, 8);
  const pages = sessionPages.flatMap((pageSessions, sessionPage) => peoplePages.map((people, peoplePage) => ({
    pageSessions, people, sessionOffset: sessionPage * 4, peopleOffset: peoplePage * 8,
  })));
  const durations = sessions.map(sessionMinutes);
  const perSession = !durations.length ? "—" : new Set(durations).size === 1
    ? `${formatMinutes(durations[0])}분`
    : `회차별 상이 (${formatMinutes(Math.min(...durations))}~${formatMinutes(Math.max(...durations))}분)`;
  const totalMinutes = durations.reduce((sum, minutes) => sum + minutes, 0);
  const qr = new Map<string, QrCheckin>((book.qr_checkins ?? []).map((checkin) => [
    `${checkin.session_id}:${checkin.person_id}`, checkin,
  ]));
  if (!sessions.length || !peoplePages.length) return <p className="page-shell">수업 일정과 수강 확정 명단을 등록하면 출석부가 생성됩니다.</p>;

  return <div className="report-output">
    {book.qr_unavailable && <p className="no-print notice mx-auto max-w-4xl">QR 확인 기록을 불러오지 못했습니다. QR 열을 확인한 뒤 다시 출력하세요.</p>}
    {pages.map(({ pageSessions, people, sessionOffset, peopleOffset }, page) => <section
      className={`report-sheet report-form-20 report-landscape ${styles.sheet}`}
      key={page}>
      {attachmentNumber && <div className="report-attachment-marker">[첨부 #{attachmentNumber}]</div>}
      <h1>{title}</h1>
      <table className="report-table report-form-meta"><tbody>
        <tr><th>과정명</th><td>{book.offering.name}</td><th>교육기간</th><td>{book.offering.starts_on} ~ {book.offering.ends_on}</td></tr>
        <tr><th>교육시간/회</th><td>{perSession}</td><th>전체 교육시간</th><td>{formatMinutes(totalMinutes)}분</td></tr>
      </tbody></table>
      <p className={styles.caption}>전체 {sessions.length}회차 · 수강생 {book.members.length}명 · {page + 1}/{pages.length}쪽</p>
      <table className={`report-table ${styles.ledger}`}>
        <caption className="sr-only">회차별 수강생 QR 시작·종료 시각</caption>
        <thead>
          <tr><th colSpan={2} className={styles.axis}>회차</th>{pageSessions.map((session, i) =>
            <th colSpan={2} scope="colgroup" key={session.id}>{sessionOffset + i + 1}회차</th>)}</tr>
          <tr><th colSpan={2} className={styles.axis}>일자</th>{pageSessions.map((session) =>
            <th colSpan={2} key={session.id} className={styles.sessionDate}>{date(session.starts_at)}</th>)}</tr>
          <tr><th colSpan={2} className={styles.axis}>시간</th>{pageSessions.map((session) =>
            <th colSpan={2} key={session.id}>{time(session.starts_at)}–{time(session.ends_at)}</th>)}</tr>
          <tr><th scope="col" className={styles.number}>연번</th><th scope="col" className={styles.name}>성명</th>
            {pageSessions.map((session) => <FragmentPair key={session.id} />)}</tr>
        </thead>
        <tbody>{people.map((person, i) => {
          return <tr key={person.person_id}><td>{peopleOffset + i + 1}</td><th scope="row">{person.name}</th>
            {pageSessions.map((session) => <FragmentCells key={session.id} checkin={qr.get(`${session.id}:${person.person_id}`)} />)}
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
