import { normalizeMobilePhone } from "@/lib/auth/registration";
import { normalizeContact } from "@/lib/members/model";

export type AccountProfile = {
  mobile_phone: string | null;
  office_phone: string | null;
  school_email: string | null;
  personal_email: string | null;
  affiliation: string | null;
  job_title: string | null;
};

export function accountProfileInput(form: FormData) {
  const get = (key: string) => String(form.get(key) ?? "").trim();
  const mobile = get("mobile_phone");
  const office = get("office_phone");
  const school = get("school_email").toLowerCase();
  const personal = get("personal_email").toLowerCase();
  const affiliation = get("affiliation");
  const title = get("job_title");
  const emailValid = (value: string) => !value || (value.length <= 254 && /^[^@\s]+@[^@\s.]+(?:\.[^@\s.]+)+$/.test(value));
  if (mobile && !normalizeMobilePhone(mobile)) return { error: "핸드폰 번호를 확인해 주세요. 예: 010-1234-5678" };
  if (office && (office.length > 30 || !normalizeContact(office))) return { error: "사무실 번호를 확인해 주세요. 예: 052-230-0000" };
  if (!emailValid(school) || !emailValid(personal)) return { error: "학교·개인 이메일 주소를 확인해 주세요." };
  if (affiliation.length > 100 || title.length > 100) return { error: "소속과 직책은 각각 100자 이내로 입력해 주세요." };
  return { data: {
    p_mobile_phone: mobile ? normalizeMobilePhone(mobile) : null,
    p_office_phone: office ? normalizeContact(office) : null,
    p_school_email: school || null, p_personal_email: personal || null,
    p_affiliation: affiliation || null, p_job_title: title || null,
  } };
}
