export const ENROLLMENT_POLICY_WRITING_GUIDE = [
  "신청 자격, 모집기간·정원, 선발 방법과 결과 안내, 취소·문의 경로",
  "개인정보 처리 주체와 수집·이용 목적, 필요한 항목, 보유·이용기간",
  "동의를 받는 경우 거부할 권리와 거부 시 불이익; 제3자 제공·선택 동의는 필요한 경우 별도 구분",
].join("\n");

export const COMPLETION_POLICY_WRITING_GUIDE = [
  "인정 출석률과 지각·조퇴·결석·보강의 계산 방법",
  "과제·시험·실습 등 평가 항목별 통과 기준과 재평가·미제출 처리",
  "최종 판정·이의신청 절차, 수료증 발급 조건과 결과 통지 시점",
].join("\n");

type PolicyText = { title: string; version: string; body: string };

export const REFUND_POLICY_WRITING_GUIDE = [
  "기관이 확정한 환불 사유·접수 절차·시점별 반환 기준을 작성합니다.",
  "승인할 때 계산 조항을 함께 등록합니다. 기존 승인본 변경은 새 버전으로 작성합니다.",
].join("\n");

function isOperationalPolicy(policy: PolicyText, writingGuide: string) {
  return !/(검증용|issue\s*[0-9]+|dummy-[0-9]+|fixture)/i.test(
    [policy.title, policy.version, policy.body].join("\n"),
  ) && policy.body.replace(/\r\n/g, "\n").trim() !== writingGuide;
}

export function isOperationalRecruitmentPolicy(policy: PolicyText) {
  return isOperationalPolicy(policy, ENROLLMENT_POLICY_WRITING_GUIDE);
}

export function isOperationalCompletionPolicy(policy: PolicyText) {
  return isOperationalPolicy(policy, COMPLETION_POLICY_WRITING_GUIDE);
}

export function isOperationalRefundPolicy(policy: PolicyText) {
  return isOperationalPolicy(policy, REFUND_POLICY_WRITING_GUIDE)
    && !/(검증\s*전용|\[테스트\])/i.test([policy.title, policy.version, policy.body].join("\n"));
}
