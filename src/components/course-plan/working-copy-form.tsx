"use client";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useState } from "react";
import { createOffering } from "@/app/actions";
import { saveOpeningWorkingCopy } from "@/app/opening-working-copy-actions";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";
import type { OpeningWorkingCopy } from "@/lib/course-opening/working-copy";

export function WorkingCopyForm({ source, copy, children }: { source: string; copy?: OpeningWorkingCopy | null; children: React.ReactNode }) {
  const [saved, save, saving] = useActionState(saveOpeningWorkingCopy, { message: "" });
  const [created, create, creating] = useActionState(createOffering, { message: "" });
  const [intent, setIntent] = useState("save");
  const [revision, setRevision] = useState(copy?.revision ?? 0);
  const [updatedAt, setUpdatedAt] = useState(copy?.updated_at);
  useEffect(() => { if (saved.ok) { setRevision(saved.revision!); setUpdatedAt(saved.updatedAt); } }, [saved]);
  const pending = saving || creating, state = intent === "save" ? saved : created;
  const href = `/admin/courses?plan=${source}#offering-draft`;
  return <form className="space-y-4" onSubmit={event => {
    event.preventDefault(); if (pending || created.ok) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const savingCopy = submitter?.value === "save";
    if (!savingCopy && !event.currentTarget.reportValidity()) return;
    const form = new FormData(event.currentTarget); setIntent(savingCopy ? "save" : "create");
    startTransition(() => savingCopy ? save(form) : create(form));
  }}>
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed">
      <p className="font-semibold">내 개설 준비 임시저장</p>
      <p className="mt-2">미정 항목을 비워두고 본인 계정에 보관할 수 있습니다. 실제 기수 등록·모집 공개와 별도입니다.</p>
      <p className="mt-2 text-slate-600">{updatedAt ? `최근 임시저장: ${new Date(updatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}` : "아직 임시저장하지 않았습니다."}</p>
      <a href={href} className="mt-2 inline-block font-semibold text-teal-800 underline">저장본 다시 불러오기</a>
      <p className="mt-1 text-xs text-slate-500">다시 불러오면 현재 화면에서 저장하지 않은 변경은 사라집니다.</p>
    </div>
    <input type="hidden" name="source" value={source} /><input type="hidden" name="revision" value={revision} />
    <fieldset disabled={pending || created.ok} className="min-w-0 space-y-4">
      {children}
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="intent" value="save" formNoValidate className="btn-secondary">{saving ? "임시저장 중…" : "개설 준비 임시저장"}</button>
        <button type="submit" name="intent" value="create" className="btn-primary">{creating ? "등록 중…" : "실제 기수 초안 등록"}</button>
      </div>
    </fieldset>
    {state.message && <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-teal-800" : "text-red-700"}>{state.message}</p>}
    {state.message === MFA_REAUTH_MESSAGE && <a href={`/auth/security?next=${encodeURIComponent(`/admin/courses?plan=${source}`)}`} target="_blank" rel="noopener noreferrer" className="btn-secondary">추가 인증하기 (새 창)</a>}
    {created.ok && <p className="notice">실제 기수 초안을 등록했습니다. 임시저장본은 별도로 유지됩니다. 책임강사 계정 확인과 지정은 별도로 진행해 주세요. <Link href="/operation-documents/plan" className="font-semibold text-teal-800 underline">운영계획서 작성 →</Link> · <Link href="/operation-documents/result" className="font-semibold text-teal-800 underline">결과보고서 작성 →</Link></p>}
  </form>;
}
