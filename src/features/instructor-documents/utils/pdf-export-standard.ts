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


export { toPdf17Blob, toPdf17DataUri, downloadPdf17 } from "@/lib/pdf/browser";
