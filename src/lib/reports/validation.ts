import type { ReportPayload } from "./types";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const text = (x: unknown, max = 5000) =>
  typeof x === "string" && x.length <= max;
const number = (x: unknown, max: number, integer = true) =>
  typeof x === "number" &&
  Number.isFinite(x) &&
  x >= 0 &&
  x <= max &&
  (!integer || Number.isInteger(x));
export function validDate(x: unknown) {
  if (x === "") return true;
  return (
    typeof x === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(x) &&
    !Number.isNaN(Date.parse(x)) &&
    new Date(x).toISOString().slice(0, 10) === x
  );
}
export function validateReport(x: unknown): x is ReportPayload {
  if (!object(x) || JSON.stringify(x).length > 150000) return false;
  if (x.sourceReport !== undefined) {
    const s = x.sourceReport;
    if (!object(s) || !text(s.filename, 200) || !s.filename ||
      typeof s.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(s.sha256) ||
      !text(s.notes) || !["enrolled", "completed", "classCount", "scholarshipRecipients"].every(k => number(s[k], 10000)) ||
      !number(s.educationHours, 10000, false) || !number(s.scholarshipAmount, 1e9) ||
      Number(s.completed) > Number(s.enrolled)) return false;
  }
  if (
    !["operator", "professor", "program"].every((k) => text(x[k], 200)) ||
    !validDate(x.reportDate)
  )
    return false;
  if (
    ![
      "content",
      "method",
      "education",
      "promotion",
      "other",
      "strengths",
      "improvements",
      "followUp",
    ].every((k) => text(x[k]))
  )
    return false;
  if (
    !["certificates", "employed", "surveyResponses"].every(
      (k) => x[k] === null || number(x[k], 10000),
    )
  )
    return false;
  if (x.satisfaction !== null && !number(x.satisfaction, 100, false))
    return false;
  const rows = (
    key: string,
    max: number,
    check: (r: Record<string, unknown>) => boolean,
  ) =>
    Array.isArray(x[key]) &&
    x[key].length <= max &&
    x[key].every((r) => object(r) && check(r));
  const banking = (r: Record<string, unknown>) =>
    ["bank", "account", "holder"].every((k) => text(r[k], 100)) &&
    validDate(r.paidOn) &&
    text(r.note, 500);
  const person = (r: Record<string, unknown>) =>
    typeof r.personId === "string" && UUID.test(r.personId);
  return (
    rows(
      "budgets",
      100,
      (r) =>
        text(r.category, 100) &&
        !!r.category &&
        number(r.planned, 1e9) &&
        number(r.spent, 1e9) &&
        text(r.note, 500),
    ) &&
    rows(
      "participants",
      1000,
      (r) => person(r) && validDate(r.birthDate) && text(r.note, 500),
    ) &&
    new Set((x.participants as { personId: string }[]).map((r) => r.personId))
      .size === (x.participants as unknown[]).length &&
    rows(
      "scholarships",
      1000,
      (r) =>
        person(r) &&
        text(r.category, 100) &&
        !!r.category &&
        number(r.rate, 100, false) &&
        number(r.amount, 1e9) &&
        banking(r),
    ) &&
    rows(
      "fees",
      200,
      (r) =>
        text(r.name, 100) &&
        !!r.name &&
        ["내부강사", "외부강사", "보조강사"].includes(String(r.kind)) &&
        validDate(r.birthDate) &&
        text(r.dates, 500) &&
        number(r.hours, 1000, false) &&
        Math.abs(Number(r.hours) * 100 - Math.round(Number(r.hours) * 100)) <
          1e-7 &&
        number(r.rate, 1e7) &&
        banking(r),
    )
  );
}
export const MAX_FILE_SIZE = 4 * 1024 * 1024;
export function detectFileMime(bytes: Uint8Array) {
  if (
    bytes.length >= 5 &&
    String.fromCharCode(...Array.from(bytes.slice(0, 5))) === "%PDF-"
  )
    return "application/pdf";
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)
  )
    return "image/png";
  if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return "image/jpeg";
  return null;
}
