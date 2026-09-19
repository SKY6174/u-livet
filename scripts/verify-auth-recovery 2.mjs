import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const status = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
assert.equal(status.API_URL, "http://127.0.0.1:55321");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
const client = () => createClient(status.API_URL, status.ANON_KEY, options);
const sql = (query) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_uc-life-core",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-tA",
    ],
    { input: query, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
const checked = (response) => {
  assert.equal(response.error, null, response.error?.message);
  return response.data;
};
let checks = 0;
const pass = (label) => {
  checks++;
  console.log(`PASS ${label}`);
};
const metadata = {
  name: "복구 검증 학습자",
  privacy_policy_id: "20000000-0000-4000-8000-000000000011",
  privacy_accepted: true,
};
const OLD = "recoveryfirst2026!",
  NEW = "recoverysecond2026!";

if (process.argv.includes("--upgrade-local-fixtures")) {
  let count = 0;
  for (let page = 1; ; page++) {
    const users = checked(
      await admin.auth.admin.listUsers({ page, perPage: 1000 }),
    ).users;
    for (const user of users) {
      if (!user.email?.endsWith("@example.invalid")) continue;
      checked(
        await admin.auth.admin.updateUserById(user.id, {
          password: "Local-Only-2026!",
        }),
      );
      count++;
    }
    if (users.length < 1000) break;
  }
  console.log(
    `Upgraded ${count} synthetic @example.invalid fixtures on the isolated local service.`,
  );
}

async function account(prefix, password = OLD) {
  const email = `${prefix}-${randomUUID()}@example.invalid`;
  const c = client();
  const data = checked(
    await c.auth.signUp({ email, password, options: { data: metadata } }),
  );
  assert.ok(data.session);
  return { c, email, user: data.user, session: data.session };
}
async function recoveryHash(email) {
  return checked(
    await admin.auth.admin.generateLink({ type: "recovery", email }),
  ).properties.hashed_token;
}

for (const password of [
  "abcdefghijk1",
  "12345678901!",
  "abcdefghijk!",
  "short123!",
]) {
  const r = await client().auth.signUp({
    email: `invalid-${randomUUID()}@example.invalid`,
    password,
    options: { data: metadata },
  });
  assert.equal(r.error?.code, "weak_password");
}
pass("direct Auth signup enforces length, letter, digit and symbol");
for (const password of ["abcdefghij1:", "ABCDEFGHIJ1\\"]) {
  const a = await account("native-characters", password);
  assert.ok(checked(await a.c.rpc("life_identity"))?.id);
  checked(await admin.auth.admin.deleteUser(a.user.id));
}
pass("either letter case, colon and backslash work in the native policy");

const a = await account("recovery-legacy");
const person = checked(await a.c.rpc("life_identity"));
assert.ok(person.id);
pass("new signup receives current credential policy and its own person");
sql(`delete from life_private.credential_state where user_id='${a.user.id}'`);
assert.equal(checked(await a.c.rpc("life_identity")), null);
assert.deepEqual(checked(await a.c.rpc("life_auth_status")), {
  active: true,
  needs_reset: true,
});
pass("legacy credential cannot access person data and is directed to reset");
checked(
  await a.c.auth.updateUser({
    data: { password_policy_version: 1, role: "SYSTEM_ADMIN" },
  }),
);
assert.equal(checked(await a.c.rpc("life_identity")), null);
pass("user metadata cannot fake policy approval or staff access");
// Simulate a storage-only hash re-encryption/re-hash, not a password change.
sql(
  `update auth.users set encrypted_password=extensions.crypt('${OLD}',extensions.gen_salt('bf',10)) where id='${a.user.id}'`,
);
assert.equal(checked(await a.c.rpc("life_identity")), null);
checked(
  await admin.auth.admin.updateUserById(a.user.id, {
    user_metadata: { name: "복구 검증 학습자" },
  }),
);
assert.equal(checked(await a.c.rpc("life_auth_status")).needs_reset, true);
pass(
  "storage-only hash change and later admin metadata edit cannot certify password policy",
);
const tokenHash = await recoveryHash(a.email);
assert.match(tokenHash, /^[a-f0-9]{32,128}$/i);
const recovery = client();
checked(
  await recovery.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" }),
);
assert.equal(checked(await recovery.rpc("life_auth_status")).active, true);
assert.equal(checked(await recovery.rpc("life_identity")), null);
pass(
  "email proof can recover a legacy account without granting portal access first",
);
const weakUpdate = await recovery.auth.updateUser({ password: "abcdefghijk1" });
assert.equal(weakUpdate.error?.code, "weak_password");
pass("direct Auth password update rejects missing symbol");
checked(await recovery.auth.updateUser({ password: NEW }));
assert.equal(checked(await a.c.rpc("life_identity")), null);
assert.equal(checked(await recovery.rpc("life_identity")), null);
pass(
  "password change immediately blocks old and recovery-session JWT data access",
);
checked(await recovery.auth.signOut({ scope: "global" }));
assert.ok(
  (
    await client().auth.refreshSession({
      refresh_token: a.session.refresh_token,
    })
  ).error,
);
pass("global logout revokes previous refresh tokens");
assert.ok(
  (await client().auth.signInWithPassword({ email: a.email, password: OLD }))
    .error,
);
const fresh = client();
checked(await fresh.auth.signInWithPassword({ email: a.email, password: NEW }));
assert.equal(checked(await fresh.rpc("life_identity")).id, person.id);
assert.equal(checked(await fresh.rpc("life_auth_status")).needs_reset, false);
pass(
  "only new password signs in and existing person/history link is preserved",
);
assert.ok(
  (await client().auth.verifyOtp({ token_hash: tokenHash, type: "recovery" }))
    .error,
);
pass("recovery token cannot be replayed");
const staleAccess = (await fresh.auth.getSession()).data.session.access_token;
checked(await fresh.auth.signOut());
const stale = createClient(status.API_URL, status.ANON_KEY, {
  ...options,
  global: { headers: { Authorization: `Bearer ${staleAccess}` } },
});
assert.equal(checked(await stale.rpc("life_identity")), null);
pass(
  "signed-out access JWT cannot use DB identity despite remaining JWT lifetime",
);

const expired = await recoveryHash(a.email);
sql(
  `update auth.users set recovery_sent_at=now()-interval '20 minutes' where id='${a.user.id}'`,
);
assert.ok(
  (await client().auth.verifyOtp({ token_hash: expired, type: "recovery" }))
    .error,
);
pass("expired recovery token is refused");
assert.ok(
  (
    await client().auth.verifyOtp({
      token_hash: "0".repeat(64),
      type: "recovery",
    })
  ).error,
);
pass("fabricated token is refused");
checked(
  await admin.auth.admin.updateUserById(a.user.id, { ban_duration: "24h" }),
);
assert.ok(
  (await client().auth.signInWithPassword({ email: a.email, password: NEW }))
    .error,
);
pass("blocked account does not regain access through password sign-in");
checked(await admin.auth.admin.deleteUser(a.user.id));

const browser = await account("recovery-browser");
const browserPerson = checked(await browser.c.rpc("life_identity"));
const request = await client().auth.resetPasswordForEmail(browser.email, {
  redirectTo: "http://127.0.0.1:3100/auth/reset-password",
});
checked(request);
let message;
for (let attempt = 0; attempt < 10; attempt++) {
  const list = await (
    await fetch(
      `http://127.0.0.1:55324/api/v1/search?query=${encodeURIComponent(`to:${browser.email}`)}`,
    )
  ).json();
  if (list.messages?.length) {
    message = await (
      await fetch(
        `http://127.0.0.1:55324/api/v1/message/${list.messages[0].ID}`,
      )
    ).json();
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
}
assert.ok(message?.HTML?.includes("새 비밀번호"));
const match = message.HTML.match(
  /http:\/\/127\.0\.0\.1:3100\/auth\/reset-password#token_hash=([a-f0-9]+)/i,
);
assert.ok(match);
pass("real recovery email arrives in local mailbox with Korean fragment link");
writeFileSync(
  "/tmp/uc-life-recovery-browser.json",
  JSON.stringify({
    email: browser.email,
    userId: browser.user.id,
    personId: browserPerson.id,
    tokenHash: match[1],
    accessToken: browser.session.access_token,
    refreshToken: browser.session.refresh_token,
    oldPassword: OLD,
    newPassword: NEW,
  }),
  { mode: 0o600 },
);
await browser.c.auth.signOut({ scope: "local" });
pass("cross-browser recovery fixture is prepared without a login cookie");
console.log(
  `Auth recovery verification passed: ${checks} checks. Local synthetic data only.`,
);
