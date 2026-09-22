export const DOCUMENT_TITLES = {
  application: "수강신청원서",
  scholarship: "학습활동 우수 장학금 지급신청서",
} as const;
export type LearnerDocumentType = keyof typeof DOCUMENT_TITLES;
export type ConsentChoice = "" | "yes" | "no";
export const PURPOSES = ["취업", "창업", "재교육", "자기계발", "기타"] as const;
export type LearnerDocumentValues = {
  courseName: string;
  name: string;
  phone: string;
  gender: "" | "male" | "female";
  birthDate: string;
  email: string;
  address: string;
  purposes: string[];
  privacy: ConsentChoice;
  publicity: ConsentChoice;
  portrait: ConsentChoice;
  residentFront: string;
  residentBack: string;
  bank: string;
  account: string;
  accountHolder: string;
  signedOn: string;
  signature: string;
};
export function koreaToday() {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
}
export function initialValues(name = "", email = "", courseName = ""): LearnerDocumentValues {
  return { courseName, name, phone: "", gender: "", birthDate: "", email,
    address: "", purposes: [], privacy: "", publicity: "", portrait: "",
    residentFront: "", residentBack: "", bank: "", account: "", accountHolder: name,
    signedOn: koreaToday(), signature: "" };
}
export function isDocumentType(value: string): value is LearnerDocumentType {
  return value === "application" || value === "scholarship";
}
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function documentErrors(type: LearnerDocumentType, v: LearnerDocumentValues) {
  const errors: Partial<Record<keyof LearnerDocumentValues, string>> = {};
  const required: (keyof LearnerDocumentValues)[] = ["courseName", "name", "phone", "gender", "privacy", "signedOn", "signature"];
  required.push(...(type === "application"
    ? ["birthDate", "address", "purposes", "publicity", "portrait"] as const
    : ["residentFront", "residentBack", "bank", "account", "accountHolder"] as const));
  for (const field of required) {
    if (!v[field].length || (typeof v[field] === "string" && !v[field].trim())) errors[field] = "이 항목을 작성해 주세요.";
  }
  if (v.phone && !/^01[016789]\d{7,8}$/.test(v.phone.replace(/[ -]/g, ""))) errors.phone = "휴대전화 번호를 확인해 주세요.";
  if (!validDate(v.signedOn)) errors.signedOn = "올바른 작성일을 선택해 주세요.";
  if (type === "application") {
    if (!validDate(v.birthDate) || v.birthDate > koreaToday()) errors.birthDate = "올바른 생년월일을 선택해 주세요.";
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.email = "이메일 주소를 확인해 주세요.";
  } else {
    if (!/^\d{6}$/.test(v.residentFront)) errors.residentFront = "앞자리 6자리를 입력해 주세요.";
    if (!/^[1-8]\d{6}$/.test(v.residentBack)) errors.residentBack = "뒷자리 7자리를 확인해 주세요.";
    if (/^\d{6}$/.test(v.residentFront) && /^[1-8]/.test(v.residentBack)) {
      const century = ["3", "4", "7", "8"].includes(v.residentBack[0]) ? "20" : "19";
      const date = `${century}${v.residentFront.slice(0, 2)}-${v.residentFront.slice(2, 4)}-${v.residentFront.slice(4, 6)}`;
      if (!validDate(date) || date > koreaToday()) errors.residentFront = "주민등록번호의 생년월일을 확인해 주세요.";
    }
    if (!/^[\d -]{8,30}$/.test(v.account) || v.account.replace(/\D/g, "").length < 8) errors.account = "계좌번호를 확인해 주세요. 숫자와 하이픈으로 입력합니다.";
  }
  return errors;
}
