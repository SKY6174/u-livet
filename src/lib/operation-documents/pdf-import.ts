import type { Content } from "./model";
import { MAX_OPERATION_PHOTOS } from "./schema";
import { extractPhotoMetadata } from "./pdf-photo-metadata";

type PdfImage = { width: number; height: number; data?: Uint8Array; bitmap?: ImageBitmap; kind?: number };

function imageData(image: PdfImage): string | null {
  if (image.width < 400 || image.height < 300 || image.width * image.height > 12_000_000) return null;
  const source = document.createElement("canvas");
  source.width = image.width;
  source.height = image.height;
  const sourceContext = source.getContext("2d");
  if (!sourceContext) return null;
  if (image.bitmap) sourceContext.drawImage(image.bitmap, 0, 0);
  else if (image.data) {
    const pixels = sourceContext.createImageData(image.width, image.height);
    const channels = image.data.length / (image.width * image.height);
    if (![1, 3, 4].includes(channels)) return null;
    for (let i = 0, j = 0; i < image.data.length; i += channels, j += 4) {
      pixels.data[j] = image.data[i];
      pixels.data[j + 1] = image.data[i + (channels === 1 ? 0 : 1)];
      pixels.data[j + 2] = image.data[i + (channels === 1 ? 0 : 2)];
      pixels.data[j + 3] = channels === 4 ? image.data[i + 3] : 255;
    }
    sourceContext.putImageData(pixels, 0, 0);
  } else return null;
  const target = document.createElement("canvas");
  const scale = Math.min(1, 680 / Math.max(image.width, image.height));
  target.width = Math.round(image.width * scale);
  target.height = Math.round(image.height * scale);
  const context = target.getContext("2d");
  if (!context) return null;
  context.fillStyle = "white";
  context.fillRect(0, 0, target.width, target.height);
  context.drawImage(source, 0, 0, target.width, target.height);
  source.width = source.height = 0;
  for (const quality of [0.7, 0.55, 0.4, 0.3]) {
    const result = target.toDataURL("image/jpeg", quality);
    if (result.length <= 78_000) { target.width = target.height = 0; return result; }
  }
  target.width = target.height = 0;
  return null;
}

export async function extractResultPdf(file: File): Promise<{ text: string; photos: Content["photos"]; pages: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const documentTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), stopAtErrors: true });
  const photos: Content["photos"] = [];
  const text: string[] = [];
  try {
    const pdf = await documentTask.promise;
    if (!pdf.numPages || pdf.numPages > 50) throw new Error("50쪽 이하의 결과보고서를 올려 주세요.");
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const words = (await page.getTextContent()).items
        .map((item) => "str" in item ? item.str : "")
        .join(" ");
      text.push(`[${number}쪽] ${words}`);
      if (photos.length >= MAX_OPERATION_PHOTOS) continue;
      const operations = await page.getOperatorList();
      const seen = new Set<string>();
      const metadata = extractPhotoMetadata(words);
      let pagePhotoIndex = 0;
      for (let index = 0; index < operations.fnArray.length && photos.length < MAX_OPERATION_PHOTOS; index++) {
        if (operations.fnArray[index] !== pdfjs.OPS.paintImageXObject) continue;
        const id = operations.argsArray[index][0];
        if (typeof id !== "string" || seen.has(id)) continue;
        seen.add(id);
        const object = await new Promise<PdfImage>((resolve) => page.objs.get(id, resolve)) as PdfImage;
        const image = imageData(object);
        if (image) {
          const found = metadata[pagePhotoIndex++];
          photos.push({
            caption: found?.caption ?? `운영사진${photos.length + 1}`,
            date: found?.date ?? "",
            image,
          });
        }
      }
      page.cleanup();
    }
    const raw = text.join("\n");
    return {
      text: raw.slice(0, 95_000), photos, pages: pdf.numPages,
    };
  } finally {
    await documentTask.destroy();
  }
}

export async function renderResultPdfPage(file: File, pageNumber: number): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), stopAtErrors: true });
  try {
    const pdf = await task.promise;
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pdf.numPages) throw new Error("PDF 쪽수를 확인해 주세요.");
    const page = await pdf.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(1.5, 820 / base.width) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PDF 페이지를 표시하지 못했습니다.");
    await page.render({ canvasContext: context, canvas, viewport }).promise;
    const image = canvas.toDataURL("image/jpeg", 0.78);
    canvas.width = canvas.height = 0;
    page.cleanup();
    return image;
  } finally {
    await task.destroy();
  }
}
