// Check the entire font repertoire, not only the characters in one fixture.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const ROOT = new URL("../", import.meta.url);
const modulePath = new URL("supabase/functions/instructor-documents/consent-assets.ts", ROOT);
const source = readFileSync(modulePath, "utf8");
const exports = {};
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports, Uint8Array, atob, require: createRequire(import.meta.url) });
const assets = exports.loadConsentAssets();
assert.equal(exports.loadConsentAssets(), assets, "Asset decoding must be cached");
const sha256 = data => createHash("sha256").update(data).digest("hex");
for (const [key, metadata] of Object.entries(exports.CONSENT_ASSET_MANIFEST)) {
  const original = readFileSync(new URL(metadata.source, ROOT));
  assert.equal(sha256(original), metadata.sourceSha256, `${key}: regenerate after source changes`);
  const packed = Buffer.from(exports.CONSENT_PACKED_ASSETS[key], "base64");
  assert.equal(sha256(packed), metadata.packedSha256, `${key}: corrupted packed bytes`);
  assert.deepEqual(Buffer.from(assets[key]), original, `${key}: original bytes must be preserved`);
  console.log(`PASS ${key}: all ${original.length} original bytes preserved`);
}
// Conservative source upload budget leaves space below the 5 MB API ceiling.
assert.ok(Buffer.byteLength(source) < 4_000_000, "Embedded assets exceed source upload budget");
const config = readFileSync(new URL("supabase/config.toml", ROOT), "utf8");
assert.ok(!/static_files\s*=/.test(config), "Server-side deployments must not depend on static_files");
const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 2 && args[0] === "--eszip"));
if (args.length) {
  const bytes = statSync(resolve(args[1])).size;
  assert.ok(bytes < 4_800_000, `Edge bundle is ${bytes} bytes; safe deployment budget is 4,800,000`);
  console.log(`PASS complete Edge bundle: ${bytes} bytes`);
}
console.log(`PASS portable assets: ${Buffer.byteLength(source)} source bytes; no external asset service`);
