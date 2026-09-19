import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  getPasswordChecks,
  isValidPassword,
} from "../src/lib/auth/password-policy.ts";

let checks = 0;
const pass = (label) => {
  checks++;
  console.log(`PASS ${label}`);
};
for (const [password, valid, label] of [
  ["abcdefghij1!", true, "exactly 12 characters with lowercase only"],
  ["ABCDEFGHIJ1!", true, "uppercase only is equally valid"],
  ["abcdefghi1!", false, "11-character boundary rejected"],
  ["abcdefghijk1", false, "missing symbol rejected by portal policy"],
  ["abcdefghijk!", false, "missing digit rejected"],
  ["12345678901!", false, "missing letter rejected"],
  ["abcdefghij1 ", false, "space is not a symbol"],
  ["abcdefghij1한", false, "Korean character is not a symbol"],
  ["abcdefghij1🙂", false, "emoji is not a symbol"],
  ["a1!" + "a".repeat(126), false, "over 128 UTF-16 units rejected"],
  ["", false, "empty password rejected"],
  ["abcd1!🙂🙂🙂", false, "unicode code points do not inflate minimum length"],
]) {
  assert.equal(isValidPassword(password), valid, label);
  pass(label);
}
for (let code = 33; code <= 126; code++) {
  const char = String.fromCharCode(code);
  if (/[a-zA-Z0-9]/.test(char)) continue;
  assert.equal(isValidPassword("abcdefghij1" + char), true);
}
assert.equal(getPasswordChecks("abcdefghij1!").filter((c) => c.met).length, 4);
pass("all ASCII punctuation including backslash and brackets is supported");

const status = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
assert.equal(
  status.API_URL,
  "http://127.0.0.1:55321",
  "Only the isolated local project may be tested",
);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
const client = () => createClient(status.API_URL, status.ANON_KEY, options);
const metadata = {
  name: "인증 접근성 검증",
  privacy_policy_id: "20000000-0000-4000-8000-000000000011",
  privacy_accepted: true,
};
const users = [];
try {
  for (const [password, label] of [
    ["abcd1234!", "Auth API rejects fewer than 12 characters"],
    ["abcdefghijk!", "Auth API rejects missing digits"],
    ["12345678901!", "Auth API rejects missing letters"],
  ]) {
    const result = await client().auth.signUp({
      email: `auth-weak-${randomUUID()}@example.invalid`,
      password,
      options: { data: metadata },
    });
    if (result.data.user) users.push(result.data.user.id);
    assert.equal(result.error?.code, "weak_password", label);
    pass(label);
  }
  for (const password of ["abcdefghij1!", "ABCDEFGHIJ1!"]) {
    const email = `auth-valid-${randomUUID()}@example.invalid`;
    const c = client();
    const result = await c.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    assert.equal(result.error, null, result.error?.message);
    users.push(result.data.user.id);
    assert.equal(
      (await c.auth.signInWithPassword({ email, password })).error,
      null,
    );
    const identity = await c.rpc("life_identity");
    assert.equal(identity.error, null);
    assert.deepEqual(identity.data.roles, []);
    pass(
      `Auth signup and login allow ${password[0] === "a" ? "lowercase" : "uppercase"} only without granting staff roles`,
    );
    const update = await c.auth.updateUser({ password: "short123!" });
    assert.equal(update.error?.code, "weak_password");
    pass("Auth password update also enforces 12-character minimum");
    await c.auth.signOut();
  }
  // The custom Auth engine policy now closes the former native preset gap.
  const nativeOnly = await client().auth.signUp({
    email: `auth-native-gap-${randomUUID()}@example.invalid`,
    password: "abcdefghijk1",
    options: { data: metadata },
  });
  assert.equal(nativeOnly.error?.code, "weak_password");
  assert.equal(isValidPassword("abcdefghijk1"), false);
  pass("Auth API also rejects the no-symbol password rejected by the portal");
} finally {
  for (const id of users) {
    const result = await admin.auth.admin.deleteUser(id);
    assert.equal(result.error, null);
  }
}
console.log(
  `Accessible auth verification passed: ${checks} checks. Synthetic local accounts only; custom native policy enforced.`,
);
