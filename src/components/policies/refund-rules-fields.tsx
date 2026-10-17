"use client";
import { useState } from "react";

export function RefundRulesFields() {
  const [rows, setRows] = useState([0]);
  return <fieldset className="space-y-3 rounded-xl border p-4"><legend className="px-1 font-semibold">환불 계산 조항</legend>
    <p className="text-sm text-slate-600">기관이 검토한 조항을 입력하세요. 기준 금액 × 분자 ÷ 분모로 계산하며 승인 후에는 이 버전의 조항을 수정할 수 없습니다.</p>
    {rows.map((id, index) => <div key={id} className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
      <label className="field">조항 {index + 1} 설명<input name="rule_label" required maxLength={300} placeholder="예: 교육 시작 전 취소"/></label>
      <label className="field">계산 기준<select name="rule_basis"><option value="TUITION">수강료</option><option value="PAID">실제 납부액</option></select></label>
      <label className="field">분자<input name="rule_numerator" type="number" min={0} max={100000} step={1} required defaultValue={1}/></label>
      <label className="field">분모<input name="rule_denominator" type="number" min={1} max={100000} step={1} required defaultValue={1}/></label>
      <button type="button" className="text-left text-sm text-red-700" disabled={rows.length===1} onClick={() => setRows(rows.filter(row => row !== id))}>이 조항 삭제</button>
    </div>)}
    <button type="button" className="btn-secondary" disabled={rows.length>=20} onClick={() => setRows([...rows, Math.max(...rows)+1])}>계산 조항 추가</button>
  </fieldset>;
}
