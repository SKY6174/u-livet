"use client";

import { useId, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import { deleteLearnerDocument } from "./actions";

function ConfirmationButtons({ onCancel }: { onCancel: () => void }) {
  const { pending } = useFormStatus();
  return <div className="mt-6 flex justify-end gap-3">
    <button type="button" autoFocus onClick={onCancel} disabled={pending} className="btn-secondary">취소</button>
    <button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-rose-700 px-5 py-2 font-semibold text-white hover:bg-rose-800 disabled:opacity-50">
      {pending ? "삭제 중…" : "삭제 확인"}
    </button>
  </div>;
}

export function DeleteDocumentControl({ requestId, revision, courseName, kindLabel, rowLabel, filters }: {
  requestId: string;
  revision: number;
  courseName: string;
  kindLabel: string;
  rowLabel: string;
  filters: { kind: string; status: string; query: string };
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  return <>
    <button ref={trigger} type="button" onClick={() => dialog.current?.showModal()} aria-label={`${rowLabel} 삭제`}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">
      <Trash2 size={15} aria-hidden="true" />삭제
    </button>
    <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId} onClose={() => trigger.current?.focus()}
      className="w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-900/40">
      <h2 id={titleId} className="text-lg font-bold">접수 문서를 삭제하시겠습니까?</h2>
      <p className="mt-4 break-words font-semibold">{courseName} · {kindLabel}</p>
      <p id={descriptionId} className="mt-3 text-sm leading-6 text-slate-600">
        관리자와 수강생의 접수 문서 목록에서 제외됩니다. 원본과 처리 기록은 보관되며, 수강 등록과 학습 기록은 유지됩니다.
      </p>
      <form action={deleteLearnerDocument}>
        <input type="hidden" name="request_id" value={requestId} />
        <input type="hidden" name="revision" value={revision} />
        <input type="hidden" name="filter_kind" value={filters.kind} />
        <input type="hidden" name="filter_status" value={filters.status} />
        <input type="hidden" name="filter_query" value={filters.query} />
        <ConfirmationButtons onCancel={() => dialog.current?.close()} />
      </form>
    </dialog>
  </>;
}
