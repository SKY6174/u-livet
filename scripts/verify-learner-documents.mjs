// Offline checks with synthetic data only. No production or database access.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { PDFDocument, PDFName } from "pdf-lib";
const require = createRequire(import.meta.url), modules = new Map();
function load(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} }; modules.set(file, module);
  new Function("require", "module", "exports", code)(name => name.startsWith(".")
    ? load(path.resolve(path.dirname(file), name + ".ts")) : require(name), module, module.exports);
  return module.exports;
}
const { initialValues, documentErrors } = load("src/lib/learner-documents/model.ts");
const { renderLearnerDocument } = load("src/lib/learner-documents/pdf.ts");
const output = "tmp/pdfs/learner-output";
mkdirSync(output, { recursive: true });
const signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAADElEQVR4nGNgGAUAAADIAAGpfRGwAAAAAElFTkSuQmCC";
const values = { ...initialValues("가상수강생", "learner@example.invalid", "실버푸드전문가양성과정"),
  phone: "010-0000-0000", gender: "female", birthDate: "1990-02-28", address: "울산광역시 동구 가상로 123, 101동 1001호",
  purposes: ["취업", "재교육", "기타"], privacy: "yes", publicity: "no", portrait: "yes",
  residentFront: "900228", residentBack: "2000000", bank: "가상은행", account: "000-000000-00000", accountHolder: "가상수강생",
  signedOn: "2026-09-22", signature };
for (const type of ["application", "scholarship"]) {
  const assets = { template: readFileSync(`public/forms/learner-${type}.pdf`), regular: readFileSync("public/fonts/KoPubDotum-Medium.ttf"), bold: readFileSync("public/fonts/KoPubDotum-Bold.ttf") };
  assert.deepEqual(documentErrors(type, values), {});
  assert.deepEqual(documentErrors(type, { ...values, privacy: "no" }), {}, "Declining consent must remain possible");
  for (const [suffix, input] of [["filled", values], ["blank", initialValues()], ["declined", { ...values, privacy: "no", publicity: "no", portrait: "no", signature: "" }]]) {
    const bytes = await renderLearnerDocument(type, input, assets);
    assert.equal(Buffer.from(bytes.slice(0, 9)).toString(), "%PDF-1.7\n");
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), 1);
    assert.deepEqual(pdf.getPage(0).getSize(), { width: 595, height: 842 });
    assert.equal(pdf.catalog.get(PDFName.of("Version")).toString(), "/1.7");
    writeFileSync(`${output}/${type}-${suffix}.pdf`, bytes);
  }
  assert(documentErrors(type, { ...values, signature: "" }).signature);
  assert(documentErrors(type, { ...values, privacy: "" }).privacy);
  assert(documentErrors(type, { ...values, signedOn: "2026-02-30" }).signedOn);
  assert(documentErrors(type, { ...values, phone: "not a number" }).phone);
  await assert.rejects(renderLearnerDocument(type, { ...values, courseName: "가".repeat(101) }, assets), /칸보다 깁니다/);
  await assert.rejects(renderLearnerDocument(type, { ...values, name: "😀" }, assets), /지원하지 않는 문자/);
  await assert.rejects(renderLearnerDocument(type, { ...values, signature: "https://example.invalid/sign.png" }, assets), /서명 이미지/);
  console.log(`PASS ${type}: 1.7 header/catalog, original A4 page, blank/filled/declined, required values, overflow, unsupported glyphs, signature boundary`);
}
assert(documentErrors("application", { ...values, birthDate: "2026-02-30" }).birthDate);
assert(documentErrors("application", { ...values, purposes: [] }).purposes);
assert(documentErrors("scholarship", { ...values, residentFront: "900230" }).residentFront);
assert(documentErrors("scholarship", { ...values, residentBack: "123" }).residentBack);
assert(documentErrors("scholarship", { ...values, account: "not an account" }).account);
console.log("PASS document-specific date, purpose, resident-number format and bank-account checks");
console.log(`Synthetic PDFs: ${output}`);
