"use client";
import { useState } from "react";
import { ActionForm } from "@/components/portal/action-form";
import { saveDevelopment } from "@/app/instructor-development-actions";
import type {
  DevelopmentPayload,
  PlanSession,
  ReviewVersion,
} from "@/lib/instructors/types";
const blank = (): PlanSession => ({
  title: "",
  content: "",
  equipment: "",
  assessment: "",
  minutes: 60,
  method: "THEORY",
});
export function DevelopmentEditor({
  version: v,
}: {
  version: ReviewVersion<DevelopmentPayload>;
}) {
  const [sessions, setSessions] = useState<PlanSession[]>(
    v.payload.sessions.length ? v.payload.sessions : [blank()],
  );
  const change = (i: number, k: keyof PlanSession, value: string | number) =>
    setSessions((items) =>
      items.map((x, n) => (n === i ? { ...x, [k]: value } : x)),
    );
  return (
    <ActionForm action={saveDevelopment} label="과정 제안 초안 저장">
      <p role="status" className="text-sm text-teal-800">
        {v.revision > 0
          ? `저장된 초안 · 변경번호 ${v.revision}`
          : "입력 후 초안을 저장하세요."}
      </p>
      <input type="hidden" name="v" value={v.id} />
      <input type="hidden" name="revision" value={v.revision} />
      <input type="hidden" name="sessions" value={JSON.stringify(sessions)} />
      <div className="grid gap-4 md:grid-cols-2">
        {(
          [
            ["title", "과정명", 200],
            ["academy", "아카데미·분야", 100],
          ] as const
        ).map(([k, l, n]) => (
          <label key={k} className="field">
            {l}
            <input name={k} defaultValue={v.payload[k]} maxLength={n} />
          </label>
        ))}
        {(
          [
            ["capacity", "적정 정원", 1, 1000],
            ["theory_minutes", "이론 총시간 (분)", 0, 60000],
            ["practice_minutes", "실습 총시간 (분)", 0, 60000],
          ] as const
        ).map(([k, l, min, max]) => (
          <label key={k} className="field">
            {l}
            <input
              type="number"
              name={k}
              min={min}
              max={max}
              step="1"
              defaultValue={v.payload[k]}
              required
            />
          </label>
        ))}
      </div>
      {(
        [
          ["summary", "과정 소개", 3000],
          ["rationale", "산업체·학습자 수요와 개발 근거", 2000],
          ["target", "교육 대상", 2000],
          ["outcomes", "목표 직무역량·학습성과", 2000],
          ["prerequisites", "선수조건 (없으면 없음)", 2000],
          ["assessment", "평가·수료 기준 제안", 2000],
          ["materials", "교재·준비물", 2000],
          ["budget", "예산·재료·장비 비용 근거", 2000],
        ] as const
      ).map(([k, l, n]) => (
        <label key={k} className="field">
          {l}
          <textarea
            name={k}
            rows={3}
            defaultValue={v.payload[k]}
            maxLength={n}
          />
        </label>
      ))}
      <p className="notice">
        평가안은 제안입니다. 실제 수료 판정은 별도로 승인한 수료기준을
        적용합니다. 개인 연락처·계좌 등 심의에 불필요한 개인정보는 넣지 마세요.
      </p>
      <h3 className="font-bold">차시별 강의계획</h3>
      <p className="text-sm">
        현재 합계: 이론{" "}
        {sessions
          .filter((s) => s.method === "THEORY")
          .reduce((n, s) => n + s.minutes, 0)}
        분 · 실습{" "}
        {sessions
          .filter((s) => s.method === "PRACTICE")
          .reduce((n, s) => n + s.minutes, 0)}
        분
      </p>
      {sessions.map((s, i) => (
        <fieldset key={i} className="rounded-xl border border-slate-200 p-4">
          <legend className="px-2 font-semibold">{i + 1}차시</legend>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="field">
              차시명
              <input
                value={s.title}
                maxLength={200}
                onChange={(e) => change(i, "title", e.target.value)}
              />
            </label>
            <label className="field">
              수업 구분
              <select
                value={s.method}
                onChange={(e) => change(i, "method", e.target.value)}
              >
                <option value="THEORY">이론</option>
                <option value="PRACTICE">실습</option>
              </select>
            </label>
            <label className="field">
              시간 (분)
              <input
                type="number"
                min={1}
                max={1440}
                value={s.minutes}
                onChange={(e) => change(i, "minutes", Number(e.target.value))}
              />
            </label>
          </div>
          {(
            [
              ["content", "학습 내용", 1000],
              ["equipment", "장비·소프트웨어", 500],
              ["assessment", "활동·평가", 500],
            ] as const
          ).map(([k, l, n]) => (
            <label key={k} className="field mt-3">
              {l}
              <textarea
                rows={2}
                value={s[k]}
                maxLength={n}
                onChange={(e) => change(i, k, e.target.value)}
              />
            </label>
          ))}
          <button
            type="button"
            className="mt-3 text-sm text-red-700 underline"
            onClick={() => setSessions((x) => x.filter((_, n) => n !== i))}
          >
            {i + 1}차시 삭제
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="btn-secondary"
        disabled={sessions.length >= 60}
        onClick={() => setSessions((x) => [...x, blank()])}
      >
        차시 추가
      </button>
      <p className="text-sm text-slate-500">
        최대 60차시. 제출 전 이론·실습 합계와 차시별 시간을 맞춰 주세요.
      </p>
    </ActionForm>
  );
}
