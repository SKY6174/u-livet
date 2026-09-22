import type { jsPDF, jsPDFOptions } from "jspdf";
import { PDF_VERSION, requirePdf17 } from "./version";

export async function createPdf17(options: jsPDFOptions = {}): Promise<jsPDF> {
  const { jsPDF: Pdf } = await import("jspdf");
  const pdf = new Pdf({ compress: true, ...options });
  // jsPDF 4.2.1 exposes the writer version through this private API, not options.
  // Fail explicitly if a future library upgrade removes it.
  const writer = (pdf as unknown as { __private__: { setPdfVersion(version: string): void } }).__private__;
  if (typeof writer?.setPdfVersion !== "function") throw new Error("PDF 버전 설정을 지원하지 않습니다.");
  writer.setPdfVersion(PDF_VERSION);
  return pdf;
}

export async function toPdf17Blob(value: Blob | ArrayBuffer | Uint8Array): Promise<Blob> {
  const source = value instanceof Blob ? await value.arrayBuffer() : value;
  return new Blob([requirePdf17(source) as BlobPart], { type: "application/pdf" });
}

export async function toPdf17DataUri(value: Blob | ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = new Uint8Array(await (await toPdf17Blob(value)).arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(index, index + 0x8000)));
  }
  return `data:application/pdf;base64,${btoa(binary)}`;
}

export async function downloadPdf17(value: Blob | ArrayBuffer | Uint8Array, filename: string): Promise<void> {
  const url = URL.createObjectURL(await toPdf17Blob(value));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
