"use client";
import { useCallback, useState, type FormEvent } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import {
  invoke,
  getCommitteeVoteErrorMessage,
} from "@/features/instructor-documents/services/committee-vote-service";
import { DocumentPortal, type DocumentSession } from "./document-portal";
export function GuestDocumentPortal({ code }: { code: string }) {
  const [name, setName] = useState(""),
    [pin, setPin] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [session, setSession] = useState<DocumentSession | null>(null);
  const logout = useCallback(() => {
    setSession(null);
    setPin("");
    setMessage(
      "서류 인증이 종료되었습니다. 다시 입장하려면 PIN을 입력해 주세요.",
    );
  }, []);
  async function enter(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      setSession(
        await invoke<DocumentSession>("invite-auth", {
          public_code: code,
          name,
          pin,
        }),
      );
      setPin("");
    } catch (error) {
      setMessage(getCommitteeVoteErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  if (session)
    return (
      <DocumentPortal
        personId={session.member.id!}
        orgId={session.member.org_id!}
        name={session.member.name}
        returnTo="/"
        initialSession={session}
        onGuestLogout={logout}
      />
    );
  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <section className="rounded-3xl border border-blue-100 bg-white p-7 shadow-sm">
        <div className="mb-5 inline-flex rounded-2xl bg-blue-50 p-4 text-blue-600">
          <LockKeyhole size={28} />
        </div>
        <p className="text-xs font-bold tracking-widest text-blue-600">
          INSTRUCTOR DOCUMENTS
        </p>
        <h1 className="mt-2 text-2xl font-bold">강사 서류 제출</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          사업단에서 안내받은 성명과 6자리 PIN으로 입장하세요. 신분증·통장사본과
          이력서를 제출할 수 있습니다.
        </p>
        <form className="mt-7 space-y-5" onSubmit={enter}>
          <label className="field">
            강사 성명
            <input
              required
              maxLength={100}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="field">
            보안 PIN
            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              disabled={busy}
              placeholder="6자리 숫자"
            />
          </label>
          {message && (
            <p role="alert" className="text-sm text-red-700">
              {message}
            </p>
          )}
          <button
            disabled={busy || !name.trim() || pin.length !== 6}
            className="btn-primary w-full"
          >
            {busy ? "확인 중…" : "서류 입력 시작"}
          </button>
        </form>
        <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-slate-500">
          <ShieldCheck size={16} className="shrink-0" />
          인증은 30분간 유지됩니다. 링크가 만료되었거나 PIN을 분실한 경우
          사업단에 재발급을 요청하세요.
        </p>
      </section>
    </div>
  );
}
