// Start a separate local Supabase without touching an existing project's data.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, symlinkSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const dir = resolve(process.env.APPLICATION_TEST_DB_DIR ?? resolve(tmpdir(), "u-livet-issues-db"));
const configPath = resolve(dir, "supabase/config.toml");
mkdirSync(resolve(dir, "supabase"), { recursive: true });
if (existsSync(configPath)) {
  assert.match(readFileSync(configPath, "utf8"), /^project_id = "uc-life-issues"$/m);
} else {
  const config = readFileSync("supabase/config.toml", "utf8")
    .replace('project_id = "uc-life-core"', 'project_id = "uc-life-issues"')
    .replaceAll("553", "563");
  writeFileSync(configPath, config);
}
for (const name of ["migrations", "templates"]) {
  const path = resolve(dir, "supabase", name);
  if (!existsSync(path)) symlinkSync(resolve("supabase", name), path, "dir");
}
try {
  execFileSync("supabase", ["start", "--workdir", dir, "--exclude", "realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor"],
    { stdio: ["ignore", "pipe", "pipe"] });
} catch {
  // CLI status/start output contains local keys; never include it in reports.
  throw new Error("Dedicated Supabase start failed. Inspect its local containers; no keys were logged.");
}
const status = JSON.parse(execFileSync("supabase", ["status", "--workdir", dir, "-o", "json"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
assert.equal(status.API_URL, "http://127.0.0.1:56321");
console.log(`Dedicated Supabase ready. Run APPLICATION_TEST_DB_DIR=${dir} npm run test:application-flow`);
