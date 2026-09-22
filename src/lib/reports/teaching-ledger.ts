import type { ClassSession } from "@/lib/portal/evaluation";
import type { TeachingLog } from "./types";

export type LedgerRow = {
  key: string;
  session: number;
  date: string;
  period: string;
  time: string;
  minutes: number | null;
  name: string;
  signature: string | null;
  note: string;
};
const kstDate = (value: number) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
}).format(value);
const kstTime = (value: number) => new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false,
}).format(value);
const instant = (date: string, time: string) => Date.parse(`${date}T${time}:00+09:00`);

function splitAtNoon(start: number, end: number) {
  const parts: { start: number; end: number; period: string }[] = [];
  let cursor = start;
  while (cursor < end) {
    const date = kstDate(cursor), noon = instant(date,"12:00"), midnight = instant(date,"00:00") + 86400000;
    const boundary = Math.min(end, cursor < noon ? noon : midnight);
    if (boundary <= cursor) break;
    parts.push({ start: cursor, end: boundary, period: cursor < noon ? "오전" : "오후" });
    cursor = boundary;
  }
  return parts;
}

export function buildTeachingLedger(sessions: ClassSession[], teaching: TeachingLog[]): LedgerRow[] {
  const rows: LedgerRow[] = [];
  sessions.forEach((session, sessionIndex) => {
    const lectures = teaching.filter((log) => log.session_id === session.id);
    const slices = lectures.flatMap((log) => (log.segments ?? []).flatMap((segment, segmentIndex) =>
      splitAtNoon(Date.parse(segment.starts_at),Date.parse(segment.ends_at)).map((part, partIndex) => ({
        ...part, log, key: `${log.id}-${segmentIndex}-${partIndex}`,
      })))).filter((part) => Number.isFinite(part.start) && part.end > part.start)
      .sort((a,b) => a.start-b.start || a.log.name.localeCompare(b.log.name,"ko"));
    let latestEnd = 0;
    slices.forEach((part) => {
      const date = kstDate(part.start), gap = part.start - latestEnd;
      if (latestEnd && gap >= 30*60000 && kstDate(latestEnd) === date) {
        const lunch = latestEnd < instant(date,"14:00") && part.start > instant(date,"11:00");
        rows.push({ key: `${session.id}-gap-${part.start}`, session: sessionIndex+1, date,
          period: lunch ? "점심시간" : "휴식", time: `${kstTime(latestEnd)}~${kstTime(part.start)}`,
          minutes: null, name: "—", signature: null, note: "강의시간 제외" });
      }
      const signed = part.log.current && part.log.signature && part.log.signed_revision === part.log.revision;
      rows.push({ key: part.key, session: sessionIndex+1, date,
        period: part.period, time: `${kstTime(part.start)}~${kstTime(part.end)}`,
        minutes: (part.end-part.start)/60000, name: part.log.name,
        signature: signed ? part.log.signature! : null,
        note: !part.log.current ? "승인 대기" : signed ? "" : "서명 대기" });
      latestEnd = Math.max(latestEnd,part.end);
    });
    lectures.filter((log) => !log.segments?.length).forEach((log) => rows.push({
      key: log.id, session: sessionIndex+1, date: kstDate(Date.parse(session.starts_at)),
      period: "시간 미등록", time: "—", minutes: log.minutes, name: log.name,
      signature: null, note: "강의 구간·서명 재입력 필요",
    }));
  });
  return rows;
}
