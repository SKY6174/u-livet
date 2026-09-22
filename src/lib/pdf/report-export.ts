import { createPdf17, downloadPdf17 } from "./browser";

type Block = { top: number; bottom: number };

export function getPdfPageSlices(height: number, pageHeight: number, blocks: Block[], findBreak?: (top: number, end: number) => number) {
  if (height <= 0 || pageHeight <= 0) throw new Error("출력할 페이지가 없습니다.");
  const slices: { top: number; height: number }[] = [];
  let top = 0;
  while (top < height) {
    let end = Math.min(top + pageHeight, height);
    if (end < height) {
      // Keep rows, text lines and captions together where they fit on a page.
      let previous: number;
      do {
        previous = end;
        for (const block of blocks) {
          if (block.top > top && block.top < end && block.bottom > end && block.bottom - block.top <= pageHeight) end = block.top;
        }
      } while (end !== previous);
      if (findBreak) end = Math.max(top + 1, Math.min(end, findBreak(top, end)));
    }
    slices.push({ top, height: end - top });
    top = end;
  }
  return slices;
}

function findCanvasWhitespace(canvas: HTMLCanvasElement, top: number, end: number): number {
  // Canvas font baselines can differ from DOM text bounds. Use actual blank
  // raster rows to avoid cutting glyphs at a paragraph's page boundary.
  const context = canvas.getContext("2d");
  if (!context) return end;
  const start = Math.max(top + 1, end - 80);
  const rows = end - start;
  if (rows < 2) return end;
  const { data } = context.getImageData(0, start, canvas.width, rows);
  let blankRows = 0;
  for (let y = rows - 1; y >= 0; y--) {
    let blank = true;
    for (let x = 0; x < canvas.width; x++) {
      const offset = (y * canvas.width + x) * 4;
      if (data[offset] < 250 || data[offset + 1] < 250 || data[offset + 2] < 250) {
        blank = false;
        break;
      }
    }
    blankRows = blank ? blankRows + 1 : 0;
    if (blankRows >= 2) return start + y + 1;
  }
  return end;
}

export async function downloadReportPdf17(filename: string): Promise<void> {
  const sheets = Array.from(document.querySelectorAll<HTMLElement>(".report-output .report-sheet"));
  if (!sheets.length) throw new Error("출력할 문서가 없습니다.");
  const [{ default: html2canvas }, pdf] = await Promise.all([
    import("html2canvas"), createPdf17({ format: "a4", unit: "mm" }),
  ]);
  await document.fonts.ready;
  let pageCount = 0;
  for (const sheet of sheets) {
    const landscape = sheet.classList.contains("report-landscape");
    const width = landscape ? 297 : 210;
    const height = landscape ? 210 : 297;
    const margin = landscape ? 10 : 12;
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-10000px;top:0;pointer-events:none;background:white;";
    host.className = "report-output";
    const paper = sheet.cloneNode(true) as HTMLElement;
    paper.style.cssText = `width:${width - margin * 2}mm;min-height:0;margin:0;padding:0 0 3mm;box-shadow:none;background:white;`;
    paper.querySelectorAll(".no-print").forEach(node => node.remove());
    host.appendChild(paper);
    document.body.appendChild(host);
    try {
      await Promise.all(Array.from(paper.querySelectorAll("img")).map(img => {
        img.loading = "eager";
        return img.decode();
      }));
      const bounds = paper.getBoundingClientRect();
      const blocks: Block[] = Array.from(paper.querySelectorAll("tr, h1, h2, h3, figure, .report-foot")).map(node => {
        const rect = node.getBoundingClientRect();
        return { top: Math.floor(rect.top - bounds.top), bottom: Math.ceil(rect.bottom - bounds.top) };
      });
      // Text ranges supply line boundaries even for a paragraph taller than A4.
      const walker = document.createTreeWalker(paper, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (!node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of Array.from(range.getClientRects())) blocks.push({ top: Math.floor(rect.top - bounds.top), bottom: Math.ceil(rect.bottom - bounds.top) });
      }
      const canvas = await html2canvas(paper, { scale: 2, backgroundColor: "#ffffff", logging: false, useCORS: true });
      if (!canvas.width || !canvas.height) throw new Error("문서 이미지를 만들지 못했습니다.");
      const scale = canvas.width / bounds.width;
      const capacity = Math.floor((height - margin * 2) * canvas.width / (width - margin * 2));
      const slices = getPdfPageSlices(canvas.height, capacity, blocks.map(b => ({ top: Math.floor(b.top * scale), bottom: Math.ceil(b.bottom * scale) })), (top, end) => findCanvasWhitespace(canvas, top, end));
      for (const slice of slices) {
        pdf.addPage("a4", landscape ? "landscape" : "portrait");
        pageCount++;
        const crop = document.createElement("canvas");
        crop.width = canvas.width;
        crop.height = slice.height;
        const context = crop.getContext("2d");
        if (!context) throw new Error("PDF 페이지를 만들지 못했습니다.");
        context.drawImage(canvas, 0, slice.top, canvas.width, slice.height, 0, 0, crop.width, crop.height);
        pdf.addImage(crop.toDataURL("image/jpeg", 0.95), "JPEG", margin, margin, width - margin * 2, slice.height * (width - margin * 2) / canvas.width);
        crop.width = crop.height = 0;
      }
      canvas.width = canvas.height = 0;
    } finally {
      host.remove();
    }
  }
  if (!pageCount) throw new Error("출력할 문서가 없습니다.");
  pdf.deletePage(1);
  await downloadPdf17(pdf.output("arraybuffer"), filename);
}
