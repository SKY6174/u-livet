import { randomUUID } from "node:crypto";
import { ActionForm } from "./action-form";
import { dateTime } from "@/lib/portal/data";
import {
  money,
  financeLabels,
  type FinanceOverview,
  type Invoice,
  type Refund,
} from "@/lib/finance/types";
import {
  reportPayment,
  recordPayment,
  allocatePayment,
  requestRefund,
  reviewRefund,
  decideRefund,
  startRefundTransfer,
  resolveRefundTransfer,
  expireInvoices,
} from "@/app/finance-actions";
const Hidden = ({ name, value }: { name: string; value: string | number }) => (
  <input type="hidden" name={name} value={value} />
);
const Confirm = ({ children }: { children: React.ReactNode }) => (
  <label className="flex items-start gap-3 text-sm">
    <input type="checkbox" name="confirmed" required className="mt-1" />
    <span>{children}</span>
  </label>
);
const Reason = ({
  name = "reason",
  label = "처리 사유",
  max = 1000,
}: {
  name?: string;
  label?: string;
  max?: number;
}) => (
  <label className="field">
    {label}
    <textarea name={name} maxLength={max} required rows={2} />
  </label>
);
function RefundCard({
  refund: r,
  invoice: i,
  can,
  me,
}: {
  refund: Refund;
  invoice: Invoice;
  can: (p: string) => boolean;
  me: string;
}) {
  const self = i.person_id === me;
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
      <div className="flex flex-wrap justify-between gap-3">
        <h3 className="font-bold">{financeLabels[r.status]}</h3>
        <span>{r.amount === null ? "금액 산출 전" : money(r.amount)}</span>
      </div>
      <p className="text-sm">
        신청 {dateTime(r.requested_at)} · {r.reason}
      </p>
      <p className="text-sm">
        교육기간 {r.snapshot.starts_on} ~ {r.snapshot.ends_on} · 신청 당시 등록
        회차 {r.snapshot.sessions.length}개
      </p>
      {r.rule_label && (
        <p className="text-sm">
          적용 조항: {r.rule_label} ·{" "}
          {r.rule_basis === "TUITION" ? "원수강료" : "확인 입금"} ×{" "}
          {r.numerator}/{r.denominator} (원 미만 내림, 기지급 차감·입금한도
          적용)
        </p>
      )}
      {r.calculation_basis && (
        <p className="whitespace-pre-wrap text-sm">
          산정 근거: {r.calculation_basis}
        </p>
      )}
      {r.payee_reference && (can("APPROVE") || can("PAYOUT")) && (
        <p className="text-sm">반환대상 확인 문서: {r.payee_reference}</p>
      )}
      {r.decision_reason && (
        <p className="text-sm">결정 사유: {r.decision_reason}</p>
      )}
      {can("RECORD") &&
        !self &&
        ["REQUESTED", "REVIEWED"].includes(r.status) && (
          <details>
            <summary className="font-semibold cursor-pointer">
              환불 조항 검토·산출
            </summary>
            <div className="mt-4">
              <ActionForm action={reviewRefund} label="서버에서 환불액 산출">
                <Hidden name="r" value={r.id} />
                <Hidden name="expected_revision" value={r.revision} />
                <label className="field">
                  적용 조항
                  <select name="rule" required defaultValue="">
                    <option value="" disabled>
                      승인 규정의 조항 선택
                    </option>
                    {i.rules.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label} · {c.numerator}/{c.denominator}
                      </option>
                    ))}
                  </select>
                </label>
                <Reason
                  name="basis"
                  label="규정 조항·요청시각·교육 진행·기지급 확인 근거"
                  max={2000}
                />
                <Reason
                  name="payee_reference"
                  label="원입금자 반환대상 확인 문서 참조 (전체 계좌번호 입력 금지)"
                  max={300}
                />
                <details>
                  <summary>신청 당시 회차 근거</summary>
                  <ul className="mt-2 text-sm">
                    {r.snapshot.sessions.map((s) => (
                      <li key={s.id}>
                        {dateTime(s.starts_at)} ~ {dateTime(s.ends_at)} ·{" "}
                        {s.status === "CANCELLED" ? "휴강" : "예정/진행"}
                      </li>
                    ))}
                  </ul>
                </details>
              </ActionForm>
            </div>
          </details>
        )}
      {can("APPROVE") &&
        !self &&
        r.reviewed_by !== me &&
        ["REQUESTED", "REVIEWED"].includes(r.status) && (
          <ActionForm action={decideRefund} label="환불 결정 저장">
            <Hidden name="r" value={r.id} />
            <Hidden name="expected_revision" value={r.revision} />
            <label className="field">
              결정
              <select name="approve">
                <option value="false">반려</option>
                {r.status === "REVIEWED" && Number(r.amount) > 0 && (
                  <option value="true">산출액 승인</option>
                )}
              </select>
            </label>
            <Reason />
            <Confirm>
              적용 규정·산정 근거·승인액을 확인했습니다. 승인만으로 송금되지는
              않습니다.
            </Confirm>
          </ActionForm>
        )}
      {can("PAYOUT") &&
        !self &&
        r.approved_by !== me &&
        r.status === "APPROVED" && (
          <ActionForm action={startRefundTransfer} label="송금 업무 시작 기록">
            <Hidden name="r" value={r.id} />
            <Hidden name="expected_revision" value={r.revision} />
            <p className="text-sm">반환대상 확인: {r.payee_reference}</p>
            <Confirm>
              승인액과 원입금자 반환대상을 확인했습니다. 은행 송금은 별도 업무로
              진행하며 결과를 기록하겠습니다.
            </Confirm>
          </ActionForm>
        )}
      {r.transfers.map((t) => (
        <div key={t.id} className="border-t pt-4 space-y-3">
          <p className="text-sm break-all">
            지급 참조 {t.id} · {financeLabels[t.status]} · {money(t.amount)}
          </p>
          {t.external_ref && (
            <p className="text-sm break-all">
              은행 거래 참조: {t.external_ref}
            </p>
          )}
          {t.evidence && <p className="text-sm">확인 근거: {t.evidence}</p>}
          {can("PAYOUT") &&
            !self &&
            r.approved_by !== me &&
            ["PROCESSING", "RECONCILING"].includes(t.status) && (
              <ActionForm
                action={resolveRefundTransfer}
                label="은행 확인 결과 기록"
              >
                <Hidden name="t" value={t.id} />
                <label className="field">
                  은행 거래 결과
                  <select name="result">
                    <option value="RECONCILING">불명확 — 거래 확인 필요</option>
                    <option value="PAID">실제 지급 확인</option>
                    <option value="NOT_PAID">
                      실제 미지급 확인 — 재처리 허용
                    </option>
                  </select>
                </label>
                <label className="field">
                  실제 송금액 (지급 확인 시 필수)
                  <input
                    type="number"
                    name="confirmed_amount"
                    min={1}
                    step={1}
                    max={100000000}
                  />
                </label>
                <label className="field">
                  은행 거래 참조 (지급 확인 시 필수)
                  <input name="external_ref" maxLength={200} />
                </label>
                <Reason
                  name="evidence"
                  label="은행 조회·거래명세 등 결과 확인 근거"
                />
                <Confirm>
                  실제 은행 거래를 확인했습니다. 불명확한 경우 지급 완료로
                  기록하지 않습니다.
                </Confirm>
              </ActionForm>
            )}
        </div>
      ))}
    </section>
  );
}
export function FinanceLedger({
  data,
  me,
  staff = false,
}: {
  data: FinanceOverview;
  me: string;
  staff?: boolean;
}) {
  return (
    <div className="space-y-8">
      {staff && (
        <section className="panel">
          <h2 className="section-title">확인된 입금 · 미배분 잔액</h2>
          <p className="text-sm text-slate-600 mb-4">
            최근 100건. 청구에 배분해야 납부에 반영됩니다. 미배분·초과입금은
            별도 확인이 필요합니다.
          </p>
          {data.payments.length === 0 ? (
            <p>확인된 입금이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {data.payments.map((p) => (
                <div key={p.id} className="border-t pt-3">
                  <p className="font-semibold">
                    {p.person_name} · {money(p.amount)} · 미배분{" "}
                    {money(p.unallocated)}
                  </p>
                  <p className="text-sm break-all">
                    {p.external_ref} · {dateTime(p.deposited_at)} · 입금자{" "}
                    {p.depositor}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {data.invoices.length === 0 && (
        <p className="notice">
          청구 내역이 없습니다. 무료 과정에는 입금 기록을 만들지 않습니다.
        </p>
      )}
      {data.invoices.map((i) => {
        const can = (p: string) =>
          staff &&
          data.permissions.some(
            (g) => g.org_id === i.org_id && g.permission === p,
          );
        const self = i.person_id === me;
        const activeRefund = i.refunds.some(
          (r) => !["PAID", "REJECTED"].includes(r.status),
        );
        const expired =
          i.status === "OPEN" && Date.parse(i.due_at) <= Date.now();
        const payments = data.payments.filter(
          (p) =>
            p.org_id === i.org_id &&
            p.person_id === i.person_id &&
            p.unallocated > 0,
        );
        return (
          <article
            key={i.id}
            id={`invoice-${i.id}`}
            className="panel space-y-6"
          >
            <div>
              <span className="badge">
                {expired
                  ? "납부기한 경과 · 만료 정리 대상"
                  : financeLabels[i.status]}
              </span>
              <h2 className="text-xl font-bold mt-3">{i.offering_name}</h2>
              <p className="text-sm text-slate-500 mt-2">
                {staff ? `${i.person_name} · ` : ""}납부기한{" "}
                {dateTime(i.due_at)}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                ["원청구", i.amount],
                ["배분된 입금", i.paid],
                ["기지급 환불", i.refunded],
                ["환불 예약", i.reserved],
                ["청구 조정", i.credited],
                ["남은 미납", i.balance],
              ].map(([label, n]) => (
                <div key={label}>
                  <dt className="text-sm text-slate-500">{label}</dt>
                  <dd className="mt-1 font-semibold">{money(Number(n))}</dd>
                </div>
              ))}
            </dl>
            {["CANCELLED", "EXPIRED"].includes(i.status) &&
              i.paid > i.refunded && (
                <p className="notice">
                  수강이 취소된 청구에 수납액이 남아 있습니다. 적용 규정과 아래
                  환불 정산 내역을 확인하세요.
                </p>
              )}
            <details>
              <summary className="cursor-pointer font-semibold">
                납부 안내·적용 환불 규정
              </summary>
              <p className="mt-4 whitespace-pre-wrap">{i.instructions}</p>
              <h3 className="font-bold mt-4">
                {i.policy_title} · {i.policy_version}
              </h3>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {i.policy_body}
              </p>
            </details>
            {i.reports.length > 0 && (
              <details>
                <summary className="cursor-pointer font-semibold">
                  수강생 입금 신고 {i.reports.length}건
                </summary>
                {i.reports.map((p) => (
                  <p key={p.id} className="mt-2 text-sm">
                    {dateTime(p.deposited_at)} · {p.depositor} ·{" "}
                    {money(p.amount)} (신고만으로 납부 확정되지 않음)
                  </p>
                ))}
              </details>
            )}
            {!staff && i.status === "OPEN" && !expired && (
              <details>
                <summary className="cursor-pointer font-semibold">
                  입금 사실 신고
                </summary>
                <div className="mt-4">
                  <ActionForm action={reportPayment} label="입금 신고 접수">
                    <Hidden name="i" value={i.id} />
                    <Hidden name="request_key" value={randomUUID()} />
                    <PaymentFields />
                    <p className="text-sm text-slate-600">
                      사업단이 실제 거래를 확인하고 배분한 뒤 납부 상태가
                      변경됩니다.
                    </p>
                  </ActionForm>
                </div>
              </details>
            )}
            {can("RECORD") && !self && (
              <details>
                <summary className="cursor-pointer font-semibold">
                  은행 입금 대사·확인 등록
                </summary>
                <div className="mt-4">
                  <ActionForm action={recordPayment} label="대사한 입금 등록">
                    <Hidden name="i" value={i.id} />
                    <PaymentFields />
                    <label className="field">
                      기관 계좌·은행 거래 고유 참조
                      <input name="external_ref" maxLength={200} required />
                    </label>
                    <Reason
                      name="evidence"
                      label="대사 증빙 참조·동명이인 확인 근거"
                    />
                    <Confirm>
                      은행 거래명세의 입금액·입금자·일시와 이 수강생의 거래를
                      대사했습니다.
                    </Confirm>
                  </ActionForm>
                </div>
              </details>
            )}
            {can("RECORD") &&
              !self &&
              payments.length > 0 &&
              i.paid < i.amount &&
              !activeRefund && (
                <ActionForm
                  action={allocatePayment}
                  label="입금을 이 청구에 배분"
                >
                  <Hidden name="i" value={i.id} />
                  <Hidden name="request_key" value={randomUUID()} />
                  <label className="field">
                    확인된 입금
                    <select name="p" required>
                      {payments.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.external_ref} · 남은 {money(p.unallocated)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    배분 금액
                    <input
                      type="number"
                      name="amount"
                      min={1}
                      max={i.amount - i.paid}
                      step={1}
                      required
                    />
                  </label>
                </ActionForm>
              )}
            {staff && expired && (
              <ActionForm
                action={expireInvoices}
                label="이 기수의 납부기한 만료 정리"
              >
                <Hidden name="f" value={i.offering_id} />
              </ActionForm>
            )}
            {!staff && i.paid - i.refunded > 0 && !activeRefund && (
              <details>
                <summary className="cursor-pointer font-semibold text-rose-800">
                  수강취소·환불 신청
                </summary>
                <div className="mt-4">
                  <ActionForm
                    action={requestRefund}
                    label="수강취소 및 환불 신청"
                  >
                    <Hidden name="i" value={i.id} />
                    <Hidden name="request_key" value={randomUUID()} />
                    <Reason label="환불 신청 사유" />
                    <Confirm>
                      신청 즉시 수강이 취소되고 강의실 이용이 종료됩니다.
                      환불액은 위 규정에 따라 검토하며 반려되어도 수강이 자동
                      복원되지 않습니다.
                    </Confirm>
                  </ActionForm>
                </div>
              </details>
            )}
            {i.refunds.map((r) => (
              <RefundCard key={r.id} refund={r} invoice={i} can={can} me={me} />
            ))}
            <details>
              <summary className="cursor-pointer text-sm text-slate-600">
                처리 이력 {i.events.length}건
              </summary>
              <ol className="mt-3 space-y-2 text-sm">
                {i.events.map((e, n) => (
                  <li key={n}>
                    {dateTime(e.created_at)} ·{" "}
                    {eventLabel[e.action] ?? e.action}
                    {typeof e.details.amount === "number"
                      ? ` · ${money(e.details.amount)}`
                      : ""}
                  </li>
                ))}
              </ol>
            </details>
          </article>
        );
      })}
    </div>
  );
}
function PaymentFields() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="field">
        입금액
        <input
          type="number"
          name="amount"
          min={1}
          max={100000000}
          step={1}
          required
        />
      </label>
      <label className="field">
        입금자명
        <input name="depositor" maxLength={100} required />
      </label>
      <label className="field">
        입금 일시 (한국시간)
        <input type="datetime-local" name="deposited_at" required />
      </label>
    </div>
  );
}
const eventLabel: Record<string, string> = {
  INVOICE_CREATED: "청구 생성",
  INVOICE_EXPIRED: "납부기한 만료",
  APPLICATION_CANCELLED: "신청 취소",
  PAYMENT_REPORTED: "입금 신고",
  PAYMENT_VERIFIED: "은행 입금 확인",
  PAYMENT_ALLOCATED: "청구 배분",
  REFUND_REQUESTED: "환불 신청·수강취소",
  REFUND_REVIEWED: "환불액 산출",
  REFUND_REJECTED: "환불 반려",
  REFUND_APPROVED: "환불 승인",
  REFUND_PROCESSING: "송금 업무 시작",
  REFUND_RECONCILING: "은행 거래 확인 필요",
  REFUND_NOT_PAID: "미지급 확인",
  REFUND_PAID: "환불 지급 확인",
};
