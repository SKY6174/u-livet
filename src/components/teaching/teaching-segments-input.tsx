"use client";
import { useState } from "react";
import { koreanDateTimeInput, parseKoreanDateTime } from "@/lib/attendance/qr";

type Segment = { starts_at: string; ends_at: string };
type LocalSegment = { start: string; end: string };

function initialSegments(startsAt: string, endsAt: string, saved: Segment[]): LocalSegment[] {
  if (saved.length) return saved.map((part) => ({
    start: koreanDateTimeInput(part.starts_at), end: koreanDateTimeInput(part.ends_at),
  }));
  const start = koreanDateTimeInput(startsAt), end = koreanDateTimeInput(endsAt);
  const date = start.slice(0, 10), noon = `${date}T12:00`, afternoon = `${date}T13:00`;
  return start < noon && end > afternoon
    ? [{ start, end: noon }, { start: afternoon, end }]
    : [{ start, end }];
}

export function TeachingSegmentsInput({ startsAt, endsAt, saved }: {
  startsAt: string; endsAt: string; saved: Segment[];
}) {
  const [rows, setRows] = useState(() => initialSegments(startsAt, endsAt, saved));
  const segments = rows.map(({ start, end }) => ({ starts_at: parseKoreanDateTime(start), ends_at: parseKoreanDateTime(end) }));
  const valid = segments.every((part) => part.starts_at && part.ends_at && Date.parse(part.ends_at) > Date.parse(part.starts_at));
  const minutes = valid ? segments.reduce((sum, part) => sum + (Date.parse(part.ends_at!) - Date.parse(part.starts_at!)) / 60000, 0) : 0;
  const update = (index: number, key: keyof LocalSegment, value: string) => setRows((current) => current.map((row, i) => i === index ? { ...row, [key]: value } : row));
  return <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
    <legend className="font-semibold">실제 강의 구간 · 한국시간</legend>
    <p className="text-sm text-slate-600">오전·오후를 각각 입력하세요. 점심시간은 두 구간 사이를 비워 두면 날인부에 별도 표시됩니다. 저장 후에는 다시 서명해야 합니다.</p>
    {rows.map((row, index) => <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" key={index}>
      <label className="field">{index + 1}구간 시작<input type="datetime-local" min={koreanDateTimeInput(startsAt)} max={koreanDateTimeInput(endsAt)} value={row.start} onChange={(event) => update(index,"start",event.target.value)} required /></label>
      <label className="field">{index + 1}구간 종료<input type="datetime-local" min={koreanDateTimeInput(startsAt)} max={koreanDateTimeInput(endsAt)} value={row.end} onChange={(event) => update(index,"end",event.target.value)} required /></label>
      <button className="btn-secondary self-end" type="button" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((_, i) => i !== index))}>삭제</button>
    </div>)}
    <button className="btn-secondary" type="button" disabled={rows.length >= 12} onClick={() => setRows((current) => [...current, { start: current.at(-1)?.end ?? "", end: "" }])}>강의 구간 추가</button>
    <p className="text-sm font-semibold">실강의시간 합계: {valid ? `${minutes.toLocaleString("ko-KR")}분` : "시간을 확인해 주세요"}</p>
    <input type="hidden" name="minutes" value={minutes} />
    <input type="hidden" name="segments" value={valid ? JSON.stringify(segments) : "[]"} />
  </fieldset>;
}
