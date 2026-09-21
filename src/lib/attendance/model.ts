import type { Attendance, ClassSession } from "@/lib/portal/evaluation";
export type AttendanceBook = {
  offering: { id: string; name: string; starts_on: string; ends_on: string };
  viewer_id: string;
  generated_at: string;
  members: { person_id: string; name: string }[];
  sessions: ClassSession[];
  attendance: Attendance[];
  qr_checkins?: import("./qr").QrCheckin[];
  qr_unavailable?: boolean;
};
export const sessionMinutes = (session: ClassSession) =>
  (Date.parse(session.ends_at) - Date.parse(session.starts_at)) / 60000;
export function attendanceIndex(records: Attendance[]) {
  return new Map(records.map((record) => [`${record.session_id}:${record.person_id}`, record]));
}
export function attendanceState(session: ClassSession, record: Attendance | undefined, now: number) {
  if (session.status === "CANCELLED") return "휴강";
  if (Date.parse(session.ends_at) > now) return "예정·진행 중";
  if (!record) return "미입력";
  if (record.credited_minutes === 0) return "결석";
  return record.credited_minutes >= sessionMinutes(session) ? "출석" : "일부 출석";
}
export function attendanceSummary(sessions: ClassSession[], index: ReturnType<typeof attendanceIndex>, person: string, now: number) {
  const ended = sessions.filter((session) => session.status === "SCHEDULED" && Date.parse(session.ends_at) <= now);
  let recorded = 0, credited = 0, total = 0;
  for (const session of ended) {
    total += sessionMinutes(session);
    const record = index.get(`${session.id}:${person}`);
    if (record) { recorded++; credited += record.credited_minutes; }
  }
  return { ended: ended.length, recorded, missing: ended.length - recorded, credited, total,
    percent: total > 0 && recorded === ended.length ? Math.round(credited / total * 1000) / 10 : null };
}
export const formatMinutes = (minutes: number) => Number(minutes.toFixed(2)).toLocaleString("ko-KR");
