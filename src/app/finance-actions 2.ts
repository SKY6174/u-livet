"use server";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";
import { revalidatePath } from "next/cache";
import { getSessionIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import type { ActionState } from "@/lib/portal/types";
const messages: Record<string, string> = {
  MFA_REAUTH_REQUIRED: MFA_REAUTH_MESSAGE,
  FORBIDDEN: "해당 기관의 처리 권한이 없거나 본인 거래입니다.",
  AUTH_REQUIRED: "다시 로그인해 주세요.",
  APPROVED_REFUND_POLICY_REQUIRED:
    "승인된 환불 규정과 계산 조항을 먼저 등록해 주세요.",
  IDEMPOTENCY_CONFLICT:
    "같은 거래 참조에 다른 내용이 등록되어 있습니다. 원거래를 확인해 주세요.",
  PAYMENT_SCOPE_MISMATCH: "같은 수강생·기관의 입금만 배분할 수 있습니다.",
  ALLOCATION_EXCEEDS_BALANCE: "입금 잔액 또는 청구 잔액을 초과했습니다.",
  REFUND_IN_PROGRESS: "진행 중인 환불을 먼저 확인해 주세요.",
  NO_REFUND_BALANCE: "확인된 환불 가능 입금이 없습니다.",
  REFUND_RULE_MISMATCH: "이 청구에 적용된 규정의 조항을 선택해 주세요.",
  REVISION_CHANGED:
    "다른 담당자가 처리했습니다. 새로고침해 현재 상태를 확인해 주세요.",
  SELF_APPROVAL_FORBIDDEN: "산출자와 승인자는 서로 달라야 합니다.",
  REFUND_REVIEW_REQUIRED: "양수의 환불 산출액을 먼저 검토해야 합니다.",
  REFUND_BALANCE_CHANGED: "입금·환불 잔액이 변경되어 재산출이 필요합니다.",
  RECONCILIATION_REQUIRED:
    "은행 거래 확인 전에는 새 송금 처리를 시작할 수 없습니다.",
  TRANSFER_AMOUNT_MISMATCH:
    "실제 송금 금액과 승인액, 거래 참조를 확인해 주세요.",
  PAYMENT_DEADLINE_CHANGED:
    "납부기한이 지났습니다. 기한 만료 처리 후 다시 대사해 주세요.",
  INVALID_TRANSITION: "현재 상태에서는 처리할 수 없습니다.",
};
const value = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
async function run(
  f: FormData,
  rpc: string,
  ids: string[],
  texts: string[],
  numbers: string[] = [],
  dates: string[] = [],
  extra: Record<string, unknown> = {},
): Promise<ActionState> {
  if (!(await getSessionIdentity())) return { message: "로그인이 필요합니다." };
  const args: Record<string, unknown> = { ...extra };
  for (const k of ids) {
    if (!UUID.test(value(f, k)))
      return { message: "대상 정보를 확인해 주세요." };
    args[k] = value(f, k);
  }
  for (const k of texts) {
    const s = value(f, k);
    if (!s || s.length > 3000)
      return { message: "필수 내용을 3,000자 이내로 입력해 주세요." };
    args[k] = s;
  }
  for (const k of numbers) {
    const s = value(f, k);
    if (
      !/^\d+$/.test(s) ||
      !Number.isSafeInteger(Number(s)) ||
      Number(s) > 100000000
    )
      return { message: "금액과 버전은 올바른 정수로 입력해 주세요." };
    args[k] = Number(s);
  }
  for (const k of dates) {
    const s = value(f, k);
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ||
      !Number.isFinite(Date.parse(s + "+09:00"))
    )
      return { message: "입금 일시를 확인해 주세요." };
    args[k] = s + "+09:00";
  }
  try {
    const { error } = await (await createServerSupabaseClient()).rpc(rpc, args);
    if (error)
      return {
        message:
          messages[error.message] ??
          "처리하지 못했습니다. 입력 내용·중복 거래·현재 상태를 확인해 주세요.",
      };
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: "처리 내용이 저장되었습니다. 아래 현재 상태를 확인해 주세요.",
    };
  } catch {
    return {
      message: "연결에 실패했습니다. 현재 상태를 확인한 뒤 다시 시도해 주세요.",
    };
  }
}
export async function configureFinance(_: ActionState, f: FormData) {
  return run(
    f,
    "life_configure_finance",
    ["f", "policy"],
    ["instructions"],
    ["tuition", "hours"],
  );
}
export async function reportPayment(_: ActionState, f: FormData) {
  return run(
    f,
    "life_payment_report",
    ["i", "request_key"],
    ["depositor"],
    ["amount"],
    ["deposited_at"],
  );
}
export async function recordPayment(_: ActionState, f: FormData) {
  if (f.get("confirmed") !== "on")
    return { message: "실제 은행 거래 대사 확인에 체크해 주세요." };
  return run(
    f,
    "life_record_payment",
    ["i"],
    ["depositor", "external_ref", "evidence"],
    ["amount"],
    ["deposited_at"],
  );
}
export async function allocatePayment(_: ActionState, f: FormData) {
  return run(
    f,
    "life_allocate_payment",
    ["i", "p", "request_key"],
    [],
    ["amount"],
  );
}
export async function expireInvoices(_: ActionState, f: FormData) {
  return run(f, "life_expire_invoices", ["f"], []);
}
export async function requestRefund(_: ActionState, f: FormData) {
  if (f.get("confirmed") !== "on")
    return { message: "수강취소와 학습 종료 안내를 확인해 주세요." };
  return run(f, "life_request_refund", ["i", "request_key"], ["reason"]);
}
export async function reviewRefund(_: ActionState, f: FormData) {
  return run(
    f,
    "life_review_refund",
    ["r", "rule"],
    ["basis", "payee_reference"],
    ["expected_revision"],
  );
}
export async function decideRefund(_: ActionState, f: FormData) {
  if (
    !["true", "false"].includes(value(f, "approve")) ||
    f.get("confirmed") !== "on"
  )
    return { message: "결정 내용과 계산 근거 확인에 체크해 주세요." };
  return run(
    f,
    "life_decide_refund",
    ["r"],
    ["reason"],
    ["expected_revision"],
    [],
    { approve: value(f, "approve") === "true" },
  );
}
export async function startRefundTransfer(_: ActionState, f: FormData) {
  if (f.get("confirmed") !== "on")
    return { message: "승인액과 반환대상 확인에 체크해 주세요." };
  return run(f, "life_start_refund_transfer", ["r"], [], ["expected_revision"]);
}
export async function resolveRefundTransfer(_: ActionState, f: FormData) {
  const result = value(f, "result");
  if (
    !["PAID", "RECONCILING", "NOT_PAID"].includes(result) ||
    f.get("confirmed") !== "on"
  )
    return { message: "은행 거래 확인 결과에 체크해 주세요." };
  return run(
    f,
    "life_resolve_refund_transfer",
    ["t"],
    ["evidence"],
    result === "PAID" ? ["confirmed_amount"] : [],
    [],
    {
      result,
      external_ref: value(f, "external_ref"),
      confirmed_amount: result === "PAID" ? undefined : null,
    },
  );
}
