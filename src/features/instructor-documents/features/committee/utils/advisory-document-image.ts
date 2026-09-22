import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
const pdfWorkerUrl = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
import type { AdvisoryDocumentType } from "../../../types/advisory-intake";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MAX_DOCUMENT_OUTPUT_BYTES = 1024 * 1024;
const MAX_SIGNATURE_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_INPUT_BYTES = 30 * 1024 * 1024;

export interface AdvisoryDocumentLayout {
  readable: boolean;
  confidence: number;
  rotation_degrees?: 0 | 90 | 180 | 270;
  top_left_x: number;
  top_left_y: number;
  top_right_x: number;
  top_right_y: number;
  bottom_right_x: number;
  bottom_right_y: number;
  bottom_left_x: number;
  bottom_left_y: number;
}

export interface AdvisoryDocumentRemakePage {
  pageNumber: number;
  sourceFile: File;
  analysisDataUrl: string;
}

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error("IMAGE_COMPRESSION_FAILED")),
    "image/jpeg",
    quality
  ));

const canvasToPngBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error("IMAGE_COMPRESSION_FAILED")),
    "image/png"
  ));

const renderPdfPage = async (pdfDocument: PDFDocumentProxy, pageNumber: number): Promise<HTMLCanvasElement> => {
  const page = await pdfDocument.getPage(pageNumber);
  const initialViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(3, 2400 / Math.max(initialViewport.width, initialViewport.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("CANVAS_UNAVAILABLE");
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return canvas;
};

const renderPdfFirstPage = async (file: File): Promise<HTMLCanvasElement> => {
  const loadingTask = pdfjsLib.getDocument({ data: await file.arrayBuffer() });
  const pdfDocument = await loadingTask.promise;
  try {
    return await renderPdfPage(pdfDocument, 1);
  } finally {
    await loadingTask.destroy();
  }
};

const renderImage = async (file: File): Promise<HTMLCanvasElement> => {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("CANVAS_UNAVAILABLE");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
};

const clampCoordinate = (value: number): number => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

const rotateCanvas = (
  source: HTMLCanvasElement,
  degrees: AdvisoryDocumentLayout["rotation_degrees"]
): HTMLCanvasElement => {
  const rotation = degrees === 90 || degrees === 180 || degrees === 270 ? degrees : 0;
  if (rotation === 0) return source;
  const rotated = document.createElement("canvas");
  const swapsDimensions = rotation === 90 || rotation === 270;
  rotated.width = swapsDimensions ? source.height : source.width;
  rotated.height = swapsDimensions ? source.width : source.height;
  const context = rotated.getContext("2d");
  if (!context) throw new Error("CANVAS_UNAVAILABLE");
  if (rotation === 90) {
    context.translate(rotated.width, 0);
    context.rotate(Math.PI / 2);
  } else if (rotation === 180) {
    context.translate(rotated.width, rotated.height);
    context.rotate(Math.PI);
  } else {
    context.translate(0, rotated.height);
    context.rotate(-Math.PI / 2);
  }
  context.drawImage(source, 0, 0);
  return rotated;
};

export const isUsableAdvisoryDocumentLayout = (layout?: AdvisoryDocumentLayout | null): layout is AdvisoryDocumentLayout => {
  if (!layout?.readable || layout.confidence < .45) return false;
  const horizontalSpan = Math.abs(layout.top_right_x - layout.top_left_x)
    + Math.abs(layout.bottom_right_x - layout.bottom_left_x);
  const verticalSpan = Math.abs(layout.bottom_left_y - layout.top_left_y)
    + Math.abs(layout.bottom_right_y - layout.top_right_y);
  return horizontalSpan >= .35 && verticalSpan >= .25;
};

const warpDocumentQuad = (
  source: HTMLCanvasElement,
  layout: AdvisoryDocumentLayout,
  type: AdvisoryDocumentType
): HTMLCanvasElement => {
  const points = [
    [clampCoordinate(layout.top_left_x) * (source.width - 1), clampCoordinate(layout.top_left_y) * (source.height - 1)],
    [clampCoordinate(layout.top_right_x) * (source.width - 1), clampCoordinate(layout.top_right_y) * (source.height - 1)],
    [clampCoordinate(layout.bottom_right_x) * (source.width - 1), clampCoordinate(layout.bottom_right_y) * (source.height - 1)],
    [clampCoordinate(layout.bottom_left_x) * (source.width - 1), clampCoordinate(layout.bottom_left_y) * (source.height - 1)]
  ] as const;
  const distance = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const measuredWidth = Math.max(distance(points[0], points[1]), distance(points[3], points[2]));
  const measuredHeight = Math.max(distance(points[0], points[3]), distance(points[1], points[2]));
  const targetRatio = type === "ID_COPY" ? 85.6 / 53.98 : measuredWidth / Math.max(1, measuredHeight);
  const targetWidth = Math.min(2200, Math.max(800, Math.round(measuredWidth)));
  const targetHeight = Math.min(1800, Math.max(480, Math.round(targetWidth / Math.max(.7, Math.min(3, targetRatio)))));
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) throw new Error("CANVAS_UNAVAILABLE");
  const sourcePixels = sourceContext.getImageData(0, 0, source.width, source.height);
  const target = document.createElement("canvas");
  target.width = targetWidth;
  target.height = targetHeight;
  const targetContext = target.getContext("2d");
  if (!targetContext) throw new Error("CANVAS_UNAVAILABLE");
  const output = targetContext.createImageData(targetWidth, targetHeight);
  const [topLeft, topRight, bottomRight, bottomLeft] = points;

  for (let y = 0; y < targetHeight; y += 1) {
    const vertical = targetHeight === 1 ? 0 : y / (targetHeight - 1);
    const leftX = topLeft[0] + (bottomLeft[0] - topLeft[0]) * vertical;
    const leftY = topLeft[1] + (bottomLeft[1] - topLeft[1]) * vertical;
    const rightX = topRight[0] + (bottomRight[0] - topRight[0]) * vertical;
    const rightY = topRight[1] + (bottomRight[1] - topRight[1]) * vertical;
    for (let x = 0; x < targetWidth; x += 1) {
      const horizontal = targetWidth === 1 ? 0 : x / (targetWidth - 1);
      const sourceX = Math.round(leftX + (rightX - leftX) * horizontal);
      const sourceY = Math.round(leftY + (rightY - leftY) * horizontal);
      const outputIndex = (y * targetWidth + x) * 4;
      if (sourceX < 0 || sourceX >= source.width || sourceY < 0 || sourceY >= source.height) {
        output.data[outputIndex] = 255;
        output.data[outputIndex + 1] = 255;
        output.data[outputIndex + 2] = 255;
        output.data[outputIndex + 3] = 255;
        continue;
      }
      const sourceIndex = (sourceY * source.width + sourceX) * 4;
      output.data[outputIndex] = sourcePixels.data[sourceIndex];
      output.data[outputIndex + 1] = sourcePixels.data[sourceIndex + 1];
      output.data[outputIndex + 2] = sourcePixels.data[sourceIndex + 2];
      output.data[outputIndex + 3] = 255;
    }
  }
  targetContext.putImageData(output, 0, 0);
  return rotateCanvas(target, layout.rotation_degrees);
};

const rotateBankPageToLandscape = (source: HTMLCanvasElement): HTMLCanvasElement => {
  if (source.width >= source.height) return source;
  const canvas = document.createElement("canvas");
  canvas.width = source.height;
  canvas.height = source.width;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("CANVAS_UNAVAILABLE");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(Math.PI / 2);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
};

const shrinkCanvas = (source: HTMLCanvasElement, scale: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(640, Math.round(source.width * scale));
  canvas.height = Math.max(400, Math.round(source.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("CANVAS_UNAVAILABLE");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const renderTransparentSignature = async (file: File): Promise<HTMLCanvasElement> => {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("CANVAS_UNAVAILABLE");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    if (pixels.data[index] >= 245 && pixels.data[index + 1] >= 245 && pixels.data[index + 2] >= 245) {
      pixels.data[index + 3] = 0;
    }
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
};

const shrinkTransparentCanvas = (source: HTMLCanvasElement, scale: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("CANVAS_UNAVAILABLE");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
};

export const normalizeAdvisoryDocument = async (
  file: File,
  type: AdvisoryDocumentType,
  layout?: AdvisoryDocumentLayout | null
): Promise<File> => {
  if (file.size > MAX_INPUT_BYTES) throw new Error("DOCUMENT_TOO_LARGE");
  if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
    throw new Error("INVALID_DOCUMENT");
  }

  let canvas = file.type === "application/pdf"
    ? await renderPdfFirstPage(file)
    : await renderImage(file);
  if (isUsableAdvisoryDocumentLayout(layout)) {
    canvas = warpDocumentQuad(canvas, layout, type);
  }
  if (type === "BANK_COPY") canvas = rotateBankPageToLandscape(canvas);

  let quality = .9;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > MAX_DOCUMENT_OUTPUT_BYTES && quality > .48) {
    quality -= .08;
    blob = await canvasToBlob(canvas, quality);
  }
  while (blob.size > MAX_DOCUMENT_OUTPUT_BYTES && Math.max(canvas.width, canvas.height) > 800) {
    canvas = shrinkCanvas(canvas, .82);
    blob = await canvasToBlob(canvas, .7);
  }
  if (blob.size > MAX_DOCUMENT_OUTPUT_BYTES) throw new Error("DOCUMENT_OPTIMIZATION_FAILED");

  const baseName = file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "document";
  return new File([blob], `${baseName}-${type === "ID_COPY" ? "id" : "bank"}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now()
  });
};

export const createAdvisoryDocumentAnalysisPreview = async (file: File): Promise<string> => {
  if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) throw new Error("INVALID_DOCUMENT");
  let canvas = file.type === "application/pdf"
    ? await renderPdfFirstPage(file)
    : await renderImage(file);
  while (Math.max(canvas.width, canvas.height) > 1400) canvas = shrinkCanvas(canvas, .82);
  let quality = .82;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > MAX_DOCUMENT_OUTPUT_BYTES && quality > .5) {
    quality -= .08;
    blob = await canvasToBlob(canvas, quality);
  }
  while (blob.size > MAX_DOCUMENT_OUTPUT_BYTES && Math.max(canvas.width, canvas.height) > 800) {
    canvas = shrinkCanvas(canvas, .72);
    blob = await canvasToBlob(canvas, .68);
  }
  if (blob.size > MAX_DOCUMENT_OUTPUT_BYTES) throw new Error("DOCUMENT_OPTIMIZATION_FAILED");
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("FILE_READ_FAILED"));
    reader.readAsDataURL(blob);
  });
};

export const createAdvisoryDocumentRemakePages = async (
  file: File,
  maxPdfPages = 5
): Promise<AdvisoryDocumentRemakePage[]> => {
  if (file.size > MAX_INPUT_BYTES) throw new Error("DOCUMENT_TOO_LARGE");
  if (file.type.startsWith("image/")) {
    return [{ pageNumber: 1, sourceFile: file, analysisDataUrl: await createAdvisoryDocumentAnalysisPreview(file) }];
  }
  if (file.type !== "application/pdf") throw new Error("INVALID_DOCUMENT");

  const loadingTask = pdfjsLib.getDocument({ data: await file.arrayBuffer() });
  const pdfDocument = await loadingTask.promise;
  try {
    const pageCount = Math.min(Math.max(1, maxPdfPages), pdfDocument.numPages);
    const baseName = file.name.replace(/\.[^.]+$/, "").slice(0, 100) || "identity-bank";
    const pages: AdvisoryDocumentRemakePage[] = [];
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const canvas = await renderPdfPage(pdfDocument, pageNumber);
      const pageBlob = await canvasToBlob(canvas, .9);
      const sourceFile = new File([pageBlob], `${baseName}-page-${pageNumber}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now()
      });
      pages.push({
        pageNumber,
        sourceFile,
        analysisDataUrl: await createAdvisoryDocumentAnalysisPreview(sourceFile)
      });
    }
    return pages;
  } finally {
    await loadingTask.destroy();
  }
};

export const normalizeAdvisorySignature = async (file: File): Promise<File> => {
  if (file.size > 10 * 1024 * 1024) throw new Error("DOCUMENT_TOO_LARGE");
  if (!["image/jpeg", "image/png"].includes(file.type)) throw new Error("INVALID_DOCUMENT");
  let canvas = await renderTransparentSignature(file);
  let blob = await canvasToPngBlob(canvas);
  while (blob.size > MAX_SIGNATURE_OUTPUT_BYTES && canvas.width > 900) {
    canvas = shrinkTransparentCanvas(canvas, .82);
    blob = await canvasToPngBlob(canvas);
  }
  if (blob.size > MAX_SIGNATURE_OUTPUT_BYTES) throw new Error("DOCUMENT_OPTIMIZATION_FAILED");
  return new File([blob], "consent-signature.png", { type: "image/png", lastModified: Date.now() });
};

export const advisoryDocumentUrlToDataUrl = async (
  signedUrl: string,
  contentType: string,
  type: AdvisoryDocumentType
): Promise<string> => {
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error("DOCUMENT_DOWNLOAD_FAILED");
  const source = new File([await response.blob()], `stored.${contentType === "application/pdf" ? "pdf" : "jpg"}`, { type: contentType });
  const normalized = await normalizeAdvisoryDocument(source, type);
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("FILE_READ_FAILED"));
    reader.readAsDataURL(normalized);
  });
};
