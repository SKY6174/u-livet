import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const tracePath = path.resolve(
  ".next/server/app/mypage/documents/page.js.nft.json",
);
const trace = JSON.parse(readFileSync(tracePath, "utf8"));
assert.ok(Array.isArray(trace.files), "learner document page trace is invalid");

const tracedFiles = new Set(
  trace.files.map((file) => path.resolve(path.dirname(tracePath), file)),
);
const requiredFiles = [
  "public/forms/learner-application.pdf",
  "public/forms/learner-scholarship.pdf",
  "public/forms/learner-refund.pdf",
  "public/fonts/KoPubDotum-Medium.ttf",
  "public/fonts/KoPubDotum-Bold.ttf",
];

for (const file of requiredFiles) {
  const absolute = path.resolve(file);
  assert.ok(tracedFiles.has(absolute), `${file} is missing from the production trace`);
  assert.ok(readFileSync(absolute).byteLength > 1024, `${file} is unexpectedly empty`);
}

console.log(
  `PASS learner document production trace contains ${requiredFiles.length} PDF assets`,
);
