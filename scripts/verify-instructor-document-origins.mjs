// Credential-free regression checks for browser access to the document function.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

const endpoint = "https://uoebygejgglgiivzgyks.supabase.co/functions/v1/instructor-documents";
const origins = ["https://uc-life.org", "https://www.uc-life.org", "https://u-livet.org"];
const rejected = "https://untrusted-origin.invalid";
function inspect(response, origin, allowed = true) {
  assert.equal(response.status, 204, "Expected document CORS preflight response");
  const value = response.headers.get("access-control-allow-origin");
  if (!allowed) { assert.ok(value === null || value === "", "Unknown origin must stay rejected"); return; }
  assert.equal(value, origin, "Document function must allow this exact application origin");
  const list = name => (response.headers.get(name) ?? "").toLowerCase().split(",").map(value => value.trim());
  assert.ok(list("access-control-allow-methods").includes("post"), "Document POST must be allowed");
  for (const header of ["authorization", "apikey", "content-type"]) assert.ok(list("access-control-allow-headers").includes(header), `Missing ${header} preflight permission`);
  assert.ok(list("vary").includes("origin"), "Origin-specific responses must vary by Origin");
}

if (process.argv.includes("--live")) {
  assert.ok(process.argv.includes("--production"), "Explicit production target required");
  const results = [];
  for (const origin of [...origins, rejected]) {
    const response = await fetch(endpoint, { method: "OPTIONS", headers: {
      Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization, apikey, content-type",
    }, signal: AbortSignal.timeout(15000) });
    inspect(response, origin, origin !== rejected);
    results.push({ origin, allowed: origin !== rejected, status: response.status });
    console.log(`PASS ${origin === rejected ? "rejected" : "allowed"} ${origin}`);
  }
  mkdirSync("ops/evidence/production-role-pages", { recursive: true });
  writeFileSync("ops/evidence/production-role-pages/origins-live.json", JSON.stringify({ checkedAt: new Date().toISOString(), endpoint, results }, null, 2) + "\n");
} else {
  const headers = { "Access-Control-Allow-Origin": origins[2], "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", Vary: "Accept-Encoding, Origin" };
  const response = changes => new Response(null, { status: 204, headers: { ...headers, ...changes } });
  let checks = 0;
  for (const origin of origins) { inspect(response({ "Access-Control-Allow-Origin": origin }), origin); checks++; }
  for (const value of ["*", origins[0], origins[2] + ".untrusted.invalid", ""]) { assert.throws(() => inspect(response({ "Access-Control-Allow-Origin": value }), origins[2])); checks++; }
  assert.throws(() => inspect(new Response(null, { status: 403, headers }), origins[2])); checks++;
  assert.throws(() => inspect(response({ "Access-Control-Allow-Methods": "OPTIONS" }), origins[2])); checks++;
  for (const omitted of ["authorization", "apikey", "content-type"]) { assert.throws(() => inspect(response({ "Access-Control-Allow-Headers": ["authorization", "apikey", "content-type"].filter(value => value !== omitted).join(",") }), origins[2])); checks++; }
  assert.throws(() => inspect(response({ Vary: "Accept-Encoding" }), origins[2])); checks++;
  inspect(response({ "Access-Control-Allow-Origin": "" }), rejected, false); checks++;
  assert.throws(() => inspect(response({ "Access-Control-Allow-Origin": rejected }), rejected, false)); checks++;
  console.log(`${checks} instructor document origin regression checks passed`);
}
