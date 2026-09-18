"use client";
import { useState } from "react";
import { ActionForm } from "@/components/portal/action-form";
import { saveDossier } from "@/app/instructor-development-actions";
import {
  reviewLabels,
  type Claim,
  type DossierPayload,
  type ReviewVersion,
} from "@/lib/instructors/types";
const blank = (): Claim => ({
  kind: "CAREER",
  title: "",
  organization: "",
  started_on: "",
  ended_on: "",
  expires_on: "",
  evidence: "",
});
export function DossierEditor({
  version: v,
}: {
  version: ReviewVersion<DossierPayload>;
}) {
  const [claims, setClaims] = useState<Claim[]>(
    v.payload.claims.length ? v.payload.claims : [blank()],
  );
  const change = (i: number, k: keyof Claim, value: string) =>
    setClaims((items) =>
      items.map((x, n) => (n === i ? { ...x, [k]: value } : x)),
    );
  return (
    <ActionForm action={saveDossier} label="이력 초안 저장">
      <p role="status" className="text-sm text-teal-800">
        {v.revision > 0
          ? `저장된 초안 · 변경번호 ${v.revision}`
          : "입력 후 초안을 저장하세요."}
      </p>
      <input type="hidden" name="v" value={v.id} />
      <input type="hidden" name="revision" value={v.revision} />
      <input type="hidden" name="claims" value={JSON.stringify(claims)} />
      <label className="field">
        전문분야
        <input
          name="specialty"
          defaultValue={v.payload.specialty}
          maxLength={200}
        />
      </label>
      <label className="field">
        심사용 자기소개
        <textarea
          name="introduction"
          rows={4}
          defaultValue={v.payload.introduction}
          maxLength={2000}
        />
      </label>
      <label className="field">
        공개 소개 후보 (선택)
        <textarea
          name="public_intro"
          rows={3}
          defaultValue={v.payload.public_intro}
          maxLength={1000}
        />
      </label>
      <p className="notice">
        공개 소개는 승인 후 별도로 동의해야 표시됩니다. 아래 이력과 증빙 참조는
        심사용이며 공개되지 않습니다. 주민등록번호·계좌·자격증 전체번호를
        입력하지 마세요.
      </p>
      <div className="space-y-4">
        {claims.map((c, i) => (
          <fieldset key={i} className="rounded-xl border border-slate-200 p-4">
            <legend className="px-2 font-semibold">이력 {i + 1}</legend>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="field">
                구분
                <select
                  value={c.kind}
                  onChange={(e) => change(i, "kind", e.target.value)}
                >
                  {["EDUCATION", "CAREER", "TEACHING", "QUALIFICATION"].map(
                    (k) => (
                      <option key={k} value={k}>
                        {reviewLabels[k]}
                      </option>
                    ),
                  )}
                </select>
              </label>
              {(
                [
                  ["title", "학위·직무·자격 명칭", 200],
                  ["organization", "학교·기관·회사", 200],
                  ["evidence", "사업단 확인용 증빙 참조", 500],
                ] as const
              ).map(([k, l, n]) => (
                <label className="field" key={k}>
                  {l}
                  <input
                    value={c[k]}
                    maxLength={n}
                    onChange={(e) => change(i, k, e.target.value)}
                  />
                </label>
              ))}
              {(
                [
                  ["started_on", "시작·취득일"],
                  ["ended_on", "종료일 (선택)"],
                  ["expires_on", "자격 만료일 (해당 시)"],
                ] as const
              ).map(([k, l]) => (
                <label className="field" key={k}>
                  {l}
                  <input
                    type="date"
                    value={c[k]}
                    onChange={(e) => change(i, k, e.target.value)}
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              className="mt-3 text-sm text-red-700 underline"
              onClick={() => setClaims((x) => x.filter((_, n) => n !== i))}
            >
              이력 {i + 1} 삭제
            </button>
          </fieldset>
        ))}
      </div>
      <button
        type="button"
        className="btn-secondary"
        disabled={claims.length >= 20}
        onClick={() => setClaims((x) => [...x, blank()])}
      >
        이력 항목 추가
      </button>
      <p className="text-sm text-slate-500">
        최대 20개. 서류 원본은 기존 사업단 접수 경로로 제출하고 식별 가능한 문서
        참조만 남기세요. 이곳의 외부 경력은 사업단 경력증명서에 자동 포함되지
        않습니다.
      </p>
    </ActionForm>
  );
}
