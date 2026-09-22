import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const hash = value => createHash("sha256").update(value).digest("hex");
const readJson = path => JSON.parse(readFileSync(path, "utf8"));
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const SLUG = /^[a-z]+(?:-[a-z]+)*$/;
const requireText = (value, label) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`빈 필수 항목: ${label}`);
};
const unique = (values, label) => {
  if (new Set(values).size !== values.length) throw new Error(`중복 ${label}`);
};

export function validateRelease(release, root = ROOT) {
  if (!VERSION.test(release.version)) throw new Error("잘못된 버전");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(release.releasedOn) || Number.isNaN(Date.parse(release.releasedOn))) throw new Error("잘못된 발행일");
  for (const key of ["title", "status", "scope", "sourceCommit"]) requireText(release[key], key);
  if (!release.manuals?.length || !release.common?.length || !release.changes?.length) throw new Error("본문·공통 안내·개정 이력 필요");
  unique(release.manuals.map(manual => manual.id), "대상");
  unique(release.manuals.map(manual => manual.code), "문서번호");
  release.common.forEach(item => { requireText(item.title, "공통 제목"); requireText(item.body, "공통 본문"); });
  release.changes.forEach(text => requireText(text, "개정 내용"));
  for (const manual of release.manuals) {
    if (!SLUG.test(manual.id)) throw new Error("잘못된 대상 ID");
    for (const key of ["code", "title", "audience", "summary", "owner"]) requireText(manual[key], key);
    for (const key of ["prerequisites", "checklist", "sources"]) {
      if (!manual[key]?.length) throw new Error(`${manual.id}: ${key} 필요`);
      manual[key].forEach(text => requireText(text, key));
    }
    if (!manual.sections?.length || !manual.faq?.length) throw new Error("절차·문제 해결 필요");
    unique(["start", "checklist", "faq", "revision", ...manual.sections.map(section => section.id)], "목차 앵커");
    for (const section of manual.sections) {
      if (!SLUG.test(section.id)) throw new Error("잘못된 섹션 ID");
      for (const key of ["title", "path", "entry", "prepare", "done"]) requireText(section[key], key);
      if (!/^\/[a-z][a-z/-]*$/.test(section.path) || !existsSync(join(root, "src/app", section.path, "page.tsx"))) throw new Error(`존재하지 않는 메뉴: ${section.path}`);
      if (section.steps?.length < 2) throw new Error("번호 절차 필요");
      section.steps.forEach(text => requireText(text, "단계"));
    }
    manual.faq.forEach(item => { requireText(item.question, "질문"); requireText(item.answer, "답변"); });
    for (const source of manual.sources) {
      if (!/^(src|docs)\//.test(source) || source.includes("..") || !existsSync(join(root, source))) throw new Error(`근거 파일 누락: ${source}`);
    }
  }
}

export function loadReleases(root = ROOT) {
  const catalog = readJson(join(root, "src/content/manuals/releases.json"));
  if (!catalog.versions?.length || !catalog.versions.every(version => VERSION.test(version))) throw new Error("버전 목록 오류");
  unique(catalog.versions, "버전");
  if (!catalog.versions.includes(catalog.current)) throw new Error("현재 버전 미등록");
  const published = join(root, "public/manuals");
  if (existsSync(published)) {
    for (const entry of readdirSync(published, { withFileTypes: true })) {
      if (entry.isDirectory() && VERSION.test(entry.name) && !catalog.versions.includes(entry.name)) throw new Error(`발행된 구판 등록 누락: ${entry.name}`);
    }
  }
  return catalog.versions.map(version => {
    const source = readFileSync(join(root, `src/content/manuals/${version}.json`));
    const release = JSON.parse(source);
    if (release.version !== version) throw new Error("파일명과 버전 불일치");
    validateRelease(release, root);
    return { release, source };
  });
}

export function expectedFiles(release) {
  return ["all.pdf", ...release.manuals.flatMap(manual => [`${manual.id}.pdf`, `${manual.id}.md`])].sort();
}

export function verifyFrozen(release, source, directory) {
  const manifest = readJson(join(directory, "manifest.json"));
  if (manifest.version !== release.version || manifest.sourceSha256 !== hash(source)) throw new Error(`발행본 ${release.version} 원문 변경: 새 버전으로 개정하세요.`);
  if (JSON.stringify(Object.keys(manifest.files).sort()) !== JSON.stringify(expectedFiles(release))) throw new Error("배포파일 목록 불일치");
  for (const [name, checksum] of Object.entries(manifest.files)) {
    if (hash(readFileSync(join(directory, name))) !== checksum) throw new Error(`발행본 배포파일 변경: ${name}`);
  }
  return manifest;
}

export function markdown(release, manual) {
  const rows = [
    `# ${manual.title}`, "", `${manual.code} | v${release.version} | ${release.releasedOn}`, "",
    `대상: ${manual.audience}`, `업무 문의: ${manual.owner}`, `검수 상태: ${release.status}`, "",
    manual.summary, "", release.scope, "", "## 시작하기 전에", "",
    ...manual.prerequisites.map(text => `- ${text}`), "",
    ...release.common.flatMap(item => [`### ${item.title}`, "", item.body, ""]),
    ...manual.sections.flatMap((section, i) => [
      `## ${i + 1}. ${section.title}`, "", `메뉴 경로: ${section.entry}`, `시작 화면: ${section.path}`, "",
      `준비할 것: ${section.prepare}`, "", ...section.steps.map((step, j) => `${j + 1}. ${step}`), "",
      `완료 확인: ${section.done}`, "", ...(section.note ? [`확인하세요: ${section.note}`, ""] : []),
    ]),
    "## 업무 점검표", "", ...manual.checklist.map(text => `- ${text}`), "",
    "## 문제 해결", "", ...manual.faq.flatMap(item => [`### ${item.question}`, "", item.answer, ""]),
    "## 이 버전의 변경 내용", "", ...release.changes.map(text => `- ${text}`), "",
    "## 작성 근거 (문서 관리용)", "", `소스 기준 커밋: ${release.sourceCommit}`, "",
    ...manual.sources.map(path => `- ${path}`), "",
  ];
  return rows.join("\n");
}

const INK = rgb(0.10, 0.16, 0.22);
const TEAL = rgb(0.06, 0.36, 0.34);
const MUTED = rgb(0.34, 0.40, 0.45);
const PAPER = rgb(0.94, 0.97, 0.97);
const WIDTH = 595.28, HEIGHT = 841.89, MARGIN = 48;

async function document(release, title, subset = true) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(readFileSync(join(ROOT, "assets/fonts/NanumGothic-Regular.ttf")), { subset });
  const date = new Date(`${release.releasedOn}T00:00:00Z`);
  pdf.setTitle(title); pdf.setAuthor("U-LIFE 앵커사업단"); pdf.setSubject(`이용 매뉴얼 v${release.version}`);
  pdf.setCreationDate(date); pdf.setModificationDate(date);
  let page, y;
  function newPage() {
    page = pdf.addPage([WIDTH, HEIGHT]); y = HEIGHT - 74;
    page.drawText("U-LIFE  /  이용 매뉴얼", { x: MARGIN, y: HEIGHT - 38, size: 8, font, color: TEAL });
    page.drawLine({ start: { x: MARGIN, y: HEIGHT - 46 }, end: { x: WIDTH - MARGIN, y: HEIGHT - 46 }, thickness: 0.6, color: TEAL });
  }
  function ensure(height) { if (y - height < 58) newPage(); }
  function lines(text, size, width) {
    const result = []; let line = "";
    for (const char of text) {
      if (char === "\n") { result.push(line); line = ""; continue; }
      if (font.widthOfTextAtSize(line + char, size) > width && line) { result.push(line.trimEnd()); line = char.trimStart(); }
      else line += char;
    }
    if (line) result.push(line);
    return result;
  }
  function paragraph(text, { size = 10.5, color = INK, indent = 0, gap = 7, leading = 17 } = {}) {
    for (const line of lines(text, size, WIDTH - 2 * MARGIN - indent)) {
      ensure(leading);
      page.drawText(line, { x: MARGIN + indent, y, size, font, color }); y -= leading;
    }
    y -= gap;
  }
  function heading(text, size = 17) { ensure(90); y -= 10; paragraph(text, { size, color: TEAL, leading: size * 1.5, gap: 12 }); }
  function footer(label, total = pdf.getPageCount()) {
    pdf.getPages().forEach((item, index) => {
      item.drawLine({ start: { x: MARGIN, y: 43 }, end: { x: WIDTH - MARGIN, y: 43 }, thickness: 0.4, color: rgb(0.8, 0.85, 0.85) });
      item.drawText(`${label}  |  v${release.version}  |  ${release.releasedOn}`, { x: MARGIN, y: 28, size: 7.5, font, color: MUTED });
      const number = `${index + 1} / ${total}`;
      item.drawText(number, { x: WIDTH - MARGIN - font.widthOfTextAtSize(number, 8), y: 28, size: 8, font, color: MUTED });
    });
  }
  newPage();
  return { pdf, font, paragraph, heading, ensure, newPage, footer, get page() { return page; }, get y() { return y; }, set y(value) { y = value; } };
}

async function manualPdf(release, manual) {
  const doc = await document(release, manual.title);
  const cover = doc.page;
  doc.paragraph(`OPERATIONS GUIDE   /   ${manual.code}`, { size: 10, color: TEAL, gap: 18 });
  doc.paragraph(manual.title, { size: 26, leading: 38, color: TEAL, gap: 16 });
  doc.paragraph(manual.summary, { size: 12, leading: 21, color: MUTED, gap: 18 });
  doc.paragraph(`버전 ${release.version}   /   개정일 ${release.releasedOn}`, { size: 11 });
  doc.paragraph(`대상: ${manual.audience}`);
  doc.paragraph(`업무 문의: ${manual.owner}`);
  doc.paragraph(release.status, { size: 9, color: MUTED, gap: 12 });
  doc.heading("먼저 준비하세요", 13);
  manual.prerequisites.forEach(text => doc.paragraph(`• ${text}`, { size: 10, leading: 16, gap: 6 }));
  doc.heading("업무 목차", 13);
  const toc = [];
  manual.sections.forEach((section, i) => {
    toc.push(doc.y); doc.paragraph(`${String(i + 1).padStart(2, "0")}  ${section.title}`, { size: 10, gap: 8, leading: 16 });
  });
  doc.paragraph("공통 시작 안내 · 업무 점검표 · 문제 해결 · 개정 이력 포함", { size: 8.5, color: MUTED, gap: 14 });
  doc.paragraph(release.scope, { size: 8.5, color: MUTED, leading: 14 });
  if (doc.pdf.getPageCount() !== 1) throw new Error(`${manual.id}: 표지 분량 초과`);
  doc.newPage();
  doc.heading("시작하기 전에");
  release.common.forEach(item => { doc.heading(item.title, 12); doc.paragraph(item.body); });
  manual.sections.forEach((section, i) => {
    doc.ensure(150);
    const pageNumber = doc.pdf.getPageCount();
    cover.drawText(`${pageNumber}`, { x: WIDTH - MARGIN - 15, y: toc[i], size: 10, font: doc.font, color: TEAL });
    doc.heading(`${String(i + 1).padStart(2, "0")}  ${section.title}`);
    doc.paragraph(`메뉴 경로: ${section.entry}`, { size: 9, color: TEAL, leading: 15 });
    doc.paragraph(`준비할 것: ${section.prepare}`, { size: 9.5, color: MUTED, leading: 16, gap: 12 });
    section.steps.forEach((step, j) => { doc.ensure(50); doc.paragraph(`${j + 1}. ${step}`); });
    doc.ensure(65);
    doc.page.drawRectangle({ x: MARGIN - 5, y: doc.y - 6, width: WIDTH - 2 * MARGIN + 10, height: 23, color: PAPER });
    doc.paragraph("완료 확인", { size: 10, color: TEAL, gap: 5 });
    doc.paragraph(section.done, { size: 10, leading: 16 });
    if (section.note) doc.paragraph(`확인하세요: ${section.note}`, { size: 9, leading: 15, color: MUTED, gap: 12 });
  });
  doc.heading("업무 점검표");
  manual.checklist.forEach(text => doc.paragraph(`• ${text}`));
  doc.ensure(170);
  doc.heading("문제 해결");
  manual.faq.forEach(item => { doc.heading(item.question, 12); doc.paragraph(item.answer); });
  doc.heading("이 버전의 변경 내용", 13);
  doc.paragraph(`v${release.version} · ${release.releasedOn}`, { size: 9, color: MUTED });
  release.changes.forEach(text => doc.paragraph(`• ${text}`, { size: 9, leading: 15 }));
  doc.footer(manual.code);
  return { bytes: await doc.pdf.save(), pages: doc.pdf.getPageCount() };
}

async function buildRelease(release, directory) {
  mkdirSync(directory, { recursive: true });
  const generated = [];
  for (const manual of release.manuals) {
    const output = await manualPdf(release, manual);
    writeFileSync(join(directory, `${manual.id}.pdf`), output.bytes);
    writeFileSync(join(directory, `${manual.id}.md`), markdown(release, manual));
    generated.push({ manual, ...output });
  }
  const combined = await document(release, "U-LIFE 운영대상별 매뉴얼 합본", false);
  combined.paragraph("U-LIFE  /  OPERATIONS LIBRARY", { size: 11, color: TEAL, gap: 25 });
  combined.paragraph("운영대상별\n이용 매뉴얼", { size: 30, leading: 43, color: TEAL, gap: 20 });
  combined.paragraph(`전체 ${release.manuals.length}종 합본   ·   v${release.version}   ·   ${release.releasedOn}`, { size: 12, gap: 16 });
  combined.paragraph(release.status, { size: 10, color: MUTED });
  combined.heading("대상별 목차");
  let firstPage = 2;
  generated.forEach(({ manual, pages }) => {
    combined.paragraph(`${manual.code}  ${manual.title}  ·  합본 ${firstPage}쪽`, { size: 11, leading: 19, gap: 9 });
    firstPage += pages;
  });
  combined.heading("적용 범위", 13);
  combined.paragraph(release.scope, { size: 10, color: MUTED });
  combined.paragraph("각 문서의 하단 쪽수는 개별 문서 기준입니다. 위 목차는 PDF 뷰어의 합본 쪽수입니다.", { size: 9, color: MUTED });
  if (combined.pdf.getPageCount() !== 1) throw new Error("합본 표지 분량 초과");
  combined.footer("U-LIFE 매뉴얼 합본", firstPage - 1);
  // Embed the cover font before copied documents allocate their resource objects.
  await combined.pdf.flush();
  for (const { bytes } of generated) {
    const source = await PDFDocument.load(bytes);
    const pages = await combined.pdf.copyPages(source, source.getPageIndices());
    pages.forEach(page => combined.pdf.addPage(page));
  }
  writeFileSync(join(directory, "all.pdf"), await combined.pdf.save());
  return generated.map(({ manual, pages }) => ({ id: manual.id, pages }));
}

export async function run(mode) {
  if (!["--draft", "--release", "--check"].includes(mode)) throw new Error("사용법: node scripts/build-manuals.mjs --draft|--release|--check");
  const entries = loadReleases();
  // Validate every existing release before writing anything, including older versions.
  for (const { release, source } of entries) {
    const published = join(ROOT, "public/manuals", release.version);
    if (existsSync(published)) verifyFrozen(release, source, published);
    else if (mode === "--check") throw new Error(`미발행 버전: ${release.version}`);
  }
  for (const { release, source } of entries) {
    const published = join(ROOT, "public/manuals", release.version);
    if (mode === "--check" || existsSync(published)) { console.log(`검증 완료: v${release.version}`); continue; }
    const parent = join(ROOT, mode === "--draft" ? "tmp/manuals-draft" : "public/manuals");
    mkdirSync(parent, { recursive: true });
    const staging = mkdtempSync(join(parent, `.manual-${release.version}-`));
    const pages = await buildRelease(release, staging);
    if (mode === "--release") {
      const files = Object.fromEntries(expectedFiles(release).map(name => [name, hash(readFileSync(join(staging, name)))]));
      writeFileSync(join(staging, "manifest.json"), JSON.stringify({ version: release.version, releasedOn: release.releasedOn, sourceSha256: hash(source), files, pages }, null, 2) + "\n");
      renameSync(staging, published);
      verifyFrozen(release, source, published);
      const deliver = join(ROOT, "output/pdf/manuals", release.version);
      mkdirSync(deliver, { recursive: true });
      for (const name of expectedFiles(release).filter(name => name.endsWith(".pdf"))) writeFileSync(join(deliver, name), readFileSync(join(published, name)));
      console.log(`로컬 발행 완료: ${published}`);
    } else console.log(`검토용 PDF: ${staging}`);
    console.log(JSON.stringify(pages));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
