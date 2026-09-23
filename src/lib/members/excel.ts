import { OFFICE_POSITIONS, type OfficePosition } from "@/lib/auth/login-audience";
import { displayPhone, memberInput, newMemberInput, type MemberGroup } from "./model";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]+@[^@\s.]+(?:\.[^@\s.]+)+$/;
export type MemberExcelRow = {
  person_id: string; revision: string; request_id: string; name: string; email: string;
  position: string; kind: string; office_phone: string; mobile_phone: string;
  instructor_phone: string; birth_date: string; notes: string;
};
export type MemberExcelRecord = Omit<MemberExcelRow, "request_id" | "revision"> & { revision: number };
const COMMON = [["person_id", "구성원 ID"], ["revision", "수정 버전"], ["name", "성명"], ["email", "이메일(아이디)"]] as const;
const NOTES = [["notes", "비고"]] as const;
export const MEMBER_EXCEL_COLUMNS = {
  office: [...COMMON, ["position", "직책"], ["office_phone", "사무실 전화번호"], ["mobile_phone", "핸드폰 전화번호"], ...NOTES],
  instructor: [...COMMON, ["kind", "교내/교외"], ["instructor_phone", "연락처"], ...NOTES],
  learner: [...COMMON, ["mobile_phone", "핸드폰 전화번호"], ["birth_date", "생년월일"], ...NOTES],
} as const satisfies Record<MemberGroup, readonly (readonly [keyof MemberExcelRow, string])[]>;

function cellText(value: unknown, date = false) {
  if (value == null) return "";
  if (date && value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  throw Error("문자·숫자·날짜 셀만 사용해 주세요.");
}
export function parseMemberWorkbook(cells: unknown[][], group: MemberGroup): MemberExcelRow[] {
  const columns = MEMBER_EXCEL_COLUMNS[group];
  if (!Array.isArray(cells) || cells.length < 2 || cells.length > 102 ||
    !Array.isArray(cells[0]) || cells[0].length !== columns.length ||
    columns.some(([, label], index) => cellText(cells[0][index]) !== label))
    throw Error("선택한 구성원 구분의 엑셀 서식을 사용해 주세요. 최대 100명까지 등록할 수 있습니다.");
  const rows: MemberExcelRow[] = [];
  for (let index = 1; index < cells.length; index++) {
    const cellsInRow = cells[index];
    if (!Array.isArray(cellsInRow) || cellsInRow.length > columns.length && cellsInRow.slice(columns.length).some(cell => cellText(cell)))
      throw Error(`${index + 1}행에 서식 밖의 값이 있습니다.`);
    const row: MemberExcelRow = { person_id: "", revision: "", request_id: "", name: "", email: "", position: "", kind: "", office_phone: "", mobile_phone: "", instructor_phone: "", birth_date: "", notes: "" };
    for (let col = 0; col < columns.length; col++) {
      const key = columns[col][0];
      row[key] = cellText(cellsInRow[col], key === "birth_date");
    }
    if (!Object.values(row).some(Boolean)) continue;
    if (group === "office" && row.position) {
      const entry = Object.entries(OFFICE_POSITIONS).find(([code, label]) => row.position === label || row.position === code);
      if (!entry) throw Error(`${index + 1}행의 직책을 확인해 주세요.`);
      row.position = entry[0];
    }
    if (group === "instructor") {
      row.kind = row.kind === "교내" ? "INTERNAL" : row.kind === "교외" ? "EXTERNAL" : row.kind;
    }
    if (!row.person_id) row.request_id = globalThis.crypto.randomUUID();
    rows.push(row);
  }
  if (!rows.length) throw Error("등록할 구성원 행을 입력해 주세요.");
  return rows;
}

export function validateMemberExcelRows(rows: MemberExcelRow[], group: MemberGroup, org: string) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 100 || !MEMBER_EXCEL_COLUMNS[group]) throw Error("1~100명의 구성원 자료를 확인해 주세요.");
  const ids = new Set<string>(), emails = new Set<string>();
  return rows.map((row, index) => {
    const number = index + 2;
    if (!row || typeof row !== "object" || Object.values(row).some(value => typeof value !== "string")) throw Error(`${number}행의 값을 확인해 주세요.`);
    const email = row.email.trim().toLowerCase();
    if (email && (!EMAIL.test(email) || email.length > 254)) throw Error(`${number}행의 이메일을 확인해 주세요.`);
    if (email && emails.has(email)) throw Error(`${number}행의 이메일이 파일 안에서 중복됩니다.`);
    if (email) emails.add(email);
    if (row.person_id) {
      if (!ID.test(row.person_id) || ids.has(row.person_id)) throw Error(`${number}행의 구성원 ID가 잘못되었거나 중복됩니다.`);
      ids.add(row.person_id);
    } else if (!ID.test(row.request_id) || !ID.test(org)) throw Error(`${number}행의 등록 요청과 사업단을 확인해 주세요.`);
    const form = new FormData();
    for (const [key, value] of Object.entries(row)) form.set(key === "position" ? "office_position" : key === "kind" ? "instructor_kind" : key, value);
    form.set("group", group); form.set("org_id", org); form.set("request_id", row.request_id);
    if (!row.person_id) {
      const input = newMemberInput(form);
      if (!input) throw Error(`${number}행의 성명, 이메일, 전화번호, 생년월일 또는 구분을 확인해 주세요.`);
      return { person_id: "", request_id: input.p_request, name: input.p_name, email: input.p_email,
        position: input.p_position, kind: input.p_kind, office_phone: input.p_office_phone,
        mobile_phone: input.p_mobile_phone, instructor_phone: input.p_instructor_phone,
        birth_date: input.p_birth_date, notes: input.p_notes, revision: null };
    }
    const input = memberInput(form);
    if (!input || !ID.test(input.p_person)) throw Error(`${number}행의 성명, 전화번호, 생년월일, 직책 또는 수정 버전을 확인해 주세요.`);
    return { person_id: input.p_person, request_id: "", name: input.p_name, email,
      position: input.p_position, kind: input.p_kind, office_phone: input.p_office_phone,
      mobile_phone: input.p_mobile_phone, instructor_phone: input.p_instructor_phone,
      birth_date: input.p_birth_date, notes: input.p_notes, revision: input.p_revision };
  });
}

export function memberExcelValues(group: MemberGroup, record: MemberExcelRecord): string[] {
  return MEMBER_EXCEL_COLUMNS[group].map(([key]) => {
    if (key === "position") return record.position ? OFFICE_POSITIONS[record.position as OfficePosition] || record.position : "";
    if (key === "kind") return record.kind === "INTERNAL" ? "교내" : record.kind === "EXTERNAL" ? "교외" : "";
    if (key === "office_phone" || key === "mobile_phone" || key === "instructor_phone") return displayPhone(record[key] || null).replace(/^—$/, "");
    return String(record[key] ?? "");
  });
}
