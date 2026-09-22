"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Pencil, Trash2, X, Copy, RefreshCw } from "lucide-react";
import {
  createDocumentInvite,
  removePoolPerson,
} from "@/app/instructor-pool-actions";
import type { PoolPerson } from "@/lib/instructors/pool";
export function PoolRowActions({
  org,
  person,
  editUrl,
}: {
  org: string;
  person: Pick<
    PoolPerson,
    "id" | "name" | "revision" | "document_access" | "status"
  >;
  editUrl: string;
}) {
  const router = useRouter(),
    dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"invite" | "remove" | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [invite, setInvite] = useState<{
    url: string;
    pin: string;
    expires_at: string;
  } | null>(null);
  useEffect(() => {
    if (mode) dialog.current?.showModal();
    else dialog.current?.close();
  }, [mode]);
  const issue = async () => {
    setBusy(true);
    setMessage("");
    try {
      const result = await createDocumentInvite(org, person.id);
      if (!result.invite) throw Error(result.error);
      setInvite({
        url: `${window.location.origin}/instructor-documents/${result.invite.public_code}`,
        pin: result.invite.pin,
        expires_at: result.invite.expires_at,
      });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "링크 발급에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  };
  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label}를 복사했습니다.`);
    } catch {
      setMessage(
        "자동 복사가 제한되어 있습니다. 입력란의 내용을 선택해 복사해 주세요.",
      );
    }
  };
  const remove = async () => {
    setBusy(true);
    setMessage("");
    try {
      const result = await removePoolPerson(org, person.id, person.revision);
      if (!result.ok) throw Error(result.message);
      setMode(null);
      setInvite(null);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "삭제하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
          disabled={!person.document_access || person.status !== "ACTIVE"}
          title="입력 링크·PIN"
          aria-label={`${person.name} 입력 링크·PIN`}
          onClick={() => {
            setMode("invite");
            setMessage("");
            if (!invite || Date.parse(invite.expires_at) < Date.now())
              void issue();
          }}
        >
          <Link2 size={18} />
        </button>
        <Link
          className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
          title="기본정보 수정"
          aria-label={`${person.name} 기본정보 수정`}
          href={editUrl}
        >
          <Pencil size={18} />
        </Link>
        <button
          type="button"
          className="rounded-lg p-2 text-red-500 hover:bg-red-50"
          title="대장에서 삭제"
          aria-label={`${person.name} 대장에서 삭제`}
          onClick={() => {
            setMode("remove");
            setMessage("");
          }}
        >
          <Trash2 size={18} />
        </button>
      </div>
      <dialog
        ref={dialog}
        onCancel={(event) => {
          event.preventDefault();
          if (!busy) setMode(null);
        }}
        className="w-[min(560px,calc(100%_-_32px))] rounded-2xl border border-slate-200 bg-white p-6 shadow-xl backdrop:bg-slate-950/35"
        aria-labelledby={`pool-action-${person.id}`}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id={`pool-action-${person.id}`} className="text-lg font-bold">
            {person.name} ·{" "}
            {mode === "invite" ? "입력 링크·PIN" : "대장에서 삭제"}
          </h2>
          <button
            className="rounded p-2 text-slate-500"
            disabled={busy}
            onClick={() => setMode(null)}
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>
        {mode === "invite" ? (
          <>
            <p className="my-4 text-sm leading-6 text-slate-600">
              강사에게 입력 링크와 PIN을 각각 전달하세요. 계정 로그인 없이 해당
              강사의 서류만 입력할 수 있습니다.
            </p>
            {busy && (
              <p role="status" className="my-5 text-sm">
                입력 링크와 PIN을 발급하는 중입니다…
              </p>
            )}
            {invite && !busy && (
              <div className="space-y-5">
                <div>
                  <label className="field">
                    입력 링크
                    <input
                      readOnly
                      value={invite.url}
                      onFocus={(e) => e.target.select()}
                    />
                  </label>
                  <button
                    className="mt-2 flex items-center gap-2 text-sm font-semibold text-blue-700"
                    onClick={() => void copy(invite.url, "입력 링크")}
                  >
                    <Copy size={15} />
                    입력 링크 복사
                  </button>
                </div>
                <div>
                  <label className="field">
                    보안 PIN
                    <input
                      readOnly
                      value={invite.pin}
                      className="font-mono !text-2xl tracking-[.35em]"
                      onFocus={(e) => e.target.select()}
                    />
                  </label>
                  <button
                    className="mt-2 flex items-center gap-2 text-sm font-semibold text-blue-700"
                    onClick={() => void copy(invite.pin, "PIN")}
                  >
                    <Copy size={15} />
                    PIN 복사
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  만료:{" "}
                  {new Date(invite.expires_at).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </p>
              </div>
            )}
            <p className="mt-5 text-xs leading-5 text-slate-500">
              재발급하면 이전 링크·PIN과 해당 링크의 인증 세션은 사용할 수
              없습니다.
            </p>
            <button
              className="btn-secondary mt-4 text-sm"
              disabled={busy}
              onClick={() => void issue()}
            >
              <RefreshCw size={15} />
              {invite ? "링크·PIN 재발급" : "다시 발급"}
            </button>
          </>
        ) : (
          <>
            <p className="my-5 text-sm leading-6 text-slate-600">
              <strong>{person.name}</strong> 강사를 대장에서 삭제합니다. 기존
              수당·서류·계정은 보존되며, 발급된 입력 링크는 즉시 해제됩니다.
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="btn-secondary"
                disabled={busy}
                onClick={() => setMode(null)}
              >
                취소
              </button>
              <button
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                disabled={busy}
                onClick={() => void remove()}
              >
                {busy ? "삭제 중…" : "대장에서 삭제"}
              </button>
            </div>
          </>
        )}
        {message && (
          <p role="status" className="mt-4 text-sm text-blue-800">
            {message}
          </p>
        )}
      </dialog>
    </>
  );
}
