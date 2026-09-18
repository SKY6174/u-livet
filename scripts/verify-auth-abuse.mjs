import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  authRequestKeys,
  normalizeNetwork,
  requestNetwork,
  botProtectionConfig,
} from "../src/lib/auth/abuse-policy.ts";

const status = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
assert.equal(
  status.API_URL,
  "http://127.0.0.1:55321",
  "Dedicated local project only",
);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
const anon = createClient(status.API_URL, status.ANON_KEY, options);
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
const checked = (r) => {
  assert.equal(r.error, null, r.error?.message);
  return r.data;
};
const secret = randomUUID().repeat(2);
const keys = (action, subject = randomUUID(), network = randomUUID()) =>
  authRequestKeys(action, subject, network, secret);
const hit = async (p, client = admin) =>
  checked(await client.rpc("life_check_auth_request", p));
let count = 0;
const pass = (label) => {
  count++;
  console.log(`PASS ${label}`);
};
const ownKeys = new Set();
const own = (p) => {
  for (const key of [p.p_subject, p.p_network, p.p_pair]) ownKeys.add(key);
  return p;
};
try {
  const base = own(keys("login"));
  assert.ok((await anon.rpc("life_check_auth_request", base)).error);
  pass("anonymous cannot spend or reset rate budgets");
  assert.ok((await anon.rpc("life_prune_auth_requests")).error);
  pass("anonymous cannot prune rate budgets");
  assert.equal(
    sql(
      "select count(*) from information_schema.role_table_grants where table_schema='life_private' and table_name='auth_request_buckets' and grantee in ('anon','authenticated','service_role','PUBLIC')",
    ),
    "0",
  );
  assert.equal(
    sql(
      "select relrowsecurity from pg_class where oid='life_private.auth_request_buckets'::regclass",
    ),
    "t",
  );
  pass("private counters have RLS and no direct API grants");
  assert.equal(
    sql(
      "select count(*) from information_schema.routine_privileges where routine_schema='public' and routine_name in ('life_check_auth_request','life_prune_auth_requests') and grantee in ('anon','authenticated','PUBLIC')",
    ),
    "0",
  );
  pass("authenticated users have no limiter or pruning RPC execution");
  for (const mutation of [
    { p_action: "unknown" },
    { p_subject: "person@example.invalid" },
    { p_network: null },
    { p_pair: "0" },
  ])
    assert.ok(
      (await admin.rpc("life_check_auth_request", { ...base, ...mutation }))
        .error,
    );
  pass("invalid operations and unhashed identifiers rejected at DB boundary");
  assert.equal((await hit(base)).allowed, true);
  pass("service-only first request allowed");
  for (let i = 1; i < 8; i++) assert.equal((await hit(base)).allowed, true);
  const denied = await hit(base);
  assert.equal(denied.allowed, false);
  assert.ok(denied.retry_after > 290 && denied.retry_after <= 300);
  pass("login pair allows 8 and blocks 9th with bounded wait");
  const before = sql(
    `select attempts||':'||expires_at from life_private.auth_request_buckets where scope='login:pair' and key_digest='${base.p_pair}'`,
  );
  await hit(base);
  assert.equal(
    sql(
      `select attempts||':'||expires_at from life_private.auth_request_buckets where scope='login:pair' and key_digest='${base.p_pair}'`,
    ),
    before,
  );
  pass("denied attempts do not extend the lockout or counter");
  sql(
    `update life_private.auth_request_buckets set expires_at=now()-interval '1 second' where key_digest='${base.p_pair}'`,
  );
  assert.equal((await hit(base)).allowed, true);
  pass("expired window automatically permits retry");
  const parallel = own(keys("login"));
  const results = await Promise.all(
    Array.from({ length: 24 }, () => hit(parallel)),
  );
  assert.equal(results.filter((r) => r.allowed).length, 8);
  pass("24 concurrent requests allow exactly 8 without race");
  const account = randomUUID();
  for (let i = 0; i < 30; i++)
    assert.equal((await hit(own(keys("login", account)))).allowed, true);
  assert.equal((await hit(own(keys("login", account)))).allowed, false);
  pass("distributed networks share account ceiling");
  const net = randomUUID();
  for (let i = 0; i < 60; i++)
    assert.equal(
      (await hit(own(keys("login", randomUUID(), net)))).allowed,
      true,
    );
  assert.equal(
    (await hit(own(keys("login", randomUUID(), net)))).allowed,
    false,
  );
  pass("password spraying across accounts shares network ceiling");
  const signup = own(keys("signup"));
  for (let i = 0; i < 3; i++) assert.equal((await hit(signup)).allowed, true);
  assert.equal((await hit(signup)).allowed, false);
  pass("signup subject limited to 3 per hour");
  const signupNet = randomUUID();
  for (let i = 0; i < 10; i++)
    assert.equal(
      (await hit(own(keys("signup", randomUUID(), signupNet)))).allowed,
      true,
    );
  assert.equal(
    (await hit(own(keys("signup", randomUUID(), signupNet)))).allowed,
    false,
  );
  pass("signup network limited to 10 per hour");
  const recovery = own(keys("recovery"));
  assert.equal((await hit(recovery)).allowed, true);
  const fast = await hit(recovery);
  assert.equal(fast.allowed, false);
  assert.ok(fast.retry_after <= 60);
  pass("reset mail cooldown enforced on server");
  for (let i = 0; i < 2; i++) {
    sql(
      `update life_private.auth_request_buckets set expires_at=now()-interval '1 second' where scope='recovery:cooldown' and key_digest='${recovery.p_subject}'`,
    );
    assert.equal((await hit(recovery)).allowed, true);
  }
  sql(
    `update life_private.auth_request_buckets set expires_at=now()-interval '1 second' where scope='recovery:cooldown' and key_digest='${recovery.p_subject}'`,
  );
  assert.equal((await hit(recovery)).allowed, false);
  pass("reset mail total capped at 3 even after individual cooldowns");
  const recoveryNet = randomUUID();
  for (let i = 0; i < 10; i++)
    assert.equal(
      (await hit(own(keys("recovery", randomUUID(), recoveryNet)))).allowed,
      true,
    );
  assert.equal(
    (await hit(own(keys("recovery", randomUUID(), recoveryNet)))).allowed,
    false,
  );
  pass("mail spraying across addresses has network ceiling");
  const reset = own(keys("reset"));
  for (let i = 0; i < 5; i++) assert.equal((await hit(reset)).allowed, true);
  assert.equal((await hit(reset)).allowed, false);
  pass("recovery completion proof capped at 5 attempts");
  const resetNet = randomUUID();
  for (let i = 0; i < 30; i++)
    assert.equal(
      (await hit(own(keys("reset", randomUUID(), resetNet)))).allowed,
      true,
    );
  assert.equal(
    (await hit(own(keys("reset", randomUUID(), resetNet)))).allowed,
    false,
  );
  pass("recovery completion network capped at 30 attempts");
  assert.equal((await hit(own(keys("recovery", account, net)))).allowed, true);
  pass("login restrictions do not consume recovery budgets");
  assert.deepEqual(
    authRequestKeys("login", " PERSON@Example.Invalid ", "net", secret),
    authRequestKeys("login", "person@example.invalid", "net", secret),
  );
  assert.notEqual(
    authRequestKeys("signup", "person@example.invalid", "net", secret)
      .p_subject,
    authRequestKeys("login", "person@example.invalid", "net", secret).p_subject,
  );
  pass("email normalization and scoped HMAC prevent simple casing bypass");
  assert.throws(() => authRequestKeys("login", "x", "net", "weak"));
  pass("missing or short HMAC secret fails closed");
  const hostile = new Headers({
    "x-forwarded-for": "198.51.100.9",
    "x-client-ip": "198.51.100.10",
  });
  assert.equal(requestNetwork(hostile), "unknown-network");
  assert.equal(requestNetwork(hostile, "x-forwarded-for"), "unknown-network");
  assert.equal(requestNetwork(hostile, "x-client-ip"), "v4:198.51.100.10");
  pass(
    "untrusted forwarding headers ignored unless explicit single-IP contract",
  );
  assert.equal(normalizeNetwork("1.2.3.4, 5.6.7.8"), "unknown-network");
  assert.equal(normalizeNetwork("bad"), "unknown-network");
  assert.equal(normalizeNetwork("fe80::1%en0"), "unknown-network");
  pass("invalid multiple or zoned IP addresses use conservative bucket");
  assert.equal(
    normalizeNetwork("2001:db8:abcd:1234::1"),
    normalizeNetwork("2001:0db8:abcd:1234:ffff::2"),
  );
  assert.equal(
    normalizeNetwork("::ffff:192.0.2.4"),
    normalizeNetwork("192.0.2.4"),
  );
  pass("IPv6 /64 and IPv4-mapped aliases normalize consistently");
  assert.equal(botProtectionConfig({}).unavailable, true);
  const local = {
    AUTH_SITE_ORIGIN: "http://127.0.0.1:3100",
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  };
  assert.deepEqual(botProtectionConfig(local), {
    siteKey: null,
    unavailable: false,
  });
  assert.equal(
    botProtectionConfig({
      ...local,
      NEXT_PUBLIC_SUPABASE_URL: "https://remote.supabase.co",
    }).unavailable,
    true,
  );
  pass(
    "local bypass requires both fixed loopback origins; remote fails closed",
  );
  const turnstile = {
    AUTH_CAPTCHA_ENABLED: "true",
    AUTH_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  };
  assert.equal(
    botProtectionConfig({ ...local, ...turnstile }).unavailable,
    false,
  );
  assert.equal(
    botProtectionConfig({
      ...turnstile,
      AUTH_SITE_ORIGIN: "https://life.example.invalid",
      NEXT_PUBLIC_SUPABASE_URL: "https://remote.supabase.co",
    }).unavailable,
    true,
  );
  pass("documented CAPTCHA test key permitted only locally");
  const prune = own(keys("login"));
  await hit(prune);
  sql(
    `update life_private.auth_request_buckets set expires_at=now()-interval '25 hours' where key_digest='${prune.p_pair}'`,
  );
  assert.ok(checked(await admin.rpc("life_prune_auth_requests")) >= 1);
  assert.equal(
    sql(
      `select count(*) from life_private.auth_request_buckets where key_digest='${prune.p_pair}'`,
    ),
    "0",
  );
  pass("service cleanup deletes expired records and leaves live budgets");
  assert.equal(
    sql(
      `select count(*) from life_private.auth_request_buckets where key_digest='${prune.p_network}'`,
    ),
    "1",
  );
  pass("cleanup preserves active counters");
  console.log(`${count} auth-abuse checks passed.`);
} finally {
  // Only these random synthetic test digests; never erase all runtime counters.
  if (ownKeys.size)
    sql(
      `delete from life_private.auth_request_buckets where key_digest in (${[...ownKeys].map((k) => `'${k}'`).join(",")})`,
    );
}
