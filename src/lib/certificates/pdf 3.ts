import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import type { CertificateJob } from "./types";
// A single bundled, OFL-licensed Korean font makes output portable across hosts.
let fontBytes: Promise<Buffer> | undefined;
export async function renderCertificate(
  job: CertificateJob,
  origin: string,
): Promise<Uint8Array> {
  const url = new URL(origin);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("INVALID_VERIFY_ORIGIN");
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw new Error("HTTPS_REQUIRED");
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  fontBytes ??= readFile(
    path.join(process.cwd(), "assets/fonts/NanumGothic-Regular.ttf"),
  );
  const font = await doc.embedFont(await fontBytes, { subset: false });
  const snapshot = job.snapshot;
  const navy = rgb(0.07, 0.16, 0.29);
  const teal = rgb(0.06, 0.35, 0.33);
  let page!: PDFPage;
  let y = 0;
  const text = (
    value: string,
    x: number,
    top: number,
    size = 12,
    color = navy,
  ) => page.drawText(value, { x, y: top, size, font, color });
  const center = (value: string, top: number, size: number) =>
    text(value, (595.28 - font.widthOfTextAtSize(value, size)) / 2, top, size);
  const newPage = () => {
    page = doc.addPage([595.28, 841.89]);
    page.drawRectangle({
      x: 28,
      y: 28,
      width: 539.28,
      height: 785.89,
      borderColor: teal,
      borderWidth: 1.3,
    });
    const headingSize = Math.min(
      10,
      (495 / font.widthOfTextAtSize(snapshot.issuer.organization_name, 10)) *
        10,
    );
    text(snapshot.issuer.organization_name, 48, 780, headingSize);
    text(job.number, 48, 755, 10);
    if (snapshot.issuer.test_only)
      center("검증용 · 실제 증명으로 사용할 수 없음", 722, 12);
    y = 685;
  };
  const lines = (value: string, maxWidth: number, size: number, f: PDFFont) => {
    const result: string[] = [];
    for (const paragraph of value.split("\n")) {
      let line = "";
      for (const ch of paragraph) {
        if (f.widthOfTextAtSize(line + ch, size) > maxWidth) {
          result.push(line);
          line = ch;
        } else line += ch;
      }
      result.push(line);
    }
    return result;
  };
  const block = (value: string, size = 13, gap = 23) => {
    for (const line of lines(value, 475, size, font)) {
      if (y < 205) newPage();
      text(line, 60, y, size);
      y -= gap;
    }
  };
  newPage();
  for (const line of lines(snapshot.template.title, 475, 28, font)) {
    if (y < 300) newPage();
    center(line, y, 28);
    y -= 40;
  }
  y -= 30;
  block(`성명: ${snapshot.person_name}`, 15, 26);
  y -= 15;
  block(`과정: ${snapshot.course_name}`, 14, 24);
  block(`교육기간: ${snapshot.starts_on} ~ ${snapshot.ends_on}`);
  if (snapshot.evidence.minutes !== null)
    block(
      `${snapshot.kind === "TEACHING" ? "확인된 실제 강의시간" : "확인된 출석 인정시간"}: ${Number(snapshot.evidence.minutes)}분 (${(Number(snapshot.evidence.minutes) / 60).toFixed(2)}시간)`,
    );
  else
    block("이 문서는 수료 사실을 증명하며 별도 시간은 기재하지 않습니다.", 11);
  if (snapshot.kind === "TEACHING") {
    y -= 12;
    block("확정 강의실적", 13);
    for (const log of snapshot.evidence.logs ?? [])
      block(
        `${new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium" }).format(new Date(log.starts_at))} · ${log.title} · ${log.minutes}분`,
        11,
        20,
      );
  }
  y -= 20;
  block(snapshot.template.body, 14, 26);
  y -= 16;
  const signature = lines(
    `${snapshot.issuer.title} ${snapshot.issuer.holder_name}`,
    475,
    18,
    font,
  );
  if (y < 260 + signature.length * 28) newPage();
  center(job.issue_date, y, 13);
  y -= 45;
  for (const line of signature) {
    center(line, y, 18);
    y -= 28;
  }
  if (job.seal) {
    const seal = await doc.embedPng(Buffer.from(job.seal, "base64"));
    page.drawImage(seal, { x: 450, y: y - 20, width: 54, height: 54 });
  } else if (snapshot.issuer.seal_omission_basis)
    block(`직인 생략 근거: ${snapshot.issuer.seal_omission_basis}`, 9, 16);
  const verifyUrl = `${url.origin}/verify#${job.token}`;
  const qr = await doc.embedPng(
    await QRCode.toBuffer(verifyUrl, {
      type: "png",
      width: 300,
      margin: 1,
      errorCorrectionLevel: "M",
    }),
  );
  for (const [index, p] of Array.from(doc.getPages().entries())) {
    p.drawImage(qr, { x: 447, y: 54, width: 80, height: 80 });
    p.drawText("QR로 발급 상태를 확인하세요.", {
      x: 60,
      y: 100,
      size: 10,
      font,
      color: teal,
    });
    p.drawText("등록 원본의 상태 조회이며 전자서명 인증을 뜻하지 않습니다.", {
      x: 60,
      y: 82,
      size: 8,
      font,
      color: navy,
    });
    p.drawText(`${job.number} · ${index + 1}/${doc.getPageCount()}`, {
      x: 60,
      y: 58,
      size: 9,
      font,
      color: navy,
    });
  }
  doc.setTitle(`${snapshot.template.title} ${job.number}`);
  doc.setAuthor(snapshot.issuer.organization_name);
  doc.setProducer("U-LIFE certificate renderer v1");
  doc.setCreationDate(new Date(`${job.issue_date}T00:00:00+09:00`));
  return doc.save();
}
