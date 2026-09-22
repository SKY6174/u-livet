"use client";
import Link from "next/link";
import { useState } from "react";
export function PrintToolbar({
  offering,
  document,
  reveal,
  preview = false,
}: {
  offering?: string;
  document: string;
  reveal: boolean;
  preview?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function print() {
    setBusy(true);
    setError("");
    try {
      await window.document.fonts.ready;
      await Promise.all(
        Array.from(window.document.images).map((img) => img.decode()),
      );
      window.print();
    } catch {
      setError("사진을 불러오지 못했습니다. 새로고침 후 다시 출력해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    setError("");
    try {
      const { downloadReportPdf17 } = await import("@/lib/pdf/report-export");
      await downloadReportPdf17(`U-LIFE-${preview ? "검토용-" : ""}보고서-${document}.pdf`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PDF를 만들지 못했습니다. 다시 시도해 주세요.");
    } finally { setBusy(false); }
  }
  return (
    <nav className="no-print mx-auto flex max-w-7xl flex-wrap items-center gap-4 p-5">
      <Link
        className="btn-secondary"
        href={preview ? "/admin" : `/admin/offerings/${offering}/reports`}
      >
        {preview ? "← 과정 운영 관리" : "← 과정 보고서 관리"}
      </Link>
      <button className="btn-primary" onClick={download} disabled={busy}>
        {busy ? "출력 준비 중…" : "PDF 1.7 다운로드"}
      </button>
      <button className="btn-secondary" onClick={print} disabled={busy}>인쇄</button>
      {!preview && <Link
        className="btn-secondary"
        href={`?document=${document}&reveal=${reveal ? "0" : "1"}`}
      >
        {reveal ? "계좌번호 가리기" : "계좌번호 포함하여 출력"}
      </Link>}
      <p className="text-sm text-slate-600">
        인쇄 설정에서 머리글·바닥글을 끄고 배율 100%를 선택하세요.{" "}
        {preview ? "검토용 예시이며 제출용으로 사용할 수 없습니다." : reveal ? "계좌번호가 표시됩니다." : "계좌번호는 가려져 있습니다."}
      </p>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </nav>
  );
}
