import { createPdf17, downloadPdf17 } from "./browser";

const MAX_SOURCE_BYTES = 30 * 1024 * 1024;

export async function downloadPdf17Copy(sourceUrl: string, filename: string, signal: AbortSignal, progress: (page: number, total: number) => void) {
  const response = await fetch(sourceUrl, { credentials: "same-origin", cache: "no-store", signal });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) {
    throw new Error("PDF 원본을 불러오지 못했습니다. 로그인 상태를 확인하거나 다운로드 링크를 다시 조회해 주세요.");
  }
  if (Number(response.headers.get("content-length")) > MAX_SOURCE_BYTES) throw new Error("변환할 원본은 30MB 이하여야 합니다.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("PDF 원본을 읽지 못했습니다.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_SOURCE_BYTES) { await reader.cancel(); throw new Error("변환할 원본은 30MB 이하여야 합니다."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  // Render the visible content into a new PDF. This also handles PDF 2.0 without
  // pretending that changing its header makes 2.0 features compatible with 1.7.
  const assets = new URL(`/api/pdf-assets/${pdfjs.version}/`, window.location.origin).href;
  const loading = pdfjs.getDocument({
    data: bytes, cMapUrl: `${assets}cmaps/`, cMapPacked: true,
    standardFontDataUrl: `${assets}standard_fonts/`, wasmUrl: `${assets}wasm/`,
    stopAtErrors: true,
  });
  try {
    const source = await loading.promise;
    const output = await createPdf17({ unit: "pt", format: "a4" });
    if (!source.numPages) throw new Error("변환할 페이지가 없습니다.");
    for (let index = 1; index <= source.numPages; index++) {
      signal.throwIfAborted();
      progress(index, source.numPages);
      const page = await source.getPage(index);
      const original = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2, 4096 / Math.max(original.width, original.height)) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("PDF 페이지를 변환하지 못했습니다.");
      try {
        await page.render({ canvas, canvasContext: context, viewport, background: "rgb(255,255,255)" }).promise;
        output.addPage([original.width, original.height], original.width > original.height ? "landscape" : "portrait");
        output.addImage(canvas.toDataURL("image/jpeg", 0.97), "JPEG", 0, 0, original.width, original.height);
      } finally { canvas.width = canvas.height = 0; page.cleanup(); }
    }
    output.deletePage(1);
    signal.throwIfAborted();
    await downloadPdf17(output.output("arraybuffer"), `${filename.replace(/\.pdf$/i, "")}-PDF1.7-변환본.pdf`);
  } catch (error) {
    if (error instanceof Error && error.name === "PasswordException") throw new Error("암호로 잠긴 PDF는 변환할 수 없습니다. 잠금이 해제된 원본을 사용해 주세요.");
    throw error;
  } finally { await loading.destroy(); }
}
