"use client";
import { useState } from "react";
import { ActionForm } from "@/components/portal/action-form";
import { createQuiz } from "@/app/evaluation-actions";
export function QuizEditor({ offering }: { offering: string }) {
  const [count, setCount] = useState(1);
  return (
    <ActionForm action={createQuiz} label="시험 등록">
      <input type="hidden" name="offering" value={offering} />
      <input type="hidden" name="count" value={count} />
      <p className="notice">
        객관식 단일 선택 · 문항별 동일 배점 · 1회 응시. 등록 후 문항은
        고정되므로 공개 전 내용을 확인하세요. 점수는 응시기간 종료 후
        공개됩니다.
      </p>
      <label className="field">
        시험명
        <input name="title" maxLength={200} required />
      </label>
      <label className="field">
        응시 시작 (한국시간)
        <input type="datetime-local" name="opens_at" required />
      </label>
      <label className="field">
        응시 마감 (한국시간)
        <input type="datetime-local" name="closes_at" required />
      </label>
      <label className="field">
        제한시간 (분)
        <input type="number" name="duration" min={1} max={180} required />
      </label>
      {Array.from({ length: count }, (_, i) => (
        <fieldset key={i} className="space-y-3 rounded-xl border p-4">
          <legend className="px-2 font-semibold">문항 {i + 1}</legend>
          <label className="field">
            문제
            <textarea name={`q${i}`} rows={2} maxLength={2000} required />
          </label>
          {[0, 1, 2, 3].map((j) => (
            <label key={j} className="field">
              선택지 {j + 1}
              <input name={`q${i}o${j}`} maxLength={500} required />
            </label>
          ))}
          <label className="field">
            정답
            <select name={`q${i}answer`} defaultValue="" required>
              <option value="" disabled>
                정답 선택
              </option>
              {[0, 1, 2, 3].map((j) => (
                <option key={j} value={j}>
                  {j + 1}번
                </option>
              ))}
            </select>
          </label>
        </fieldset>
      ))}
      <div className="flex gap-3">
        <button
          type="button"
          className="btn-secondary"
          disabled={count >= 20}
          onClick={() => setCount(count + 1)}
        >
          문항 추가
        </button>
        {count > 1 && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setCount(count - 1)}
          >
            마지막 문항 삭제
          </button>
        )}
      </div>
    </ActionForm>
  );
}
