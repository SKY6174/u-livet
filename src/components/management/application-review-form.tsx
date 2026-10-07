"use client";
import { useState } from "react";
import { ActionForm } from "@/components/portal/action-form";
import { decideApplication } from "@/app/actions";

export function ApplicationReviewForm({ id, status }: { id: string; status: string }) {
  const [decision, setDecision] = useState("ACCEPTED");
  if (!["SUBMITTED", "WAITLISTED"].includes(status)) return null;
  return <ActionForm action={decideApplication} label="심사 결과 저장" resetOnSuccess={false}>
    <input type="hidden" name="application" value={id} />
    <input type="hidden" name="expected_status" value={status} />
    <label className="field">결정<select name="decision" value={decision} onChange={e => setDecision(e.target.value)} required>
      <option value="ACCEPTED">승인 · 유료 과정은 납부 대기</option>
      <option value="REJECTED">반려 · 미선정</option>
    </select></label>
    <label className="field">{decision === "REJECTED" ? "반려 사유 (필수)" : "처리 메모 (선택)"}
      <textarea name="reason" rows={3} maxLength={1000} required={decision === "REJECTED"} />
    </label>
    <p className="text-sm text-slate-600">사유와 메모는 신청자도 확인할 수 있습니다.</p>
  </ActionForm>;
}
