// Real Edge Runtime, frozen prototypes and 2 s CPU budget; no DB, mail or AI calls.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, copyFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { bundleEdgeSource } from "./build-edge-functions.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const folder = resolve(ROOT, "tmp/edge-consent-pdf");
const originalFonts = {
  regular: readFileSync(resolve(ROOT, "public/fonts/KoPubDotum-Medium.ttf")).toString("base64"),
  bold: readFileSync(resolve(ROOT, "public/fonts/KoPubDotum-Bold.ttf")).toString("base64"),
};
for (const dir of ["main", "worker", "function", "ai", "pdf"]) mkdirSync(resolve(folder, dir), { recursive: true });
const fixture = await bundleEdgeSource("supabase/functions/_tests/consent-pdf.ts", "tmp/edge-consent-pdf/worker/index.ts");
writeFileSync(resolve(folder, "worker/index.ts"), fixture.outputFiles[0].contents);
copyFileSync(resolve(ROOT, "supabase/functions/_tests/main.ts"), resolve(folder, "main/index.ts"));
copyFileSync(resolve(ROOT, "supabase/functions/instructor-documents/index.bundle.mjs"), resolve(folder, "function/index.ts"));
copyFileSync(resolve(ROOT, "supabase/functions/operation-report-ai/index.bundle.mjs"), resolve(folder, "ai/index.ts"));
const run = args => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const id = run(["run", "-d", "--rm", "--name", `u-livet-consent-smoke-${process.pid}`,
  "-p", "127.0.0.1::9000", "-v", `${folder}:/test:ro`,
  "public.ecr.aws/supabase/edge-runtime:v1.74.3", "start", "--main-service", "/test/main", "--policy", "oneshot"]);
try {
  const detail = JSON.parse(run(["inspect", id]))[0];
  const port = detail.NetworkSettings.Ports["9000/tcp"][0].HostPort;
  const origin = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 40; i++) {
    try { await fetch(origin, { method: "OPTIONS", signal: AbortSignal.timeout(500) }); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  for (const type of ["PRIVACY_CONSENT", "CRIMINAL_CONSENT", "INTEGRITY_PLEDGE"]) {
    for (const original of [true, false]) {
      const response = await fetch(origin, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, ...(original ? { originalFonts } : {}) }), signal: AbortSignal.timeout(30_000) });
      assert.equal(response.status, 200, `${type}: Edge PDF status ${response.status}`);
      assert.equal(response.headers.get("content-type"), "application/pdf");
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
      writeFileSync(resolve(folder, `pdf/${type}-${original ? "original" : "packed"}.pdf`), bytes);
      console.log(`PASS ${type} ${original ? "original" : "packed"}: ${bytes.length} PDF bytes, ${response.headers.get("x-render-ms")} ms`);
    }
  }
  for (const path of ["/function", "/ai"]) {
    const response = await fetch(origin + path, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "session" }), signal: AbortSignal.timeout(15_000) });
    assert.ok([401, 403].includes(response.status), `Unauthenticated ${path} returned ${response.status}`);
    console.log(`PASS ${path}: unauthenticated request rejected (${response.status})`);
  }
} catch (error) {
  const logs = spawnSync("docker", ["logs", "--tail", "35", id], { encoding: "utf8" });
  console.error(logs.stdout + logs.stderr);
  throw error;
} finally { run(["stop", "--time", "1", id]); }
