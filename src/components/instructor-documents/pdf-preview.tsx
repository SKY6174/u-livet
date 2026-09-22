"use client";
import { useEffect, useRef, useState } from "react";
export function PdfPreview({ bytes }: { bytes: Uint8Array | null }) {
  const host = useRef<HTMLDivElement>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!bytes) {
      host.current?.replaceChildren();
      return;
    }
    let cancelled = false;
    let destroy: (() => void) | undefined;
    setError("");
    void (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const base = new URL(
        `/api/pdf-assets/${pdfjs.version}/`,
        window.location.origin,
      ).href;
      const task = pdfjs.getDocument({
        data: bytes.slice(),
        cMapUrl: `${base}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${base}standard_fonts/`,
        wasmUrl: `${base}wasm/`,
      });
      destroy = () => {
        void task.destroy();
      };
      if (cancelled) {
        destroy();
        return;
      }
      const pdf = await task.promise,
        page = await pdf.getPage(1),
        viewport = page.getViewport({ scale: 1.6 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      canvas.setAttribute("aria-label", "입력 내용이 반영된 PDF 미리보기");
      canvas.setAttribute("role", "img");
      await page.render({
        canvas,
        canvasContext: canvas.getContext("2d")!,
        viewport,
        background: "rgb(255,255,255)",
      }).promise;
      if (!cancelled) host.current?.replaceChildren(canvas);
    })().catch(() => {
      if (!cancelled)
        setError(
          "미리보기를 표시하지 못했습니다. PDF 다운로드로 확인해 주세요.",
        );
    });
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [bytes]);
  return (
    <div className="min-h-64 rounded-xl bg-slate-200 p-3 shadow-inner">
      <div ref={host} />
      {(!bytes || error) && (
        <p className="p-8 text-sm" role="status">
          {error || "PDF를 생성하고 있습니다…"}
        </p>
      )}
    </div>
  );
}
