import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import ts from "typescript";
import vm from "node:vm";
import { ROOT, loadReleases, validateRelease, verifyFrozen, markdown } from "./build-manuals.mjs";

const entries = loadReleases();
let checks = 0;
const check = (label, test) => { test(); checks++; console.log(`PASS ${label}`); };
for (const { release, source } of entries) {
  const dir = join(ROOT, "public/manuals", release.version);
  check(`${release.version}: 원문·배포본 무결성`, () => verifyFrozen(release, source, dir));
  for (const manual of release.manuals) {
    const md = readFileSync(join(dir, `${manual.id}.md`), "utf8");
    check(`${manual.id}: 원문과 배포 텍스트 일치`, () => assert.equal(md, markdown(release, manual)));
    const pdf = await PDFDocument.load(readFileSync(join(dir, `${manual.id}.pdf`)));
    check(`${manual.id}: PDF 메타데이터·본문 페이지`, () => {
      assert.equal(pdf.getTitle(), manual.title); assert.ok(pdf.getPageCount() >= 2);
    });
  }
  const temp = mkdtempSync(join(tmpdir(), "ulife-manual-test-"));
  try {
    cpSync(dir, temp, { recursive: true });
    check("같은 버전의 원문 변경 거부", () => assert.throws(() => verifyFrozen(release, Buffer.concat([source, Buffer.from(" ")]), temp), /원문 변경/));
    writeFileSync(join(temp, "all.pdf"), "changed");
    check("발행 PDF 변경 거부", () => assert.throws(() => verifyFrozen(release, source, temp), /배포파일 변경/));
    rmSync(join(temp, "all.pdf"));
    check("발행 PDF 손실 거부", () => assert.throws(() => verifyFrozen(release, source, temp), /ENOENT/));
    check("대상 중복 거부", () => assert.throws(() => validateRelease({ ...release, manuals: [release.manuals[0], release.manuals[0]] }), /중복/));
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
// Exercise the same server-side selection/search model used by all manual routes.
const source = readFileSync(join(ROOT, "src/lib/manuals/data.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
const sandbox = { exports: {}, require: specifier => JSON.parse(readFileSync(join(ROOT, specifier.replace("@/", "src/")), "utf8")) };
vm.runInNewContext(compiled, sandbox);
const model = sandbox.exports;
const catalogTest = mkdtempSync(join(tmpdir(), "ulife-catalog-test-"));
try {
  mkdirSync(join(catalogTest, "src/content/manuals"), { recursive: true });
  mkdirSync(join(catalogTest, "public/manuals/1.0.0"), { recursive: true });
  writeFileSync(join(catalogTest, "src/content/manuals/releases.json"), JSON.stringify({ current: "1.0.1", versions: ["1.0.1"] }));
  check("발행된 구판의 목록 제거 거부", () => assert.throws(() => loadReleases(catalogTest), /구판 등록 누락/));
} finally { rmSync(catalogTest, { recursive: true, force: true }); }
check("미등록 대상·버전 거부", () => {
  assert.equal(model.getManual("unknown"), null);
  assert.equal(model.getManual("learner", "99.0.0"), null);
  assert.equal(model.getManual("../learner"), null);
});
check("현재·버전 고정 조회 일치", () => {
  assert.equal(model.getManual("learner").release.version, model.CURRENT_MANUAL_VERSION);
  assert.equal(model.getManual("learner", "1.0.0").release.version, "1.0.0");
});
check("본문 검색·복수 단어·결과 없음", () => {
  const release = model.getManualRelease();
  assert.ok(model.searchManuals(release, "QR 출석").some(manual => manual.id === "learner"));
  assert.equal(model.searchManuals(release, "없는검색어987654").length, 0);
  assert.equal(model.searchManuals(release, "").length, release.manuals.length);
});
console.log(`${checks}개 매뉴얼 검사 통과`);
