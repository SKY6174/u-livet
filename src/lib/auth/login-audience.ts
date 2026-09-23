export const LOGIN_AUDIENCES = [
  { id: "office", label: "사업단", description: "학교 이메일로 로그인" },
  { id: "internal", label: "강사(교내)", description: "학교 이메일로 로그인" },
  { id: "external", label: "강사(교외·보조)", description: "간편 로그인 · 이메일" },
  { id: "learner", label: "수강생", description: "간편 로그인 · 회원가입" },
] as const;
export type LoginAudience = typeof LOGIN_AUDIENCES[number]["id"];
export type OfficePosition = keyof typeof OFFICE_POSITIONS;
export type LoginContext = {
  audience: LoginAudience;
  office_position: OfficePosition | null;
  instructor_kind: "INTERNAL" | "EXTERNAL" | null;
  roles: string[];
};
export const OFFICE_POSITIONS = {
  DIRECTOR: "단장", DIVISION_HEAD: "본부장", CENTER_HEAD: "센터장", OPERATIONS_HEAD: "운영팀장",
  PRINCIPAL_RESEARCHER: "책임연구원", SENIOR_RESEARCHER: "선임연구원", RESEARCHER: "연구원",
} as const;
export const isOfficePosition = (value: string): value is OfficePosition =>
  Object.hasOwn(OFFICE_POSITIONS, value);
export function loginAudience(value: unknown): LoginAudience | null {
  return LOGIN_AUDIENCES.find(item => item.id === value)?.id ?? null;
}
export function isSchoolEmail(email: string) {
  return /^[^@\s]+@uc\.ac\.kr$/i.test(email.trim());
}
export function audienceError(requested: LoginAudience, actual: LoginAudience) {
  if (requested === "office" && actual !== "office") return "사업단 계정으로 등록되어 있지 않습니다. 이용자 구분을 다시 선택해 주세요.";
  if (requested === "internal" && actual !== "internal") return "교내 강사 등록이 확인되지 않습니다. 사업단에 강사 구분 확인을 요청해 주세요.";
  if (requested === "external" && (actual === "office" || actual === "internal")) return "사업단·교내 강사는 해당 로그인 화면에서 학교 또는 등록 이메일로 이용해 주세요.";
  return null;
}
