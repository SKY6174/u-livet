import { PDFDocument, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  CONSENT_TITLES,
  TEMPLATE_VERSION,
  RELATION_QUESTIONS,
  type ConsentType,
  type ConsentForm,
  type Choice,
} from "./instructor-consent-model";
export * from "./instructor-consent-model";
export type ConsentAssets = {
  regular: Uint8Array;
  bold: Uint8Array;
  criminal: Uint8Array;
};
/** Canonical PDF renderer shared by browser preview and trusted server finalization. */
export async function renderConsentPdf(
  type: ConsentType,
  v: ConsentForm,
  a: ConsentAssets,
  draft = true,
) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(a.regular, { subset: true }),
    bold =
      type === "CRIMINAL_CONSENT"
        ? regular
        : await pdf.embedFont(a.bold, { subset: true });
  let page: PDFPage;
  if (type === "CRIMINAL_CONSENT") {
    const source = await PDFDocument.load(a.criminal);
    [page] = await pdf.copyPages(source, [0]);
    pdf.addPage(page);
  } else page = pdf.addPage([595.28, 841.89]);
  const height = page.getHeight();
  const text = (
    s: string,
    x: number,
    top: number,
    size = 10,
    strong = false,
    width = 500,
  ) => {
    const font = strong ? bold : regular;
    s = s.replace(/\r?\n/g, " ");
    const fit = Math.min(
      size,
      width / Math.max(font.widthOfTextAtSize(s || " ", 1), 1),
    );
    page.drawText(s, {
      x,
      y: height - top - fit,
      size: fit,
      font,
      color: rgb(0, 0, 0),
    });
  };
  const lines = (
    s: string,
    x: number,
    top: number,
    width: number,
    size = 10,
    leading = 16,
    strong = false,
  ) => {
    const font = strong ? bold : regular,
      chunks: string[] = [];
    let current = "";
    for (const char of s) {
      if (
        char === "\n" ||
        font.widthOfTextAtSize(current + char, size) > width
      ) {
        chunks.push(current);
        current = char === "\n" ? "" : char;
      } else current += char;
    }
    if (current) chunks.push(current);
    chunks.forEach((s, i) =>
      text(s, x, top + leading * i, size, strong, width),
    );
    return top + chunks.length * leading;
  };
  const box = (
    x: number,
    top: number,
    width: number,
    h: number,
    shaded = false,
  ) =>
    page.drawRectangle({
      x,
      y: height - top - h,
      width,
      height: h,
      borderColor: rgb(0.2, 0.2, 0.2),
      borderWidth: 0.65,
      ...(shaded ? { color: rgb(0.95, 0.95, 0.95) } : {}),
    });
  const center = (s: string, top: number, size: number, strong = false) =>
    text(
      s,
      (page.getWidth() - (strong ? bold : regular).widthOfTextAtSize(s, size)) /
        2,
      top,
      size,
      strong,
    );
  const checks = (c: Choice) =>
    `${c === "YES" ? "[V]" : "[  ]"} 동의함     ${c === "NO" ? "[V]" : "[  ]"} 동의하지 않음`;
  const date = v.date ? v.date.split("-").map(Number) : ["", "", ""];
  const sign = async (x: number, top: number, w = 82, h = 33) => {
    if (!v.signature) return;
    let image;
    try {
      image = await pdf.embedPng(v.signature);
    } catch {
      throw new Error("서명 이미지가 올바르지 않습니다. 다시 서명해 주세요.");
    }
    if (
      image.width > 4096 ||
      image.height > 4096 ||
      image.width < 2 ||
      image.height < 2
    )
      throw new Error("서명 이미지 크기를 확인해 주세요.");
    const ratio = Math.min(w / image.width, h / image.height);
    page.drawImage(image, {
      x,
      y: height - top - image.height * ratio,
      width: image.width * ratio,
      height: image.height * ratio,
    });
  };
  if (type === "CRIMINAL_CONSENT") {
    text(v.name, 175, 177, 12, false, 340);
    if (v.is_foreign) {
      text(`영문: ${v.english_name}`, 175, 199, 10, false, 340);
      text(v.birth_date, 175, 248, 11, false, 108);
      text(v.foreign_number, 402, 248, 10, false, 125);
    } else text(v.resident_number, 175, 248, 11, false, 108);
    text(v.phone, 175, 306, 12, false, 340);
    text(String(date[0]), 379, 448, 11);
    text(String(date[1]), 448, 448, 11);
    text(String(date[2]), 494, 448, 11);
    text(v.name, 359, 490, 11, false, 104);
    await sign(454, 480, 75, 31);
  } else if (type === "PRIVACY_CONSENT") {
    center(CONSENT_TITLES[type], 47, 19, true);
    lines(
      "울산과학대학교 앵커사업단은 평생직업교육과정 강사·보조강사의 위촉, 강의 운영 및 수당 지급을 위해 아래와 같이 개인정보를 수집·이용하고 제공합니다.",
      45,
      88,
      505,
      10.5,
      17,
    );
    text("1. 개인정보 수집·이용 안내", 45, 139, 12, true);
    const rows = [
      [
        "수집 항목",
        "성명, 주민등록번호, 주소, 연락처, 이메일, 소속·직위, 은행·계좌정보, 학력·경력·전문분야",
      ],
      [
        "이용 목적",
        "강사 위촉 및 본인 확인, 교육과정 운영, 강사료 등 수당 지급, 원천징수 및 세무 신고, 사업 운영·정산",
      ],
      [
        "보유 기간",
        "사업 관련 증빙자료로 5년간 보유한 후 관련 절차에 따라 파기",
      ],
    ];
    rows.forEach(([label, content], i) => {
      const y = 163 + i * 51;
      box(45, y, 85, 51, true);
      box(130, y, 420, 51);
      text(label, 55, y + 16, 10, true);
      lines(content, 140, y + 8, 398, 10, 16);
    });
    text("2. 개인정보 제3자 제공 안내", 45, 337, 12, true);
    lines(
      "제공받는 자: 관할 세무서\n제공 목적: 강사료 등 지급에 따른 원천징수 및 세무 신고\n제공 항목: 성명, 주민등록번호, 주소, 지급 금액\n보유·이용 기간: 해당 업무 목적 달성 및 관련 법령에 따른 보관 기간",
      45,
      361,
      505,
      10,
      18,
    );
    text("3. 동의 거부 및 개인정보 보호 안내", 45, 451, 12, true);
    lines(
      "개인정보 제공 및 활용에 대한 동의를 거부할 수 있습니다. 다만 본인 확인과 지급·신고에 필요한 정보 제공에 동의하지 않을 경우 강사 위촉 및 수당 지급 업무가 제한될 수 있습니다. 보유 기간이 지나거나 처리 목적이 달성된 정보는 복구할 수 없는 방법으로 파기합니다.",
      45,
      476,
      505,
      10,
      17,
    );
    box(45, 547, 505, 86, true);
    text(
      "위 내용을 확인하고 개인정보 수집·이용 및 제3자 제공에",
      57,
      559,
      10,
      true,
    );
    text(checks(v.privacy_consent), 230, 579, 10);
    text("고유식별정보(주민등록번호)의 처리에", 57, 605, 10, true);
    text(checks(v.unique_id_consent), 290, 605, 9.5);
    center(`${date[0]}년  ${date[1]}월  ${date[2]}일`, 665, 12);
    text(`동의자: ${v.name}`, 310, 703, 12, false, 150);
    text("(서명 또는 인)", 466, 706, 9);
    await sign(460, 686);
    center("울산과학대학교 앵커사업단장 귀하", 763, 14, true);
  } else {
    box(38, 35, 519, 766);
    center(CONSENT_TITLES[type], 52, 19, true);
    text("1. 인적사항", 51, 96, 12, true);
    const cell = (
      label: string,
      content: string,
      x: number,
      y: number,
      width: number,
    ) => {
      box(x, y, 69, 36, true);
      box(x + 69, y, width - 69, 36);
      text(label, x + 5, y + 12, 9, true, 59);
      text(content, x + 77, y + 11, 10, false, width - 85);
    };
    cell("성명", v.name, 51, 119, 200);
    cell("위촉 프로그램명", v.program, 251, 119, 293);
    cell("소속", v.affiliation, 51, 155, 200);
    cell(
      "위촉 기간",
      v.period_start && v.period_end
        ? `${v.period_start} ~ ${v.period_end}`
        : "",
      251,
      155,
      293,
    );
    text("2. 청렴 서약 사항", 51, 207, 12, true);
    let y =
      lines(
        "본인은 울산과학대학교 앵커사업단의 강사(전문가)로 위촉됨에 있어 다음 사항을 준수할 것을 엄숙히 서약합니다.",
        51,
        230,
        493,
        10,
        16,
      ) + 5;
    for (const p of [
      "가. 강사 위촉 및 수행 과정에서 어떠한 부정 청탁이나 금품, 향응을 제공하거나 요구하지 않겠습니다.",
      "나. 대학의 관련 규정 및 국고사업 운영 지침을 준수하며, 성실하게 강의 업무를 수행하겠습니다.",
      "다. 강의 내용 및 사업 수행 과정에서 취득한 기밀 정보를 외부에 유출하지 않겠습니다.",
    ])
      y = lines(p, 58, y, 479, 9.8, 15) + 4;
    text("3. 사적 이해관계 확인 (필수 응답)", 51, 382, 12, true);
    text(
      "본 대학의 투명한 사업 운영을 위해 아래의 사적 이해관계 해당 여부를 확인하여 주시기 바랍니다.",
      51,
      406,
      9.3,
    );
    box(51, 427, 401, 23, true);
    box(452, 427, 46, 23, true);
    box(498, 427, 46, 23, true);
    text("확인 항목", 215, 433, 10, true);
    text("예", 470, 433, 10, true);
    text("아니오", 507, 433, 9, true);
    RELATION_QUESTIONS.forEach((q, i) => {
      const y = 450 + i * 34;
      box(51, y, 401, 34);
      box(452, y, 46, 34);
      box(498, y, 46, 34);
      lines(`${i + 1}. ${q}`, 58, y + 5, 386, 9.1, 12);
      text(v.relations[i] === "YES" ? "[V]" : "[  ]", 467, y + 10, 10);
      text(v.relations[i] === "NO" ? "[V]" : "[  ]", 513, y + 10, 10);
    });
    text(
      "※ 한 가지라도 ‘예’인 경우, 해당 교직원 정보를 기재하여 주십시오.",
      51,
      559,
      9.3,
    );
    text(
      `성명: ${v.related_name}    소속 학부(과)/부서: ${v.related_department}`,
      58,
      577,
      9.5,
      false,
      479,
    );
    text(`본인과의 관계: ${v.relationship}`, 58, 594, 9.5, false, 479);
    text("4. 서약 및 확인", 51, 620, 12, true);
    lines(
      "본인은 상기 기재 내용이 사실과 다름없음을 확인하며, 사적 이해관계가 존재함에도 불구하고 본인의 전문성 및 사업의 필수성에 근거하여 위촉되었음을 확인합니다. 또한, 위촉 과정에서 해당 이해관계자의 부당한 영향력 행사가 없었음을 확약하며, 위 기재된 내용이 허위임이 발견될 경우, 강사 위촉 취소 및 강사료 환수 등 어떠한 불이익도 감수할 것을 서약합니다.",
      51,
      644,
      493,
      9.5,
      14,
    );
    center(`${date[0]}년  ${date[1]}월  ${date[2]}일`, 712, 11);
    text(`서약자: ${v.name}`, 302, 739, 11, false, 159);
    text("(서명 또는 인)", 466, 741, 9);
    await sign(460, 726, 77, 30);
    center("울산과학대학교 산학협력단장 귀하", 774, 13, true);
  }
  if (draft) text("작성 중 · 최종 제출 전 미확정 문서", 38, 817, 8);
  pdf.setTitle(CONSENT_TITLES[type]);
  pdf.setProducer("UC-LIFE / PDF 1.7");
  pdf.setSubject(`서식 ${TEMPLATE_VERSION}`);
  return pdf.save();
}
