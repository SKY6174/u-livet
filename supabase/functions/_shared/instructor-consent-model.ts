export const CONSENT_TITLES = {
  PRIVACY_CONSENT: "개인정보 제공 및 활용 동의서",
  CRIMINAL_CONSENT: "성범죄 경력 조회 동의서",
  INTEGRITY_PLEDGE: "청렴서약 및 사적 이해관계 확인서",
} as const;
export type ConsentType = keyof typeof CONSENT_TITLES;
export type Choice = "" | "YES" | "NO";
export const TEMPLATE_VERSION = "2026-09-22.5";
export const RELATION_QUESTIONS = [
  "본 대학 재직 교직원 중 4촌 이내의 친족(배우자, 혈족, 인척)이 있습니까?",
  "본 대학 재직 교직원과 공동으로 영리활동을 하거나 경제적 이해관계를 공유하고 있습니까?",
  "최근 2년 이내 본 대학 재직 교직원과 고용 관계(사적 채용 등)가 있었습니까?",
];
export type ConsentForm = {
  name: string;
  date: string;
  phone: string;
  resident_number: string;
  is_foreign: boolean;
  english_name: string;
  birth_date: string;
  foreign_number: string;
  affiliation: string;
  program: string;
  period_start: string;
  period_end: string;
  privacy_consent: Choice;
  unique_id_consent: Choice;
  criminal_consent: boolean;
  integrity_confirm: boolean;
  relations: Choice[];
  related_name: string;
  related_department: string;
  relationship: string;
  signature: string;
};
export function emptyConsent(name: string, affiliation = ""): ConsentForm {
  return {
    name,
    affiliation,
    date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
      new Date(),
    ),
    phone: "",
    resident_number: "",
    is_foreign: false,
    english_name: "",
    birth_date: "",
    foreign_number: "",
    program: "",
    period_start: "",
    period_end: "",
    privacy_consent: "",
    unique_id_consent: "",
    criminal_consent: false,
    integrity_confirm: false,
    relations: ["", "", ""],
    related_name: "",
    related_department: "",
    relationship: "",
    signature: "",
  };
}
export const isConsentType = (v: unknown): v is ConsentType =>
  typeof v === "string" && Object.hasOwn(CONSENT_TITLES, v);
const LIMITS = {
  name: 100,
  date: 10,
  phone: 24,
  resident_number: 14,
  english_name: 100,
  birth_date: 10,
  foreign_number: 20,
  affiliation: 70,
  program: 80,
  period_start: 10,
  period_end: 10,
  related_name: 40,
  related_department: 60,
  relationship: 60,
  signature: 900000,
};
function validDate(v: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number(v.slice(0, 4)) >= 1900 &&
    !Number.isNaN(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v
  );
}
export function normalizeConsent(
  type: ConsentType,
  input: unknown,
  name: string,
  final = false,
): ConsentForm {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("입력 내용을 확인해 주세요.");
  const row = input as Record<string, unknown>,
    result = emptyConsent(name);
  for (const [key, limit] of Object.entries(LIMITS)) {
    const v = row[key] ?? "";
    if (
      typeof v !== "string" ||
      v.length > limit ||
      /[\u0000-\u0008\u000b-\u001f]/.test(v)
    )
      throw new Error("입력 항목의 형식과 길이를 확인해 주세요.");
    Object.assign(result, { [key]: v.trim() });
  }
  if (result.name !== name)
    throw new Error("서류 대상 강사의 성명이 일치하지 않습니다.");
  for (const key of [
    "is_foreign",
    "criminal_consent",
    "integrity_confirm",
  ] as const) {
    if (row[key] !== undefined && typeof row[key] !== "boolean")
      throw new Error("확인 항목을 다시 선택해 주세요.");
    result[key] = row[key] === true;
  }
  const choice = (v: unknown): Choice => {
    if (v !== "" && v !== "YES" && v !== "NO")
      throw new Error("동의 여부를 선택해 주세요.");
    return v;
  };
  result.privacy_consent = choice(row.privacy_consent ?? "");
  result.unique_id_consent = choice(row.unique_id_consent ?? "");
  if (!Array.isArray(row.relations) || row.relations.length !== 3)
    throw new Error("이해관계 확인 항목을 확인해 주세요.");
  result.relations = row.relations.map(choice);
  for (const key of [
    "date",
    "birth_date",
    "period_start",
    "period_end",
  ] as const)
    if (result[key] && !validDate(result[key]))
      throw new Error("날짜를 확인해 주세요.");
  if (
    result.signature &&
    !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(result.signature)
  )
    throw new Error("PNG 서명을 사용해 주세요.");
  if (type !== "CRIMINAL_CONSENT")
    Object.assign(result, {
      phone: "",
      resident_number: "",
      is_foreign: false,
      english_name: "",
      birth_date: "",
      foreign_number: "",
      criminal_consent: false,
    });
  if (type !== "PRIVACY_CONSENT")
    Object.assign(result, { privacy_consent: "", unique_id_consent: "" });
  if (type !== "INTEGRITY_PLEDGE")
    Object.assign(result, {
      affiliation: "",
      program: "",
      period_start: "",
      period_end: "",
      integrity_confirm: false,
      relations: ["", "", ""],
      related_name: "",
      related_department: "",
      relationship: "",
    });
  if (type === "CRIMINAL_CONSENT")
    Object.assign(
      result,
      result.is_foreign
        ? { resident_number: "" }
        : { english_name: "", birth_date: "", foreign_number: "" },
    );
  if (!result.relations.includes("YES"))
    Object.assign(result, {
      related_name: "",
      related_department: "",
      relationship: "",
    });
  if (final) {
    if (!result.name || !result.date || !result.signature)
      throw new Error("작성일과 본인 서명을 입력해 주세요.");
    if (
      type === "PRIVACY_CONSENT" &&
      (!result.privacy_consent || !result.unique_id_consent)
    )
      throw new Error(
        "개인정보와 고유식별정보 동의 여부를 각각 선택해 주세요.",
      );
    if (type === "CRIMINAL_CONSENT") {
      if (!result.criminal_consent || !/^\+?[\d ()-]{8,24}$/.test(result.phone))
        throw new Error("조회 동의 확인과 연락처를 입력해 주세요.");
      if (
        result.is_foreign
          ? !result.english_name ||
            !result.birth_date ||
            !/^\d{6}-?\d{7}$/.test(result.foreign_number)
          : !/^\d{6}-?\d{7}$/.test(result.resident_number)
      )
        throw new Error("주민등록번호 또는 외국인 인적사항을 확인해 주세요.");
    }
    if (type === "INTEGRITY_PLEDGE") {
      if (
        !result.affiliation ||
        !result.program ||
        !result.period_start ||
        !result.period_end ||
        result.period_start > result.period_end ||
        result.relations.some((v) => !v) ||
        !result.integrity_confirm
      )
        throw new Error(
          "인적사항, 위촉 기간, 이해관계 3항목과 서약 확인을 모두 입력해 주세요.",
        );
      if (
        result.relations.includes("YES") &&
        (!result.related_name ||
          !result.related_department ||
          !result.relationship)
      )
        throw new Error("관련 교직원의 성명·부서·관계를 입력해 주세요.");
    }
  }
  return result;
}
export const consentStatus = (t: ConsentType, v: ConsentForm) =>
  t === "PRIVACY_CONSENT" &&
  (v.privacy_consent !== "YES" || v.unique_id_consent !== "YES")
    ? "DECLINED"
    : "SUBMITTED";
