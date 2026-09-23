export type ScheduleLocation = {
  name: string;
  room: string;
};

export function formatScheduleDate(value: string): string {
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}. ${match[2]}. ${match[3]}.` : value;
}

export function formatScheduleTime(startTime: string, endTime: string): string {
  if (!startTime && !endTime) return "";
  return `(${startTime || ""} ~ ${endTime || ""})`;
}

export function splitScheduleLocation(value: string): ScheduleLocation {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return { name: "", room: "" };

  const match = normalized.match(/^(.*\S)\s*(\([^()]+\))$/);
  return match
    ? { name: match[1], room: match[2] }
    : { name: normalized, room: "" };
}
