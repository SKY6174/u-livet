export type FinanceConfig = {
  policy_id: string;
  title: string;
  version: string;
  body: string;
  reservation_hours: number;
  instructions: string;
  valid: boolean;
};
export type RefundRule = {
  id: string;
  label: string;
  basis: "TUITION" | "PAID";
  numerator: number;
  denominator: number;
};
export type Transfer = {
  id: string;
  status: string;
  amount: number;
  external_ref: string | null;
  evidence: string | null;
  started_at: string;
};
export type Refund = {
  id: string;
  status: string;
  revision: number;
  reason: string;
  requested_at: string;
  amount: number | null;
  rule_label: string | null;
  rule_basis: string | null;
  numerator: number | null;
  denominator: number | null;
  calculation_basis: string | null;
  reviewed_by: string | null;
  approved_by: string | null;
  decision_reason: string | null;
  payee_reference: string | null;
  snapshot: {
    starts_on: string;
    ends_on: string;
    sessions: {
      id: string;
      starts_at: string;
      ends_at: string;
      status: string;
    }[];
  };
  transfers: Transfer[];
};
export type Invoice = {
  id: string;
  offering_id: string;
  org_id: string;
  person_id: string;
  person_name: string;
  offering_name: string;
  status: string;
  amount: number;
  due_at: string;
  created_at: string;
  policy_title: string;
  policy_version: string;
  policy_body: string;
  instructions: string;
  paid: number;
  refunded: number;
  reserved: number;
  credited: number;
  balance: number;
  rules: RefundRule[];
  refunds: Refund[];
  reports: {
    id: string;
    amount: number;
    depositor: string;
    deposited_at: string;
  }[];
  events: {
    action: string;
    details: Record<string, unknown>;
    created_at: string;
  }[];
};
export type Payment = {
  id: string;
  org_id: string;
  person_id: string;
  person_name: string;
  amount: number;
  unallocated: number;
  depositor: string;
  external_ref: string;
  deposited_at: string;
  evidence: string;
};
export type FinanceOverview = {
  permissions: { org_id: string; permission: string }[];
  invoices: Invoice[];
  payments: Payment[];
};
export const money = (amount: number) =>
  `${Number(amount).toLocaleString("ko-KR")}원`;
export const financeLabels: Record<string, string> = {
  OPEN: "납부 대기",
  SETTLED: "납부 확인",
  CANCELLED: "수강 취소",
  EXPIRED: "납부기한 만료",
  REQUESTED: "환불 검토 대기",
  REVIEWED: "환불 산출 완료",
  APPROVED: "환불 승인 · 지급 대기",
  PROCESSING: "송금 처리 중",
  RECONCILING: "은행 거래 확인 필요",
  PAID: "환불 지급 확인",
  REJECTED: "환불 반려",
  NOT_PAID: "미지급 확인",
};
