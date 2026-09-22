const SEOUL_OFFSET_MILLISECONDS = 9 * 60 * 60 * 1000;
const DATE_TIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;

export interface CommitteeDateTimePickerParts {
  date: string;
  hour: string;
  minute: string;
  period: "AM" | "PM";
}

/**
 * DB의 절대시각을 한국 표준시(datetime-local 입력값)로 변환합니다.
 * 실행 브라우저의 시간대와 무관하게 항상 Asia/Seoul(+09:00)을 사용합니다.
 */
export function toSeoulDateTimeLocal(value?: string | null): string {
  if (!value) return "";

  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return "";

  return new Date(instant.getTime() + SEOUL_OFFSET_MILLISECONDS)
    .toISOString()
    .slice(0, 16);
}

/**
 * datetime-local 입력을 한국시간으로 해석한 뒤 DB 저장용 UTC ISO 문자열로 변환합니다.
 */
export function seoulDateTimeLocalToIso(value: string): string {
  const normalized = value.trim();
  if (!DATE_TIME_LOCAL_PATTERN.test(normalized)) return "";

  const instant = new Date(`${normalized.length === 16 ? `${normalized}:00` : normalized}+09:00`);
  return Number.isNaN(instant.getTime()) ? "" : instant.toISOString();
}

/** 기존 시각을 가장 가까운 10분 단위로 맞춥니다. 60분이 되면 다음 시간/날짜로 정상 이월합니다. */
export function normalizeSeoulDateTimeLocalToTenMinutes(value: string): string {
  const iso = seoulDateTimeLocalToIso(value);
  if (!iso) return "";
  const instant = new Date(iso);
  instant.setUTCMinutes(Math.round(instant.getUTCMinutes() / 10) * 10, 0, 0);
  return toSeoulDateTimeLocal(instant.toISOString());
}

/** 24시간 datetime-local 값을 순환하지 않는 12시간제 선택 항목으로 분해합니다. */
export function getCommitteeDateTimePickerParts(value: string): CommitteeDateTimePickerParts {
  const normalized = normalizeSeoulDateTimeLocalToTenMinutes(value);
  if (!normalized) return { date: "", hour: "09", minute: "00", period: "AM" };
  const [date, time] = normalized.split("T");
  const [hourText, minute] = time.split(":");
  const hour24 = Number(hourText);
  return {
    date,
    hour: String(hour24 % 12 || 12).padStart(2, "0"),
    minute,
    period: hour24 >= 12 ? "PM" : "AM"
  };
}

/** 날짜·01~12시·10분 단위·오전/오후 선택값을 기존 datetime-local 저장 형식으로 합칩니다. */
export function composeCommitteeDateTimeLocal(parts: CommitteeDateTimePickerParts): string {
  const hour12 = Number(parts.hour);
  const minute = Number(parts.minute);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parts.date)
      || !Number.isInteger(hour12) || hour12 < 1 || hour12 > 12
      || !Number.isInteger(minute) || minute < 0 || minute > 50 || minute % 10 !== 0
      || !["AM", "PM"].includes(parts.period)) return "";
  const hour24 = parts.period === "AM"
    ? (hour12 === 12 ? 0 : hour12)
    : (hour12 === 12 ? 12 : hour12 + 12);
  return `${parts.date}T${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** 한국시간임을 명시하는 위원회 마감시각 표시 문자열을 반환합니다. */
export function formatSeoulDateTime(value?: string | null): string {
  if (!value) return "";

  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return "";

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(instant);
}

const getSeoulDateTimeParts = (instant: Date) => Object.fromEntries(
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(instant).map(part => [part.type, part.value])
);

/** 자문의견서용 자문 일시와 총 자문시간을 한국시간 기준으로 표시합니다. */
export function formatSeoulConsultationRange(startValue?: string | null, endValue?: string | null): string {
  if (!startValue || !endValue) return formatSeoulDateTime(startValue);
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return formatSeoulDateTime(startValue);
  }
  const startParts = getSeoulDateTimeParts(start);
  const endParts = getSeoulDateTimeParts(end);
  const startDate = `${startParts.year}.${startParts.month}.${startParts.day}.`;
  const endDate = `${endParts.year}.${endParts.month}.${endParts.day}.`;
  const startTime = `${startParts.hour}:${startParts.minute}`;
  const endTime = `${endParts.hour}:${endParts.minute}`;
  const duration = Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 10) / 10;
  const range = startDate === endDate
    ? `${startDate} ${startTime} ~ ${endTime}`
    : `${startDate} ${startTime} ~ ${endDate} ${endTime}`;
  return `${range} (${duration.toFixed(1)}시간)`;
}
