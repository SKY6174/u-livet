"use client";
import { useEffect, useState } from "react";
import { ActionForm } from "@/components/portal/action-form";
import { saveCourseReport } from "@/app/report-actions";
import { feeAmount, money, type ReportPayload } from "@/lib/reports/types";
import type { CompletionRow } from "@/lib/portal/evaluation";

type Column = {
  key: string;
  label: string;
  type?: "number" | "date" | "person" | "kind";
  max?: number;
  step?: number;
};
type Row = Record<string, string | number>;
function Rows({
  title,
  rows,
  columns,
  add,
  change,
  members,
  limit,
}: {
  title: string;
  rows: Row[];
  columns: Column[];
  add: Row;
  change: (rows: Row[]) => void;
  members: CompletionRow[];
  limit: number;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold">
          {title} · {rows.length}건
        </h3>
        <button
          type="button"
          className="btn-secondary"
          disabled={rows.length >= limit}
          onClick={() => change([...rows, { ...add }])}
        >
          행 추가
        </button>
      </div>
      {!rows.length && (
        <p className="notice">
          등록된 내역이 없습니다. 해당 내역이 있으면 행을 추가하세요.
        </p>
      )}
      {rows.map((row, i) => (
        <fieldset key={i} className="rounded-xl border bg-slate-50 p-4">
          <legend className="px-2 font-semibold">
            {title} {i + 1}
          </legend>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {columns.map((c) => (
              <label key={c.key} className="field">
                {c.label}
                {c.type === "person" ? (
                  <select
                    required
                    value={row[c.key]}
                    onChange={(e) =>
                      change(
                        rows.map((r, j) =>
                          i === j ? { ...r, [c.key]: e.target.value } : r,
                        ),
                      )
                    }
                  >
                    <option value="">학습자 선택</option>
                    {members.map((m) => (
                      <option key={m.person_id} value={m.person_id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                ) : c.type === "kind" ? (
                  <select
                    value={row[c.key]}
                    onChange={(e) =>
                      change(
                        rows.map((r, j) =>
                          i === j ? { ...r, [c.key]: e.target.value } : r,
                        ),
                      )
                    }
                  >
                    {["내부강사", "외부강사", "보조강사"].map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={c.type ?? "text"}
                    min={c.type === "number" ? 0 : undefined}
                    max={c.max}
                    step={c.step ?? 1}
                    maxLength={
                      c.key === "note" || c.key === "dates" ? 500 : 100
                    }
                    required={
                      c.type === "number" ||
                      ["name", "category"].includes(c.key)
                    }
                    value={row[c.key]}
                    onChange={(e) =>
                      change(
                        rows.map((r, j) =>
                          i === j
                            ? {
                                ...r,
                                [c.key]:
                                  c.type === "number" && e.target.value !== ""
                                    ? Number(e.target.value)
                                    : e.target.value,
                              }
                            : r,
                        ),
                      )
                    }
                  />
                )}
              </label>
            ))}
          </div>
          <button
            type="button"
            className="mt-4 text-sm font-semibold text-red-700"
            onClick={() => change(rows.filter((_, j) => j !== i))}
          >
            {i + 1}번 행 삭제
          </button>
        </fieldset>
      ))}
    </section>
  );
}
const bankColumns: Column[] = [
  { key: "bank", label: "은행명" },
  { key: "account", label: "계좌번호" },
  { key: "holder", label: "예금주" },
  { key: "paidOn", label: "지급일 (미지급은 비워두기)", type: "date" },
  { key: "note", label: "비고" },
];
const bank = { bank: "", account: "", holder: "", paidOn: "", note: "" };
export function ReportEditor({
  offering,
  initial,
  revision,
  members,
}: {
  offering: string;
  initial: ReportPayload;
  revision: number;
  members: CompletionRow[];
}) {
  const [report, setReport] = useState(initial);
  const dirty = JSON.stringify(report) !== JSON.stringify(initial);
  useEffect(() => {
    const reveal = () => {
      const element = document.getElementById(window.location.hash.slice(1));
      if (
        element instanceof HTMLDetailsElement &&
        element.id.startsWith("report-")
      ) {
        element.open = true;
        element.scrollIntoView({ block: "start" });
      }
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    if (dirty) window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const set = (key: keyof ReportPayload, value: unknown) =>
    setReport((r) => ({ ...r, [key]: value }));
  const field = (key: keyof ReportPayload, label: string, large = false) => (
    <label className="field" key={key}>
      {label}
      {large ? (
        <textarea
          rows={4}
          maxLength={5000}
          value={String(report[key])}
          onChange={(e) => set(key, e.target.value)}
        />
      ) : (
        <input
          type={key === "reportDate" ? "date" : "text"}
          maxLength={200}
          value={String(report[key])}
          onChange={(e) => set(key, e.target.value)}
        />
      )}
    </label>
  );
  return (
    <ActionForm
      action={saveCourseReport}
      label="보고서·지급내역 저장"
      resetOnSuccess={false}
    >
      <div className="sticky top-32 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
        <nav
          aria-label="보고서 입력 항목"
          className="flex flex-wrap gap-3 text-xs font-semibold text-slate-600"
        >
          {[
            ["basic", "기본정보"],
            ["budget", "예산"],
            ["review", "총평"],
            ["participants", "인적사항"],
            ["scholarships", "장학금"],
            ["fees", "강사료"],
          ].map(([key, label]) => (
            <a
              key={key}
              href={`#report-${key}`}
              className="hover:text-teal-800"
            >
              {label}
            </a>
          ))}
        </nav>
        <button
          type="submit"
          className="btn-primary"
          disabled={!dirty && revision > 0}
        >
          변경사항 저장
        </button>
      </div>
      <input type="hidden" name="offering" value={offering} />
      <input type="hidden" name="revision" value={revision} />
      <input type="hidden" name="payload" value={JSON.stringify(report)} />
      <p
        className={dirty ? "notice border border-amber-300" : "notice"}
        role="status"
      >
        {dirty
          ? "저장하지 않은 변경사항이 있습니다. 출력 전에 아래 저장 버튼을 눌러 주세요."
          : revision
            ? "저장된 보고서입니다. 수정 후 저장하면 출력에 반영됩니다."
            : "아직 저장하지 않은 초안입니다. 내용을 확인하고 저장해 주세요."}
      </p>
      <details id="report-basic" className="panel scroll-mt-64" open>
        <summary className="cursor-pointer text-lg font-bold">
          1. 기본정보·운영 결과
        </summary>
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {field("operator", "운영 담당자")}
            {field("professor", "담당 교수")}
            {field("program", "프로그램명·영역")}
            {field("reportDate", "보고일")}
          </div>
          {field("content", "주요 내용", true)}
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["certificates", "자격증 취득 인원", 10000],
                ["employed", "취업·창업 인원", 10000],
                ["surveyResponses", "만족도 응답 인원", 10000],
                ["satisfaction", "만족도 (%)", 100],
              ] as const
            ).map(([k, label, max]) => (
              <label className="field" key={k}>
                {label}
                <input
                  type="number"
                  min={0}
                  max={max}
                  step={k === "satisfaction" ? 0.1 : 1}
                  placeholder="미집계"
                  value={report[k] ?? ""}
                  onChange={(e) =>
                    set(
                      k,
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
              </label>
            ))}
          </div>
          <p className="text-sm text-slate-600">
            {initial.sourceReport
              ? "보관 과정의 인원·총시수는 원본 집계를 사용합니다. 개인별 출결과 수료 승인은 별도 기록입니다."
              : "정원·등록인원·수료인원·출석률은 학사 기록에서 가져옵니다. 미집계 수치는 빈칸으로 두세요."}
          </p>
        </div>
      </details>
      <details id="report-budget" className="panel scroll-mt-64">
        <summary className="cursor-pointer text-lg font-bold">
          2. 예산 집행
        </summary>
        <div className="mt-5">
          <Rows
            title="예산 항목"
            rows={report.budgets}
            members={members}
            limit={100}
            columns={[
              { key: "category", label: "구분" },
              {
                key: "planned",
                label: "신청예산 (원)",
                type: "number",
                max: 1e9,
              },
              {
                key: "spent",
                label: "집행예산 (원)",
                type: "number",
                max: 1e9,
              },
              { key: "note", label: "비고" },
            ]}
            add={{ category: "", planned: 0, spent: 0, note: "" }}
            change={(rows) => set("budgets", rows)}
          />
          <p className="mt-4 font-semibold">
            신청{" "}
            {money(report.budgets.reduce((n, r) => n + Number(r.planned), 0))}원
            · 집행{" "}
            {money(report.budgets.reduce((n, r) => n + Number(r.spent), 0))}원
          </p>
        </div>
      </details>
      <details id="report-review" className="panel scroll-mt-64">
        <summary className="cursor-pointer text-lg font-bold">
          3. 품질 개선·총평
        </summary>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {field("method", "교육방법", true)}
          {field("education", "교육내용", true)}
          {field("promotion", "교육생 모집·홍보", true)}
          {field("other", "기타 운영사항", true)}
          {field("strengths", "우수한 점", true)}
          {field("improvements", "개선할 점", true)}
          {field("followUp", "환류 계획", true)}
        </div>
      </details>
      <details id="report-participants" className="panel scroll-mt-64">
        <summary className="cursor-pointer text-lg font-bold">
          4. 수료자 인적사항 보완
        </summary>
        <div className="mt-5">
          <p className="mb-4 text-sm text-slate-600">
            수료 여부는 승인 기록으로 결정됩니다. 명단에 필요한 생년월일과
            비고를 보완하세요.
          </p>
          <Rows
            title="학습자 정보"
            rows={report.participants}
            members={members}
            limit={1000}
            columns={[
              { key: "personId", label: "학습자", type: "person" },
              { key: "birthDate", label: "생년월일", type: "date" },
              { key: "note", label: "비고" },
            ]}
            add={{ personId: "", birthDate: "", note: "" }}
            change={(rows) => set("participants", rows)}
          />
        </div>
      </details>
      <details id="report-scholarships" className="panel scroll-mt-64">
        <summary className="cursor-pointer text-lg font-bold">
          5. 장학금 지급내역
        </summary>
        <div className="mt-5">
          <Rows
            title="장학금"
            rows={report.scholarships}
            members={members}
            limit={1000}
            columns={[
              { key: "personId", label: "학습자", type: "person" },
              { key: "category", label: "장학유형" },
              {
                key: "rate",
                label: "지급률 (%)",
                type: "number",
                max: 100,
                step: 0.1,
              },
              {
                key: "amount",
                label: "확정 지급액 (원)",
                type: "number",
                max: 1e9,
              },
              ...bankColumns,
            ]}
            add={{ personId: "", category: "", rate: 0, amount: 0, ...bank }}
            change={(rows) => set("scholarships", rows)}
          />
          <p className="mt-4 font-semibold">
            장학금 합계{" "}
            {money(
              report.scholarships.reduce((n, r) => n + Number(r.amount), 0),
            )}
            원
          </p>
        </div>
      </details>
      <details id="report-fees" className="panel scroll-mt-64">
        <summary className="cursor-pointer text-lg font-bold">
          6. 강사료 지급내역 · 운영진 입력
        </summary>
        <div className="mt-5">
          <p className="mb-4 text-sm text-slate-600">
            같은 강사도 단가가 다르면 행을 나눠 입력하세요. 금액은 시수 × 단가로
            계산합니다. 지급일을 입력해 지급 여부를 구분하세요.
          </p>
          <Rows
            title="강사료"
            rows={report.fees}
            members={members}
            limit={200}
            columns={[
              { key: "name", label: "강사명" },
              { key: "kind", label: "강사구분", type: "kind" },
              { key: "birthDate", label: "생년월일", type: "date" },
              { key: "dates", label: "강의일자 (예: 8/5, 8/7)" },
              {
                key: "hours",
                label: "강의시수 (시간)",
                type: "number",
                max: 1000,
                step: 0.01,
              },
              {
                key: "rate",
                label: "시간당 단가 (원)",
                type: "number",
                max: 1e7,
              },
              ...bankColumns,
            ]}
            add={{
              name: "",
              kind: "외부강사",
              birthDate: "",
              dates: "",
              hours: 0,
              rate: 0,
              ...bank,
            }}
            change={(rows) => set("fees", rows)}
          />
          <p className="mt-4 font-semibold">
            강사료 합계{" "}
            {money(report.fees.reduce((n, r) => n + feeAmount(r), 0))}원
          </p>
          <p className="mt-2 text-sm text-slate-500">
            지급내역을 기록하는 기능입니다. 은행 이체는 별도로 처리하세요.
          </p>
        </div>
      </details>
    </ActionForm>
  );
}
