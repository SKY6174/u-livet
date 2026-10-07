import { formatMobilePhone, normalizeMobilePhone } from "../auth/registration";

export const DOCUMENT_TITLES = {
  application: "수강신청원서",
  scholarship: "학습활동 우수 장학금 지급신청서",
  refund: "수강료환불신청서",
} as const;
export type LearnerDocumentType = keyof typeof DOCUMENT_TITLES;
export type ConsentChoice = "" | "yes" | "no";
export const PURPOSES = ["취업", "창업", "재교육", "자기계발", "기타"] as const;
export const BANKS = [
  "KB국민은행", "신한은행", "우리은행", "하나은행", "NH농협은행", "지역농축협",
  "IBK기업은행", "KDB산업은행", "SC제일은행", "수협은행", "한국씨티은행",
  "iM뱅크", "BNK부산은행", "광주은행", "제주은행", "전북은행", "BNK경남은행",
  "케이뱅크", "카카오뱅크", "토스뱅크", "우체국", "새마을금고", "신협",
  "저축은행", "산림조합",
] as const;
export const REFUND_OCCURRENCES = [
  ["before-start", "수업 시작 전"],
  ["before-sixth", "수업 시작 ~ 총 수업시간 1/6 전"],
  ["before-third", "총 수업시간 1/6 이상 ~ 1/3 미만"],
  ["before-half", "총 수업시간 1/3 이상 ~ 1/2 미만"],
  ["after-half", "총 수업시간 1/2 이상 (반환 없음)"],
] as const;
export type RefundOccurrence = "" | typeof REFUND_OCCURRENCES[number][0];
export type LearnerDocumentValues = {
  offeringId: string;
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
  homePhone: string;
  refundOccurrence: RefundOccurrence;
  tuitionFee: string;
  deductionAmount: string;
  refundAmount: string;
  signedOn: string;
  signature: string;
};
export function koreaToday() {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
}
export type LearnerDocumentProfile = { phone: string; birthDate: string };
export function applicationDocumentHref(course?: string) {
  const query = new URLSearchParams({ type: "application" });
  if (course) query.set("course", course);
  return `/mypage/documents?${query}`;
}
export function learnerDocumentProfile(metadata: Record<string, unknown> = {}, nativePhone?: string): LearnerDocumentProfile {
  const phone = normalizeMobilePhone(nativePhone?.startsWith("82") ? `+${nativePhone}` : nativePhone)
    ?? normalizeMobilePhone(metadata.mobile_phone);
  const birth = typeof metadata.birth_date === "string" ? metadata.birth_date : "";
  return { phone: phone ? formatMobilePhone(phone) : "", birthDate: birth && validDate(birth) && birth <= koreaToday() ? birth : "" };
}
export function initialValues(name = "", email = "", courseName = "", offeringId = "", tuition: number | null = null, profile: Partial<LearnerDocumentProfile> = {}): LearnerDocumentValues {
  const tuitionFee = tuition === null ? "" : String(tuition);
  return { offeringId, courseName, name, phone: profile.phone ?? "", gender: "", birthDate: profile.birthDate ?? "", email,
    address: "", purposes: [], privacy: "", publicity: "", portrait: "",
    residentFront: "", residentBack: "", bank: "", account: "", accountHolder: name,
    homePhone: "", refundOccurrence: "", tuitionFee, deductionAmount: "", refundAmount: "",
    signedOn: koreaToday(), signature: "" };
}
export function refundAmounts(tuition: number | null, occurrence: RefundOccurrence) {
  if (tuition === null || !occurrence) return { tuitionFee: tuition === null ? "" : String(tuition), deductionAmount: "", refundAmount: "" };
  const refund = occurrence === "before-start" ? tuition
    : occurrence === "before-sixth" ? Math.floor(tuition * 5 / 6)
      : occurrence === "before-third" ? Math.floor(tuition * 2 / 3)
        : occurrence === "before-half" ? Math.floor(tuition / 2) : 0;
  return { tuitionFee: String(tuition), deductionAmount: String(tuition - refund), refundAmount: String(refund) };
}
export function isDocumentType(value: string): value is LearnerDocumentType {
  return value === "application" || value === "scholarship" || value === "refund";
}
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function documentErrors(type: LearnerDocumentType, v: LearnerDocumentValues) {
  const errors: Partial<Record<keyof LearnerDocumentValues, string>> = {};
  const required: (keyof LearnerDocumentValues)[] = ["courseName", "name", "phone", "signedOn", "signature"];
  required.push(...(type === "application"
    ? ["gender", "birthDate", "address", "purposes", "privacy", "publicity", "portrait"] as const
    : type === "scholarship"
      ? ["gender", "privacy", "residentFront", "residentBack", "bank", "account", "accountHolder"] as const
      : ["address", "residentFront", "residentBack", "bank", "account", "accountHolder", "refundOccurrence", "tuitionFee", "deductionAmount", "refundAmount"] as const));
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
    if (type === "refund") {
      if (!v.offeringId || !v.tuitionFee) errors.courseName = "수강료가 등록된 과정을 선택해 주세요.";
      if (v.homePhone && (!/^[\d -]{7,15}$/.test(v.homePhone) || v.homePhone.replace(/\D/g, "").length < 7)) errors.homePhone = "자택전화 번호를 확인해 주세요.";
      for (const field of ["tuitionFee", "deductionAmount", "refundAmount"] as const) {
        const amount = v[field].replace(/[\s,]/g, "");
        if (!/^\d{1,12}$/.test(amount)) errors[field] = "금액은 숫자로 입력해 주세요.";
      }
    }
  }
  return errors;
}
