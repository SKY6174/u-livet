"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, FileDown, ShieldCheck } from "lucide-react";
import { Pdf17CopyButton } from "@/components/pdf/pdf-17-copy-button";
import {
  invoke,
  getCommitteeVoteErrorMessage,
} from "@/features/instructor-documents/services/committee-vote-service";
import "@/features/instructor-documents/documents.css";
const Submission = dynamic(
  () =>
    import(
      "@/features/instructor-documents/components/advisory/advisory-external-submission"
    ).then((m) => m.AdvisoryExternalSubmission),
  {
    ssr: false,
    loading: () => (
      <p className="p-8" role="status">
        서류 입력 화면을 준비하고 있습니다…
      </p>
    ),
  },
);
export type DocumentSession = {
  token: string;
  expires_at: string;
  member: { id?: string; org_id?: string; name: string };
};
type Download = {
  document_type: string;
  original_name: string;
  signed_url: string;
};
export function DocumentPortal({
  personId,
  orgId,
  name,
  returnTo,
  initialDocument = "IDENTITY_BANK",
  initialSession,
  onGuestLogout,
}: {
  personId: string;
  orgId: string;
  name: string;
  returnTo: string;
  initialDocument?: "IDENTITY_BANK" | "RESUME";
  initialSession?: DocumentSession;
  onGuestLogout?: () => void;
}) {
  const [session, setSession] = useState<DocumentSession | null>(
      initialSession ?? null,
    ),
    [busy, setBusy] = useState(!initialSession),
    [message, setMessage] = useState(""),
    [downloads, setDownloads] = useState<Download[]>([]),
    [downloadBusy, setDownloadBusy] = useState(false);
  const automatic = useRef<Promise<DocumentSession> | null>(null);
  const start = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      setSession(
        await invoke<DocumentSession>("session", {
          person_id: personId,
          org_id: orgId,
        }),
      );
    } catch (error) {
      setMessage(getCommitteeVoteErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }, [personId, orgId]);
  useEffect(() => {
    if (initialSession) return;
    let cancelled = false;
    // Reuse the promise during Strict Mode effect replay; never auto-unlock after logout/expiry.
    automatic.current ??= invoke<DocumentSession>("session", {
      person_id: personId,
      org_id: orgId,
    });
    automatic.current
      .then((value) => {
        if (!cancelled) setSession(value);
      })
      .catch((error) => {
        if (!cancelled) setMessage(getCommitteeVoteErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [personId, orgId, initialSession]);
  const lock = useCallback(async () => {
    const token = session?.token;
    setSession(null);
    setDownloads([]);
    setMessage("서류 인증을 해제했습니다.");
    if (token) {
      try {
        await invoke("logout", { voter_token: token });
      } catch {
        setMessage("서류 화면을 잠갔습니다. 세션은 최대 30분 후 만료됩니다.");
      }
    }
    onGuestLogout?.();
  }, [session, onGuestLogout]);
  useEffect(() => {
    if (!session) return;
    const expire = () => {
      if (Date.now() < Date.parse(session.expires_at)) return;
      setSession(null);
      setDownloads([]);
      setMessage("30분 인증이 만료되었습니다. 다시 인증해 주세요.");
      onGuestLogout?.();
    };
    const timeout = window.setTimeout(
      expire,
      Math.max(0, Date.parse(session.expires_at) - Date.now()),
    );
    window.addEventListener("focus", expire);
    document.addEventListener("visibilitychange", expire);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("focus", expire);
      document.removeEventListener("visibilitychange", expire);
    };
  }, [session, onGuestLogout]);
  useEffect(() => {
    if (!downloads.length) return;
    const timer = window.setTimeout(() => setDownloads([]), 290000);
    return () => window.clearTimeout(timer);
  }, [downloads]);
  const loadDownloads = async () => {
    if (!session) return;
    setDownloadBusy(true);
    setMessage("");
    try {
      const files = await invoke<Download[]>("downloads", {
        voter_token: session.token,
      });
      setDownloads(files);
      if (!files.length)
        setMessage("보관된 PDF가 없습니다. 입력 화면에서 PDF를 저장해 주세요.");
    } catch (error) {
      setMessage(getCommitteeVoteErrorMessage(error));
    } finally {
      setDownloadBusy(false);
    }
  };
  return (
    <div className="instructor-document-portal">
      <header className="border-b border-slate-200 bg-white px-5 py-5 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-teal-700">
              <ShieldCheck size={18} />
              {initialSession ? "PIN 인증" : "로그인 연동"} · 비공개 서류함
            </p>
            <h1 className="mt-2 text-2xl font-bold">{name} 강사 서류 입력</h1>
            <p className="mt-2 text-sm text-slate-600">
              신분증·통장사본과 이력서를 표준 A4 PDF로 보관합니다. 변경이 있을
              때만 갱신하세요.
            </p>
          </div>
          {!initialSession && (
            <button
              className="btn-secondary"
              onClick={() => {
                window.close();
                window.setTimeout(() => window.location.assign(returnTo), 100);
              }}
            >
              <ArrowLeft size={18} />
              대장으로 돌아가기
            </button>
          )}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          AI 분석을 선택하면 첨부 자료가 문서 판독 서비스로 전송됩니다. 분석
          결과를 확인한 뒤 저장하세요.
        </p>
        {message && (
          <p className="notice mt-4" role="status">
            {message}
          </p>
        )}
        {session && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              className="btn-secondary !py-2 text-sm"
              disabled={downloadBusy}
              onClick={() => void loadDownloads()}
            >
              <FileDown size={16} />
              {downloadBusy ? "조회 중…" : "보관 PDF 확인"}
            </button>
            {downloads.map((file) => (
              <div
                key={file.document_type}
                className="flex flex-wrap items-start gap-3"
              >
                <a
                  className="text-sm font-semibold text-teal-800 underline"
                  href={file.signed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {file.document_type === "RESUME_PDF"
                    ? "이력서 PDF 원본"
                    : "신분증·통장사본 PDF 원본"}
                </a>
                <Pdf17CopyButton
                  sourceUrl={file.signed_url}
                  filename={file.original_name}
                />
              </div>
            ))}
            {downloads.length > 0 && (
              <p className="w-full text-xs text-slate-500">
                PDF 1.7 변환본은 페이지 이미지 사본입니다. 텍스트 검색은 원본을
                이용하세요.
              </p>
            )}
          </div>
        )}
      </header>
      {session ? (
        <Submission
          key={session.token}
          voterToken={session.token}
          documentOnly
          initialDocument={initialDocument}
          onLogout={() => void lock()}
        />
      ) : (
        <section className="mx-auto max-w-3xl px-5 py-12">
          <div className="panel">
            <p role="status" className="text-slate-600">
              {busy
                ? "로그인 권한을 확인하고 입력 화면을 여는 중입니다…"
                : message || "서류 인증을 다시 진행해 주세요."}
            </p>
            {!busy && !initialSession && (
              <button className="btn-primary mt-5" onClick={() => void start()}>
                다시 열기
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
