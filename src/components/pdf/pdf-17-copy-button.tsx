"use client";

import { useEffect, useRef, useState } from "react";

export function Pdf17CopyButton({ sourceUrl, filename }: { sourceUrl: string; filename: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function download() {
    if (controller.current) return;
    const current = new AbortController();
    controller.current = current;
    setBusy(true); setMessage("");
    try {
      const { downloadPdf17Copy } = await import("@/lib/pdf/convert");
      await downloadPdf17Copy(sourceUrl, filename, current.signal, (page, total) => setMessage(`${page}/${total}페이지 변환 중…`));
      setMessage("PDF 1.7 변환본을 다운로드했습니다. 원본은 그대로 보관됩니다.");
    } catch (error) {
      if (!current.signal.aborted) setMessage(error instanceof Error ? error.message : "PDF 변환에 실패했습니다. 원본을 확인해 주세요.");
    } finally { controller.current = null; setBusy(false); }
  }
  return <span className="inline-flex flex-col items-start gap-1">
    <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={download} title="원본은 보존하며 페이지 이미지로 구성된 PDF 1.7 사본을 만듭니다. 텍스트 검색·전자서명 검증은 원본을 이용하세요.">{busy ? "변환 중…" : "PDF 1.7 변환본"}</button>
    {message && <span role="status" className="max-w-md text-xs text-slate-600">{message}</span>}
  </span>;
}
