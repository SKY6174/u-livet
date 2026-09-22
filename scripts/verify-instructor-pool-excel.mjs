// Synthetic XLSX round-trip and boundary tests; no server or personal data.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import ts from "typescript";
import write from "write-excel-file/node";
import read from "read-excel-file/node";
const module = { exports: {} };
new Function(
  "exports",
  ts.transpileModule(readFileSync("src/lib/instructors/pool.ts", "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText,
)(module.exports);
const { parsePoolWorkbook, POOL_COLUMNS } = module.exports;
const row = [
  "가상 엑셀 강사",
  "교외",
  "검증 기관",
  "교육팀",
  "강사",
  "디지털",
  "010-0000-0000",
  "example@example.invalid",
  "=1+1",
];
assert.equal(parsePoolWorkbook([POOL_COLUMNS, row])[0].phone, "01000000000");
assert.equal(
  parsePoolWorkbook([POOL_COLUMNS, row])[0].documents_required,
  true,
);
assert.equal(
  parsePoolWorkbook([
    POOL_COLUMNS,
    [...row.slice(0, 1), "교내", ...row.slice(2)],
  ])[0].documents_required,
  false,
);
for (const kind of ["보조강사", "교외(보조강사)"]) {
  const assistant = parsePoolWorkbook([POOL_COLUMNS, [row[0], kind, ...row.slice(2)]])[0];
  assert.equal(assistant.kind, "EXTERNAL");
  assert.equal(assistant.teaching_role, "ASSISTANT");
  assert.equal(assistant.documents_required, true);
}
assert.throws(() => parsePoolWorkbook([["성명"], row]), /열 이름/);
assert.throws(() => parsePoolWorkbook([POOL_COLUMNS, row, row]), /중복/);
assert.throws(
  () => parsePoolWorkbook([POOL_COLUMNS, ["가상", "구분 없음"]]),
  /교내, 교외 또는 보조강사/,
);
assert.throws(
  () =>
    parsePoolWorkbook([
      POOL_COLUMNS,
      [...row.slice(0, 6), "bad", ...row.slice(7)],
    ]),
  /연락처/,
);
assert.throws(
  () => parsePoolWorkbook([POOL_COLUMNS, [...row, "계좌 원문 금지"]]),
  /서식/,
);
assert.throws(
  () =>
    parsePoolWorkbook([
      POOL_COLUMNS,
      ...Array.from({ length: 201 }, () => row),
    ]),
  /200명/,
);
mkdirSync("tmp/instructor-pool", { recursive: true });
const filename = "tmp/instructor-pool/import.xlsx";
await write(
  [POOL_COLUMNS, row].map((r) => r.map((value) => ({ type: String, value }))),
).toFile(filename);
const sheets = await read(filename);
assert.equal(sheets.length, 1);
assert.deepEqual(sheets[0].data, [POOL_COLUMNS, row]);
assert.equal(parsePoolWorkbook(sheets[0].data)[0].notes, "=1+1");
await write([
  [
    { type: String, value: "=1+1" },
    { type: String, value: "@SUM(1,2)" },
    { type: String, value: "+123" },
    { type: Number, value: 194000 },
  ],
]).toFile("tmp/instructor-pool/export.xlsx");
const exported = await read("tmp/instructor-pool/export.xlsx");
assert.deepEqual(exported[0].data[0], ["=1+1", "@SUM(1,2)", "+123", 194000]);
console.log(
  "18 instructor pool Excel checks passed (including XLSX round-trip and literal formula-like cells).",
);
