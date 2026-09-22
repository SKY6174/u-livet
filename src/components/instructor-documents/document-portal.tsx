"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FileDown, ShieldCheck } from "lucide-react";
import { invoke, getCommitteeVoteErrorMessage } from "@/features/instructor-documents/services/committee-vote-service";
import "@/features/instructor-documents/documents.css";

const Submission = dynamic(() => import("@/features/instructor-documents/components/advisory/advisory-external-submission").then(m => m.AdvisoryExternalSubmission), { ssr: false, loading: () => <p role="status">서류 입력 화면을 준비하고 있습니다…</p> });
type Session = { token: string; expires_at: string; member: { name: string } };
type Download = { document_type: string; original_name: string; signed_url: string };

export function DocumentPortal({ personId, orgId, name, returnTo }: { personId: string; orgId: string; name: string; returnTo: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const start = async () => {
    setBusy(true); setMessage(""); setDownloads([]);
    try { setSession(await invoke<Session>("session", { person_id: personId, org_id: orgId })); }
    catch (error) { setMessage(getCommitteeVoteErrorMessage(error)); }
    finally { setBusy(false); }
  };
  const lock = useCallback(async () => {
    const token = session?.token;
    setSession(null); setDownloads([]); setMessage("서류 인증을 해제했습니다.");
    if (token) {
      try { await invoke("logout", { voter_token: token }); }
      catch { setMessage("화면은 잠겼습니다. 서버 인증 해제를 확인하지 못했으므로 계정 로그아웃도 진행해 주세요."); }
    }
  }, [session]);
  useEffect(() => {
    if (!session) return;
    const expire = () => {
      if (Date.now() < Date.parse(session.expires_at)) return;
      setSession(null); setDownloads([]); setMessage("30분 인증이 만료되었습니다. 다시 인증해 주세요.");
    };
    const timeout = window.setTimeout(expire, Math.max(0, Date.parse(session.expires_at) - Date.now()));
    window.addEventListener("focus", expire);
    document.addEventListener("visibilitychange", expire);
    return () => { window.clearTimeout(timeout); window.removeEventListener("focus", expire); document.removeEventListener("visibilitychange", expire); };
  }, [session]);
  useEffect(() => {
    if (!downloads.length) return;
    const timer = window.setTimeout(() => setDownloads([]), 290_000);
    return () => window.clearTimeout(timer);
  }, [downloads]);
  const loadDownloads = async () => {
    if (!session) return;
    setDownloadBusy(true); setMessage("");
    try {
      const files = await invoke<Download[]>("downloads", { voter_token: session.token });
      setDownloads(files);
      if (!files.length) setMessage("보관된 PDF가 없습니다. 서류 입력 화면에서 PDF를 저장해 주세요.");
    } catch (error) { setMessage(getCommitteeVoteErrorMessage(error)); }
    finally { setDownloadBusy(false); }
  };
  return <div className="instructor-document-portal">
    <header className="page-shell pb-4">
      <Link href={returnTo} className="text-sm text-teal-800">← 돌아가기</Link>
      <p className="mt-5 flex items-center gap-2 font-semibold text-teal-700"><ShieldCheck size={20} /> 로그인 연동 · 비공개 서류함</p>
      <h1 className="mt-2 text-2xl font-bold">{name} 강사 서류 제출</h1>
      <p className="mt-2 text-slate-600">신분증·통장사본과 이력서를 입력하고 표준 A4 PDF로 보관합니다. 최초 제출 후 변경이 있을 때만 갱신하세요.</p>
      {message && <p className="notice mt-4" role="status">{message}</p>}
      {session && <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn-secondary" disabled={downloadBusy} onClick={() => void loadDownloads()}><FileDown size={18} /> {downloadBusy ? "조회 중…" : "보관 PDF 확인"}</button>
        {downloads.map(file => <a key={file.document_type} className="text-sm font-semibold text-teal-800 underline" href={file.signed_url} target="_blank" rel="noopener noreferrer">{file.document_type === "RESUME_PDF" ? "이력서 PDF" : "신분증·통장사본 PDF"}</a>)}
      </div>}
    </header>
    {session ? <Submission key={session.token} voterToken={session.token} documentOnly onLogout={() => void lock()} /> : <section className="page-shell pt-0">
      <div className="panel">
        <h2 className="section-title">보안 서류 입력 시작</h2>
        <p className="mb-5 text-slate-600">현재 로그인 계정의 권한으로 30분간 서류함을 엽니다. 이력서와 판독된 개인정보는 암호화해 저장하며, 파일은 비공개로 보관합니다.</p>
        <p className="mb-5 text-sm text-slate-600">AI 분석을 선택하면 업로드한 자료가 문서 판독 서비스로 전송됩니다. 분석 결과를 확인한 뒤 저장해 주세요.</p>
        <button className="btn-primary" disabled={busy} onClick={() => void start()}>{busy ? "인증 중…" : "서류함 열기"}</button>
      </div>
    </section>}
  </div>;
}
