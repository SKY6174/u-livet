"use client";
import { useState } from "react";
export function PrintButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setBusy(true); setError("");
    try {
      const { downloadReportPdf17 } = await import("@/lib/pdf/report-export");
      await downloadReportPdf17("U-LiVE-출석부.pdf");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PDF를 만들지 못했습니다. 다시 시도해 주세요.");
    } finally { setBusy(false); }
  }
  return <>
    <button className="btn-primary" disabled={busy} onClick={download}>{busy ? "PDF 생성 중…" : "PDF 1.7 다운로드"}</button>
    <button className="btn-secondary" disabled={busy} onClick={() => window.print()}>인쇄</button>
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </>;
}
