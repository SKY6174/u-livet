"use client";
import { useState } from "react";
import { ActionForm } from "@/components/portal/action-form";
import {
  savePoolPerson,
  saveAllowance,
  transitionAllowance,
} from "@/app/instructor-pool-actions";
import {
  ACTIVITY_LABELS,
  money,
  type Allowance,
  type PoolBoard,
  type PoolPerson,
} from "@/lib/instructors/pool";

export function PoolPersonForm({
  org,
  person,
  requestKey,
}: {
  org: string;
  person?: PoolPerson;
  requestKey: string;
}) {
  const [kind, setKind] = useState(
    person?.kind === "INTERNAL" ? "INTERNAL" : "EXTERNAL",
  );
  const [required, setRequired] = useState(person?.documents_required ?? true);
  return (
    <ActionForm
      action={savePoolPerson}
      label={person ? "강사 기본정보 저장" : "강사 신규 등록"}
      resetOnSuccess={!person}
    >
      <input type="hidden" name="o" value={org} />
      <input type="hidden" name="p" value={person?.id ?? ""} />
      <input type="hidden" name="revision" value={person?.revision ?? 0} />
      <input type="hidden" name="request_key" value={requestKey} />
      <div className="grid gap-4 md:grid-cols-3">
        <label className="field">
          성명
          <input
            name="name"
            defaultValue={person?.name}
            required
            maxLength={100}
            readOnly={!!person}
            placeholder="강사 성명"
          />
        </label>
        <label className="field">
          강사 구분
          <select
            name="kind"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setRequired(e.target.value !== "INTERNAL");
            }}
          >
            <option value="INTERNAL">교내 강사</option>
            <option value="EXTERNAL">교외 강사</option>
          </select>
        </label>
        <label className="field">
          활동 상태
          <select name="status" defaultValue={person?.status ?? "ACTIVE"}>
            <option value="ACTIVE">활동 중</option>
            <option value="INACTIVE">활동 중지</option>
          </select>
        </label>
        {(
          [
            ["affiliation", "소속기관", 150],
            ["department", "소속부서", 100],
            ["position", "직위·직책", 100],
            ["specialty", "전문분야", 300],
            ["phone", "연락처", 20],
            ["email", "이메일", 254],
          ] as const
        ).map(([key, label, max]) => (
          <label className="field" key={key}>
            {label}
            <input
              name={key}
              type={
                key === "email" ? "email" : key === "phone" ? "tel" : "text"
              }
              defaultValue={person?.[key]}
              maxLength={max}
              placeholder={
                key === "phone"
                  ? "010-0000-0000"
                  : key === "affiliation"
                    ? "대학·기관·회사명"
                    : ""
              }
            />
          </label>
        ))}
      </div>
      <label className="field">
        관리 메모
        <textarea
          name="notes"
          defaultValue={person?.notes}
          maxLength={2000}
          rows={2}
          placeholder="강의 가능 분야, 위촉 확인 사항 등"
        />
      </label>
      <label className="flex items-center gap-3 rounded-xl bg-blue-50 p-4 text-sm">
        <input
          type="checkbox"
          name="documents_required"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
        수당 지급에 신분증·통장사본·이력서 제출 필요
      </label>
      <p className="text-xs text-slate-500">
        주민등록번호와 계좌번호는 비공개 서류함에서 관리합니다. 신규 등록 후
        서류함을 열어 자료를 입력할 수 있습니다.
      </p>
    </ActionForm>
  );
}
export function AllowanceForm({
  org,
  person,
  offerings,
  allowance,
  requestKey,
}: {
  org: string;
  person: PoolPerson;
  offerings: PoolBoard["offerings"];
  allowance?: Allowance;
  requestKey: string;
}) {
  const [minutes, setMinutes] = useState(allowance?.minutes ?? 60),
    [rate, setRate] = useState(allowance?.rate ?? 0),
    [withholding, setWithholding] = useState(allowance?.withholding ?? 0);
  const gross = Math.round((minutes * rate) / 60);
  return (
    <ActionForm
      action={saveAllowance}
      label={allowance ? "활동·산출 내역 수정" : "활동·수당 등록"}
      resetOnSuccess={false}
    >
      <input type="hidden" name="o" value={org} />
      <input type="hidden" name="p" value={person.id} />
      <input type="hidden" name="a" value={allowance?.id ?? ""} />
      <input type="hidden" name="revision" value={allowance?.revision ?? 0} />
      <input type="hidden" name="request_key" value={requestKey} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="field">
          강사
          <input value={person.name} readOnly />
        </label>
        <label className="field">
          활동 구분
          <select
            name="activity_kind"
            defaultValue={allowance?.activity_kind ?? "TEACHING"}
          >
            {Object.entries(ACTIVITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field md:col-span-2">
          연계 교육과정
          <select
            name="offering_id"
            defaultValue={allowance?.offering_id ?? ""}
          >
            <option value="">과정 없이 활동명으로 등록</option>
            {offerings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} · {o.starts_on}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          강의·활동명
          <input
            name="title"
            defaultValue={allowance?.title}
            required
            maxLength={200}
            placeholder="예: 디지털 실무 과정 1차시 강의"
          />
        </label>
        <label className="field">
          활동일
          <input
            type="date"
            name="activity_on"
            defaultValue={allowance?.activity_on}
            required
            min="2000-01-01"
          />
        </label>
        <label className="field">
          활동 시간 (분)
          <input
            name="minutes"
            type="number"
            required
            min={1}
            max={60000}
            step={1}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </label>
        <label className="field">
          시간당 단가 (원)
          <input
            name="rate"
            type="number"
            required
            min={0}
            max={100000000}
            step={1}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
          />
        </label>
        <label className="field">
          공제액 (원)
          <input
            name="withholding"
            type="number"
            required
            min={0}
            max={Math.max(0, gross)}
            step={1}
            value={withholding}
            onChange={(e) => setWithholding(Number(e.target.value))}
          />
        </label>
        <div className="rounded-xl bg-blue-50 p-4">
          <p className="text-sm text-slate-600">
            산출액 {money(gross)} − 공제액 {money(withholding)}
          </p>
          <p className="mt-2 font-bold text-blue-800">
            실지급 예정 {money(gross - withholding)}
          </p>
        </div>
      </div>
      <label className="field">
        산출·활동 근거
        <textarea
          name="evidence"
          defaultValue={allowance?.evidence}
          maxLength={1000}
          rows={2}
          placeholder="위촉 문서, 강의 확인, 지급 기준 등의 참조"
        />
      </label>
      <p className="text-xs text-slate-500">
        단가와 공제액은 적용 기준을 확인하여 입력하세요. 분 단위 시간 × 시간당
        단가 ÷ 60으로 산출하며 원 단위로 반올림합니다.
      </p>
    </ActionForm>
  );
}
export function PaymentForm({
  org,
  allowance,
  action,
}: {
  org: string;
  allowance: Allowance;
  action: "PAY" | "CANCEL";
}) {
  return (
    <ActionForm
      action={transitionAllowance}
      label={action === "PAY" ? "지급 완료 기록" : "기록 취소"}
    >
      <input type="hidden" name="o" value={org} />
      <input type="hidden" name="a" value={allowance.id} />
      <input type="hidden" name="revision" value={allowance.revision} />
      <input type="hidden" name="action" value={action} />
      {action === "PAY" && (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="field">
            실제 지급일
            <input
              name="paid_on"
              type="date"
              min={allowance.activity_on}
              required
            />
          </label>
          <label className="field">
            거래·결의번호
            <input name="reference" required maxLength={200} />
          </label>
        </div>
      )}
      <label className="field">
        {action === "PAY" ? "지급 확인 근거" : "취소 사유"}
        <textarea name="evidence" required maxLength={1000} rows={2} />
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input name="confirmed" type="checkbox" required />
        {action === "PAY"
          ? `${money(allowance.net)}의 실제 지급을 확인했습니다. 이 버튼은 송금을 실행하지 않습니다.`
          : "원래 기록을 보존하고 집계에서 제외함을 확인했습니다. 실제 송금 취소는 별도로 처리합니다."}
      </label>
    </ActionForm>
  );
}
