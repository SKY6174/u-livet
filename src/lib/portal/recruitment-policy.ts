export const ENROLLMENT_POLICY_WRITING_GUIDE = [
  "신청 자격, 모집기간·정원, 선발 방법과 결과 안내, 취소·문의 경로",
  "개인정보 처리 주체와 수집·이용 목적, 필요한 항목, 보유·이용기간",
  "동의를 받는 경우 거부할 권리와 거부 시 불이익; 제3자 제공·선택 동의는 필요한 경우 별도 구분",
].join("\n");

export function isOperationalRecruitmentPolicy(policy: { title: string; version: string; body: string }) {
  return !/(검증용|issue\s*[0-9]+|dummy-[0-9]+|fixture)/i.test(
    [policy.title, policy.version, policy.body].join("\n"),
  ) && policy.body.replace(/\r\n/g, "\n").trim() !== ENROLLMENT_POLICY_WRITING_GUIDE;
}
