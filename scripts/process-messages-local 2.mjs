// Manual, local-only simulation. This script never sends a text message.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
const status = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
assert.equal(
  status.API_URL,
  "http://127.0.0.1:55321",
  "Only the isolated local project is allowed",
);
const job = process.argv[2];
assert.match(job ?? "", /^[0-9a-f-]{36}$/i, "Provide one local test job UUID");
const db = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const claimed = await db.rpc("life_message_test_claim", { j: job });
assert.equal(claimed.error, null, claimed.error?.message);
let count = 0;
for (const item of claimed.data) {
  const result = await db.rpc("life_message_test_finish", {
    d: item.id,
    token: item.token,
  });
  assert.equal(result.error, null, result.error?.message);
  count++;
}
console.log(
  `Local simulation processed ${count} item(s). No SMS sent; no delivery confirmation claimed.`,
);
