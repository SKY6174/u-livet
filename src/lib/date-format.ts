const SEOUL_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
});
const SEOUL_TIME = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", hour: "numeric", minute: "2-digit", hour12: true,
});

function calendarDate(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
  }
  // Only timestamps with an explicit zone are safe across server and browser locales.
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = SEOUL_DATE.formatToParts(date);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatDate(value: string | null | undefined, fallback = "미기재"): string {
  const date = value ? calendarDate(value) : null;
  return date ? `${date.replaceAll("-", ".")}.` : fallback;
}

export function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  return `${formatDate(start)} ~ ${formatDate(end)}`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value || !calendarDate(value)) return "미기재";
  return `${formatDate(value)} ${SEOUL_TIME.format(new Date(value))}`;
}
