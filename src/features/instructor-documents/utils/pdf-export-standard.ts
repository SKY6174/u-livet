export const PDF_FONT_FAMILY = '"KoPub_Pro Dotum", "KoPubDotum_Pro", "KoPub Dotum", sans-serif';

export const PDF_STANDARD = {
  contentHeightMm: 297,
  contentWidthMm: 210,
  format: "a4" as const,
  marginMm: 0,
  orientation: "portrait" as const,
  pageHeightMm: 297,
  pageWidthMm: 210,
  unit: "mm" as const,
};

export interface PdfCanvasPlacement {
  height: number;
  width: number;
  x: number;
  y: number;
}

export function getPdfCanvasPlacement(width: number, height: number): PdfCanvasPlacement {
  const scale = Math.min(
    PDF_STANDARD.contentWidthMm / Math.max(width, 1),
    PDF_STANDARD.contentHeightMm / Math.max(height, 1),
  );
  const renderedWidth = width * scale;
  const renderedHeight = height * scale;
  return {
    height: renderedHeight,
    width: renderedWidth,
    x: PDF_STANDARD.marginMm + (PDF_STANDARD.contentWidthMm - renderedWidth) / 2,
    y: PDF_STANDARD.marginMm + (PDF_STANDARD.contentHeightMm - renderedHeight) / 2,
  };
}

export function createStandardHtml2PdfOptions(filename: string): Record<string, unknown> {
  return {
    filename,
    html2canvas: { backgroundColor: "#ffffff", logging: false, scale: 2, useCORS: true },
    image: { quality: 0.98, type: "jpeg" },
    jsPDF: {
      format: PDF_STANDARD.format,
      orientation: PDF_STANDARD.orientation,
      unit: PDF_STANDARD.unit,
    },
    margin: [
      PDF_STANDARD.marginMm,
      PDF_STANDARD.marginMm,
      PDF_STANDARD.marginMm,
      PDF_STANDARD.marginMm,
    ],
    pagebreak: { avoid: ["tr", ".pdf-keep-together"], mode: ["css", "legacy"] },
  };
}

export async function waitForPdfFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all([
    document.fonts.load('400 11pt "KoPub_Pro Dotum"'),
    document.fonts.load('700 11pt "KoPub_Pro Dotum"'),
  ]);
  await document.fonts.ready;
}

export function applyPdfStandardStyles(root: HTMLElement): () => void {
  const previousFontFamily = root.style.fontFamily;
  root.style.fontFamily = PDF_FONT_FAMILY;
  root.querySelectorAll<HTMLElement>("*").forEach((element) => {
    element.style.fontFamily = PDF_FONT_FAMILY;
  });
  root.querySelectorAll<HTMLElement>("thead").forEach((header) => {
    header.style.display = "table-header-group";
  });
  root.querySelectorAll<HTMLElement>("tfoot").forEach((footer) => {
    footer.style.display = "table-footer-group";
  });
  root.querySelectorAll<HTMLElement>("tr").forEach((row) => {
    row.style.breakInside = "avoid";
    row.style.pageBreakInside = "avoid";
  });
  return () => {
    root.style.fontFamily = previousFontFamily;
  };
}

function asBytes(value: ArrayBuffer | Uint8Array): Uint8Array {
  return value instanceof Uint8Array ? new Uint8Array(value) : new Uint8Array(value.slice(0));
}

export function normalizePdfVersion17(value: ArrayBuffer | Uint8Array): Uint8Array {
  const bytes = asBytes(value);
  const signature = String.fromCharCode(...Array.from(bytes.slice(0, 8)));
  if (!signature.startsWith("%PDF-")) throw new Error("유효한 PDF 데이터가 아닙니다.");
  bytes[5] = "1".charCodeAt(0);
  bytes[6] = ".".charCodeAt(0);
  bytes[7] = "7".charCodeAt(0);
  return bytes;
}

export async function toPdf17Blob(
  value: Blob | ArrayBuffer | Uint8Array,
): Promise<Blob> {
  const source = value instanceof Blob ? await value.arrayBuffer() : value;
  return new Blob([normalizePdfVersion17(source) as BlobPart], { type: "application/pdf" });
}

export async function toPdf17DataUri(value: Blob | ArrayBuffer | Uint8Array): Promise<string> {
  const blob = await toPdf17Blob(value);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(index, index + 0x8000)));
  }
  return `data:application/pdf;base64,${btoa(binary)}`;
}

export async function downloadPdf17(
  value: Blob | ArrayBuffer | Uint8Array,
  filename: string,
): Promise<void> {
  const blob = await toPdf17Blob(value);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
