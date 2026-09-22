export const LOGIN_AUDIENCES = [
  { id: "office", label: "사업단", description: "학교 이메일로 로그인" },
  { id: "internal", label: "강사(교내)", description: "학교 이메일로 로그인" },
  { id: "external", label: "강사(교외·보조)", description: "간편 로그인 · 이메일" },
  { id: "learner", label: "수강생", description: "간편 로그인 · 회원가입" },
] as const;
export type LoginAudience = typeof LOGIN_AUDIENCES[number]["id"];
export type OfficePosition = "DIRECTOR" | "CENTER_HEAD" | "RESEARCHER";
export type LoginContext = {
  audience: LoginAudience;
  office_position: OfficePosition | null;
  instructor_kind: "INTERNAL" | "EXTERNAL" | null;
  roles: string[];
};
export const OFFICE_POSITIONS: Record<OfficePosition, string> = {
  DIRECTOR: "단장", CENTER_HEAD: "센터장", RESEARCHER: "연구원",
};
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
