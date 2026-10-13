"use client";

import { useId, useState } from "react";
import { MAX_DRAFT_TUITION } from "@/lib/course-opening/working-copy";

export function DraftTuitionFields({ feeType, tuition }: { feeType?: string; tuition?: string }) {
  const [paid, setPaid] = useState(feeType === "PAID");
  const [amount, setAmount] = useState(tuition && Number(tuition) > 0 ? tuition : "");
  const helpId = useId();
  return <>
    <label className="field">수강료 구분
      <select name="fee_type" required value={paid ? "PAID" : "FREE"} onChange={event => setPaid(event.target.value === "PAID")}>
        <option value="FREE">무료</option><option value="PAID">유료</option>
      </select>
    </label>
    <label className="field">1인 수강료 (원)
      <input type="number" name="tuition" min={paid ? 1 : 0} max={MAX_DRAFT_TUITION} step={1} required={paid} readOnly={!paid} value={paid ? amount : "0"} onChange={event => setAmount(event.target.value)} aria-describedby={helpId} />
    </label>
    <p id={helpId} className="text-sm text-slate-600 md:col-span-2">
      {paid ? "1인 수강료를 원 단위로 입력하세요. 유료 과정은 모집 공개 전에 기수 상세에서 승인된 환불 규정과 납부 안내를 설정해야 합니다." : "무료 과정의 수강료는 0원으로 저장됩니다."}
    </p>
  </>;
}
