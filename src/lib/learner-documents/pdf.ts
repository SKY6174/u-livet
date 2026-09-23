import { BlendMode, PDFDocument, PDFName, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { requirePdf17 } from "../pdf/version";
import { DOCUMENT_TITLES, PURPOSES, type LearnerDocumentType, type LearnerDocumentValues } from "./model";

export type LearnerPdfAssets = { template: Uint8Array; regular: Uint8Array; bold: Uint8Array };

export async function renderLearnerDocument(type: LearnerDocumentType, v: LearnerDocumentValues, assets: LearnerPdfAssets) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.catalog.set(PDFName.of("Version"), PDFName.of("1.7"));
  const source = await PDFDocument.load(assets.template);
  const [page] = await pdf.copyPages(source, [0]);
  pdf.addPage(page);
  const [regular, bold] = await Promise.all([
    pdf.embedFont(assets.regular, { subset: true }),
    pdf.embedFont(assets.bold, { subset: true }),
  ]);
  const metrics = [fontkit.create(assets.regular), fontkit.create(assets.bold)];
  // All rectangles use the original PDF's top-left point coordinates.
  function text(value: string, x: number, top: number, width: number, height: number, size = 11, heavy = false, min = 8) {
    value = value.replace(/[\r\n\t]/g, " ").trim();
    if (!value) return;
    const font = heavy ? bold : regular, metric = metrics[heavy ? 1 : 0];
    const run = metric.layout(value);
    if (run.glyphs.some(g => g.id === 0)) throw new Error("PDF에서 지원하지 않는 문자가 있습니다. 특수문자나 이모지를 확인해 주세요.");
    while (font.widthOfTextAtSize(value, size) > width - 8 && size > min) size = Math.max(min, size - 0.25);
    if (font.widthOfTextAtSize(value, size) > width - 8) throw new Error("입력 내용이 서식의 칸보다 깁니다. 과정명·성명·주소·계좌 정보를 짧게 정리해 주세요.");
    const visible = run.glyphs.filter(g => g.bbox.maxY > g.bbox.minY);
    const low = Math.min(...visible.map(g => g.bbox.minY)) * size / metric.unitsPerEm;
    const high = Math.max(...visible.map(g => g.bbox.maxY)) * size / metric.unitsPerEm;
    page.drawText(value, { x: x + (width - font.widthOfTextAtSize(value, size)) / 2,
      y: 842 - top - height / 2 - (high + low) / 2, size, font, color: rgb(0, 0, 0) });
  }
  function check(x: number, top: number, size = 8) {
    const point = (px: number, py: number) => ({ x: px, y: 842 - py });
    page.drawLine({ start: point(x, top + size * .45), end: point(x + size * .35, top + size), thickness: 1.25 });
    page.drawLine({ start: point(x + size * .35, top + size), end: point(x + size, top - 1), thickness: 1.25 });
  }
  function consent(value: string, yes: number, no: number, top: number, size = 7) {
    if (value) check(value === "yes" ? yes : no, top, size);
  }
  if (type === "application") {
    text(v.courseName, 166, 151.3, 384.2, 32.6, 12, true);
    text(v.name, 166, 184, 150.6, 32.3);
    text(v.phone, 166, 216.4, 150.6, 32.2);
    text(v.email, 166, 248.7, 384.2, 32.2, 10);
    text(v.address, 166, 281, 384.2, 32.2, 10);
    v.birthDate.replace(/\D/g, "").slice(2, 8).split("").forEach((digit, i) => text(digit, 398.28 + i * 25.32, 184, 25.32, 32.3, 12));
    if (v.gender) check(v.gender === "male" ? 427.2 : 493.5, 227.5, 9);
    const positions = [188, 258.2, 328.1, 403.1, 493.3];
    PURPOSES.forEach((purpose, i) => { if (v.purposes.includes(purpose)) check(positions[i], 325.5, 7); });
    consent(v.privacy, 395.8, 463.2, 471);
    consent(v.publicity, 396.2, 463.6, 557);
    consent(v.portrait, 394.6, 462, 616.6);
    text(v.name, 267, 720.5, 88, 16, 12);
  } else if (type === "scholarship") {
    text(v.courseName, 145.6, 143, 406.8, 34.6, 12, true);
    text(v.name, 206.9, 183.6, 109, 34.4);
    text(v.phone, 206.9, 218.2, 109, 34.3, 10);
    text(v.residentFront, 396, 183.6, 72, 34.4, 11);
    text(v.residentBack, 481, 183.6, 70, 34.4, 11);
    if (v.gender) check(v.gender === "male" ? 427 : 493.3, 231, 9);
    text(v.bank, 145.6, 279.4, 61.3, 43.6, 10);
    text(v.account, 207, 280, 240.6, 27, 12);
    text(v.accountHolder, 447.6, 279.4, 104.8, 43.6, 11);
    consent(v.privacy, 353.3, 411.7, 540.8, 6.4);
    text(v.name, 258, 691, 88, 16, 12);
  } else {
    const money = (value: string) => value.replace(/[\s,]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    text(v.courseName, 129, 145.3, 416, 25.2, 11, true);
    text(v.name, 129, 170.5, 167, 25.3, 10.5);
    text(v.residentFront, 376, 170.5, 78, 25.3, 10.5);
    text(v.residentBack, 469, 170.5, 76, 25.3, 10.5);
    text(v.phone, 129, 195.8, 167, 25.3, 10);
    text(v.homePhone, 376, 195.8, 169, 25.3, 10);
    text(v.address, 129, 221.2, 416, 25.3, 9.5);
    text(v.bank, 129, 297, 115.7, 25.3, 9.5);
    text(v.account, 296.2, 297, 123.1, 25.3, 9.5);
    text(v.accountHolder, 458.2, 297, 86.8, 25.3, 9.5);
    const occurrenceChecks = {
      "before-start": 153,
      "before-sixth": 189,
      "before-third": 258.5,
      "before-half": 327,
      "after-half": 395.5,
    } as const;
    if (v.refundOccurrence) check(occurrenceChecks[v.refundOccurrence], 329, 6.5);
    text(money(v.tuitionFee), 233, 347.6, 84, 25.2, 10);
    text(money(v.deductionAmount), 441, 347.6, 84, 25.2, 10);
    text(money(v.refundAmount), 184, 372.8, 135, 25.3, 10.5);
    text(v.name, 255, 483, 80, 24, 11);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(v.signedOn)) {
    const [year, month, day] = v.signedOn.split("-");
    if (type === "application") text(`${year}년     ${Number(month)}월     ${Number(day)}일`, 227, 690.3, 140, 14.7, 11.04);
    else if (type === "scholarship") text(`${year}년       ${Number(month)}월       ${Number(day)}일`, 225, 652.5, 180, 16, 12);
    else {
      text(year, 395.5, 271.7, 45, 25.3, 10);
      text(String(Number(month)), 450.5, 271.7, 25, 25.3, 10);
      text(String(Number(day)), 485.5, 271.7, 30, 25.3, 10);
      text(`${year}년     ${Number(month)}월     ${Number(day)}일`, 220, 456, 150, 25, 12);
    }
  }
  if (v.signature) {
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v.signature) || v.signature.length > 3_000_000) throw new Error("서명 이미지를 다시 입력해 주세요.");
    const signature = await pdf.embedPng(v.signature);
    if (signature.width > 4096 || signature.height > 4096) throw new Error("서명 이미지가 너무 큽니다.");
    const signatureBox = type === "application" ? { x: 387, top: 719, width: 88, height: 25 }
      : type === "scholarship" ? { x: 378, top: 689, width: 88, height: 25 }
        : { x: 381, top: 480, width: 59, height: 25 };
    const fitted = signature.scaleToFit(signatureBox.width, signatureBox.height);
    page.drawImage(signature, { x: signatureBox.x + (signatureBox.width - fitted.width) / 2,
      y: 842 - signatureBox.top - fitted.height,
      width: fitted.width, height: fitted.height, blendMode: BlendMode.Multiply });
  }
  pdf.setTitle(DOCUMENT_TITLES[type]);
  pdf.setProducer("U-LIFE / PDF 1.7");
  pdf.setSubject("수강생 작성 서식 · 원본 양식 2026-09");
  return requirePdf17(await pdf.save());
}
