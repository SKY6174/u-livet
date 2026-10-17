"use client";
import { RECRUITMENT } from "@/lib/operation-documents/schema";
import { PLAN_PURPOSES, recruitmentRatio, validRecruitment } from "@/lib/operation-documents/plan-input";

export function PurposeInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const selected = PLAN_PURPOSES.filter(option => value.includes(option === "취미·여가" ? "취미" : option));
  return <fieldset className="space-y-2"><legend className="font-semibold">다. 주요목적 · 중복 선택 가능</legend>
    <div className="flex flex-wrap gap-3">{PLAN_PURPOSES.map(option => <label key={option} className="flex items-center gap-2 rounded-lg border p-3">
      <input type="checkbox" checked={selected.includes(option)} onChange={e => onChange(PLAN_PURPOSES.filter(item => item === option ? e.target.checked : selected.includes(item)).join(" / "))}/>{option}
    </label>)}</div>{value && !selected.length && <p className="text-sm text-slate-500">기존 표기: {value}</p>}
  </fieldset>;
}

const ISSUER_FIELDS = ["기관명", "대표자", "연락처", "이메일", "소재지", "홈페이지"];
export function IssuerInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const lines = value.split("\n");
  const values = Object.fromEntries(ISSUER_FIELDS.map(key => [key, lines.find(line => line.startsWith(key + ":"))?.slice(key.length + 1).trim() ?? ""]));
  const other = lines.filter(line => line && !ISSUER_FIELDS.some(key => line.startsWith(key + ":")));
  return <fieldset className="space-y-3 rounded-xl border p-4"><legend className="px-1 font-semibold">민간자격 발급기관 정보 · 선택</legend>
    <div className="grid gap-3 sm:grid-cols-2">{ISSUER_FIELDS.map(key => <label className="field" key={key}>{key}<input maxLength={500} value={values[key]} onChange={e => {
      const next = { ...values, [key]: e.target.value };
      onChange([...other, ...ISSUER_FIELDS.filter(field => next[field]).map(field => `${field}: ${next[field]}`)].join("\n"));
    }}/></label>)}</div>{other.length > 0 && <label className="field">기존 발급기관 내용<textarea value={other.join("\n")} maxLength={1800} onChange={e => onChange([e.target.value, ...ISSUER_FIELDS.filter(field => values[field]).map(field => `${field}: ${values[field]}`)].filter(Boolean).join("\n"))}/></label>}
  </fieldset>;
}

export function RecruitmentInput({ rows, capacity, onChange }: { rows: Record<string, string>[]; capacity: string; onChange: (rows: Record<string, string>[]) => void }) {
  const categories = rows.some(row => !RECRUITMENT.includes(row.category)) || new Set(rows.map(row => row.category)).size !== rows.length ? rows.map(row => row.category) : RECRUITMENT;
  const displayRows = categories.map(category => rows.find(row => row.category === category) ?? { category, count: "", ratio: "" });
  const total = rows.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
  return <div className="min-w-0 space-y-3"><h3 className="font-semibold">나. 주요대상</h3><p className="text-sm text-slate-600">모집인원 내에서 정수로 입력하세요. 비율은 모집인원을 기준으로 계산합니다.</p>
    <div className="max-w-full overflow-x-auto rounded-xl border"><table className="w-full min-w-[850px] text-center text-sm"><thead className="bg-slate-50"><tr><th className="p-3">구분</th>{displayRows.map((row, index) => <th className="p-2" key={index}>{row.category}</th>)}</tr></thead>
      <tbody><tr><th className="p-3">인원</th>{displayRows.map((row, index) => <td className="p-1" key={index}><input aria-label={`${row.category} 인원`} className="w-20 rounded border p-2" type="number" min={0} step={1} max={Number(capacity) || 0} value={row.count} onChange={e => onChange(displayRows.map((item, i) => i === index ? { ...item, count: e.target.value, ratio: recruitmentRatio(e.target.value, capacity) } : item))}/></td>)}</tr>
      <tr><th className="p-3">비율</th>{displayRows.map((row, index) => <td className="p-2" key={index}><output aria-label={`${row.category} 비율`}>{recruitmentRatio(row.count, capacity) || "0"}%</output></td>)}</tr></tbody></table></div>
    <p className="text-sm">입력 인원 합계 {total}명 / 모집인원 {capacity || "미입력"}명</p>
    {!validRecruitment(rows, capacity) && <p role="alert" className="text-sm text-red-700">인원은 정수이며, 합계가 모집인원을 넘을 수 없습니다.</p>}
  </div>;
}
