import { isOfficePosition, isSchoolEmail, type OfficePosition } from "@/lib/auth/login-audience";
import { normalizeMobilePhone } from "@/lib/auth/registration";

export const MEMBER_GROUPS = { office: "사업단", instructor: "강사", learner: "수강생" } as const;
export type MemberGroup = keyof typeof MEMBER_GROUPS;
export const memberGroup = (value: unknown): MemberGroup =>
  value === "instructor" || value === "learner" ? value : "office";
export const memberPage = (value: unknown) => typeof value === "string" && /^[1-9][0-9]{0,5}$/.test(value) ? Math.min(Number(value), 100000) : 1;
export type Member = {
  id: string; name: string; email: string | null; office_position: OfficePosition | null;
  instructor_kind: "INTERNAL" | "EXTERNAL" | null; office_phone: string | null;
  mobile_phone: string | null; instructor_phone: string | null; birth_date: string | null;
  is_super_admin?: boolean; is_manual?: boolean; account_verified?: boolean; can_manage?: boolean; current_courses?: { id: string; name: string }[];
  notes: string; revision: number; is_office: boolean; is_instructor: boolean; is_learner: boolean;
};
export type MemberDirectory = { current_year?: number; items: Member[]; total: number; page: number; page_size: number; counts: Record<MemberGroup, number> };
export type MemberHistory = { items: { id: string; name: string; starts_on: string; ends_on: string; status: string }[]; total: number; page: number; page_size: number };
export const HISTORY_STATUS: Record<string, string> = {
  TEACHING: "강의 배정", TEACHING_ENDED: "배정 종료", ENROLLED: "수강 확정", WITHDRAWN: "수강 철회",
  SUBMITTED: "신청", WAITLISTED: "대기", ACCEPTED: "선발", REJECTED: "미선발", CANCELLED: "신청 취소",
};
export function displayPhone(value: string | null) {
  if (!value) return "—";
  const local = value.startsWith("+82") ? `0${value.slice(3)}` : value;
  if (local.startsWith("02")) return local.replace(/^(02)(\d{3,4})(\d{4})$/, "$1-$2-$3");
  return local.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3");
}
export function normalizeContact(value: string) {
  const compact = value.trim().replace(/[\s()-]/g, "");
  const local = compact.startsWith("+82") ? `0${compact.slice(3)}` : compact;
  return /^0\d{8,10}$/.test(local) ? local : null;
}
export function memberInput(form: FormData) {
  const get = (key: string) => String(form.get(key) ?? "").trim();
  const group = get("group");
  const name = get("name");
  const notes = get("notes");
  const office = get("office_phone");
  const mobile = get("mobile_phone");
  const instructor = get("instructor_phone");
  const birth = get("birth_date");
  const revision = get("revision");
  if (!["office", "instructor", "learner"].includes(group) || !name || name.length > 100 || notes.length > 2000 || !/^(0|[1-9]\d{0,8})$/.test(revision)) return null;
  if ((office && (office.length > 30 || !normalizeContact(office))) || (instructor && (instructor.length > 30 || !normalizeContact(instructor))) || (mobile && !normalizeMobilePhone(mobile))) return null;
  if (birth && (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || !Number.isFinite(Date.parse(birth)) || new Date(birth).toISOString().slice(0, 10) !== birth || birth < "1900-01-01" || birth > new Date().toISOString().slice(0, 10))) return null;
  if (group === "office" && get("office_position") && !isOfficePosition(get("office_position"))) return null;
  if (group === "instructor" && !["INTERNAL", "EXTERNAL"].includes(get("instructor_kind"))) return null;
  return { p_person: get("person_id"), p_group: group, p_name: name, p_position: get("office_position") || null,
    p_kind: get("instructor_kind") || null, p_office_phone: office ? normalizeContact(office) : null,
    p_mobile_phone: mobile ? normalizeMobilePhone(mobile) : null, p_instructor_phone: instructor ? normalizeContact(instructor) : null,
    p_birth_date: birth || null, p_notes: notes, p_revision: Number(revision) };
}

export function newMemberInput(form: FormData) {
  const copy = new FormData();
  form.forEach((value, key) => copy.set(key, value));
  copy.set("revision", "0");
  const parsed = memberInput(copy);
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!parsed || email.length > 254 || !/^[^@\s]+@[^@\s.]+(?:\.[^@\s.]+)+$/.test(email)) return null;
  if (parsed.p_group === "instructor" && parsed.p_kind === "INTERNAL" && !isSchoolEmail(email)) return null;
  return { p_request: String(form.get("request_id") ?? ""), p_org: String(form.get("org_id") ?? ""),
    p_group: parsed.p_group, p_name: parsed.p_name, p_email: email, p_position: parsed.p_position,
    p_kind: parsed.p_kind, p_office_phone: parsed.p_office_phone, p_mobile_phone: parsed.p_mobile_phone,
    p_instructor_phone: parsed.p_instructor_phone, p_birth_date: parsed.p_birth_date, p_notes: parsed.p_notes };
}
