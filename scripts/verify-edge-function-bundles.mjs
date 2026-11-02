// Verify generated output without installing the build-only dependencies in Vercel.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const ROOT = new URL("../", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("supabase/functions/bundle-manifest.json", ROOT)));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
for (const [path, digest] of Object.entries(manifest.sources)) {
  assert.equal(hash(readFileSync(new URL(path, ROOT))), digest, `${path}: rebuild Edge Functions after source changes`);
}
const config = readFileSync(new URL("supabase/config.toml", ROOT), "utf8");
for (const [name, entry] of Object.entries(manifest.entries)) {
  const bytes = readFileSync(new URL(entry.path, ROOT));
  assert.equal(hash(bytes), entry.sha256, `${name}: generated bundle changed`);
  assert.equal(bytes.length, entry.bytes);
  assert.ok(bytes.length < 4_800_000, `${name}: bundle exceeds safe deployment budget`);
  assert.ok(config.includes(`entrypoint = "./${entry.path.replace(/^supabase\//, "")}"`));
  console.log(`PASS ${name}: ${bytes.length} bytes; source, tool lock and output hashes match`);
}
