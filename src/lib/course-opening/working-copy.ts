export const OPENING_FIELDS = {
  year: 36, title: 200, academy: 100, location: 200, mode: 36,
  selection_method: 36, capacity: 36, apply_from: 36, apply_until: 36,
  starts_on: 36, ends_on: 36, summary: 3000, curriculum: 20000,
} as const;
export type OpeningValues = Record<keyof typeof OPENING_FIELDS, string>;
export type OpeningWorkingCopy = { payload: OpeningValues; revision: number; updated_at: string };
export const OPENING_SOURCE = /^P(0[1-9]|1[0-6])$/;
export type OpeningDateField = "apply_until" | "ends_on";
export function openingDateOrderError(values: Pick<OpeningValues, "apply_from" | "apply_until" | "starts_on" | "ends_on">): { field: OpeningDateField; message: string } | null {
  if (values.apply_from && values.apply_until && values.apply_until <= values.apply_from)
    return { field: "apply_until", message: "접수 마감 일시는 접수 시작 일시보다 늦어야 합니다." };
  if (values.starts_on && values.ends_on && values.ends_on < values.starts_on)
    return { field: "ends_on", message: "교육 종료일은 교육 시작일과 같거나 늦어야 합니다." };
  return null;
}
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validOpeningValues(value: unknown): value is OpeningValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as OpeningValues;
  if (Object.keys(v).length !== Object.keys(OPENING_FIELDS).length || Object.entries(OPENING_FIELDS).some(([key, max]) => typeof v[key as keyof OpeningValues] !== "string" || v[key as keyof OpeningValues].length > max)) return false;
  if (v.year && !ID.test(v.year)) return false;
  if (!["", "OFFLINE", "ONLINE", "BLENDED"].includes(v.mode) || !["", "REVIEW", "FIRST_COME"].includes(v.selection_method)) return false;
  if (v.capacity && (!/^\d{1,4}$/.test(v.capacity) || Number(v.capacity) < 1 || Number(v.capacity) > 1000)) return false;
  for (const key of ["starts_on", "ends_on", "apply_from", "apply_until"] as const) {
    const text = v[key]; if (!text) continue;
    const day = key === "starts_on" || key === "ends_on";
    if (!(day ? /^[1-9]\d{3}-\d{2}-\d{2}$/ : /^[1-9]\d{3}-\d{2}-\d{2}T\d{2}:\d{2}$/).test(text)) return false;
    const date = new Date(day ? `${text}T00:00:00Z` : `${text}:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, day ? 10 : 16) !== text) return false;
  }
  return true;
}
export function openingValues(form: FormData): OpeningValues {
  return Object.fromEntries(Object.keys(OPENING_FIELDS).map(key => [key, String(form.get(key) ?? "")])) as OpeningValues;
}
