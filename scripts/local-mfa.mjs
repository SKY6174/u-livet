// Synthetic local test accounts only. Never imported by application code.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFileSync, writeFileSync, chmodSync } from "node:fs";
const CACHE = "/tmp/uc-life-mfa-fixtures.json";
let localChecked = false;
export function totp(secret, time = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const letter of secret.replace(/=+$/, "").toUpperCase()) {
    const index = alphabet.indexOf(letter);
    assert.ok(index >= 0);
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 30000)));
  const mac = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const offset = mac[mac.length - 1] & 15;
  return ((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
export async function ensureLocalMfa(client) {
  if (!localChecked) {
    const status = JSON.parse(
      execFileSync("supabase", ["status", "-o", "json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
    assert.equal(status.API_URL, "http://127.0.0.1:55321");
    localChecked = true;
  }
  assert.equal(client.supabaseUrl.replace(/\/$/, ""), "http://127.0.0.1:55321");
  const current = await client.auth.getUser();
  assert.ifError(current.error);
  assert.ok(
    current.data.user?.email?.endsWith("@example.invalid"),
    "Synthetic local accounts only",
  );
  const userId = current.data.user.id;
  let cache = {};
  try {
    cache = JSON.parse(readFileSync(CACHE, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const factors = await client.auth.mfa.listFactors();
  assert.ifError(factors.error);
  let entry = cache[userId];
  if (!entry || !factors.data.all.some((f) => f.id === entry.id)) {
    assert.ok(
      !factors.data.all.some((f) => f.status === "verified"),
      "Existing factor has no local fixture secret; do not remove it automatically",
    );
    for (const f of factors.data.all.filter((f) => f.status === "unverified")) {
      const removed = await client.auth.mfa.unenroll({ factorId: f.id });
      assert.ifError(removed.error);
    }
    const permit = await client.rpc("life_prepare_mfa_change", { k: "ENROLL" });
    assert.ifError(permit.error);
    const enrolled = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: permit.data,
      issuer: "U-LIFE TEST",
    });
    assert.ifError(enrolled.error);
    entry = { id: enrolled.data.id, secret: enrolled.data.totp.secret };
    // Merge concurrent synthetic enrollments before the synchronous write.
    try {
      cache = JSON.parse(readFileSync(CACHE, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    cache[userId] = entry;
    writeFileSync(CACHE, JSON.stringify(cache), { mode: 0o600 });
    chmodSync(CACHE, 0o600);
  }
  const verified = await client.auth.mfa.challengeAndVerify({
    factorId: entry.id,
    code: totp(entry.secret),
  });
  assert.ifError(verified.error);
  const status = await client.rpc("life_security_status");
  assert.ifError(status.error);
  assert.equal(status.data.recent, true);
  return entry;
}
