import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { authRequestKeys } from "../src/lib/auth/abuse-policy.ts";
import { localAuthAbuseEnv } from "./local-auth-abuse-env.mjs";
const require = createRequire(import.meta.url);
const {
  encodeReply,
} = require("next/dist/compiled/react-server-dom-webpack/client.node");
const origin = "http://127.0.0.1:3100";
const manifest = JSON.parse(
  readFileSync(".next/server/server-reference-manifest.json", "utf8"),
);
const status = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
assert.equal(status.API_URL, "http://127.0.0.1:55321");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
const checked = (r) => {
  assert.equal(r.error, null, r.error?.message);
  return r.data;
};
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
const routes = {
  authenticate: "/auth/login",
  register: "/auth/signup",
  requestPasswordReset: "/auth/forgot-password",
  resetPassword: "/auth/reset-password",
};
async function action(name, fields, extraHeaders = {}) {
  const id = Object.entries(manifest.node).find(
    ([, v]) => v.exportedName === name,
  )?.[0];
  assert.ok(id);
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  const r = await fetch(origin + routes[name], {
    method: "POST",
    redirect: "manual",
    headers: {
      "Next-Action": id,
      Accept: "text/x-component",
      Origin: origin,
      ...extraHeaders,
    },
    body: await encodeReply([{}, form]),
  });
  const body = await r.text();
  const resultLine = body.split("\n").find((line) => /^1:\{/.test(line));
  return {
    status: r.status,
    state: resultLine ? JSON.parse(resultLine.slice(2)) : null,
    redirect: r.headers.get("x-action-redirect"),
  };
}
let count = 0;
const pass = (label) => {
  count++;
  console.log(`PASS ${label}`);
};
const email = `abuse-http-${randomUUID()}@example.invalid`;
const password = "localhttptest2026!";
const metadata = {
  name: "인증 제한 검증",
  privacy_policy_id: "20000000-0000-4000-8000-000000000011",
  privacy_accepted: true,
};
const created = checked(
  await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  }),
);
const secret = localAuthAbuseEnv().AUTH_RATE_LIMIT_SECRET;
const subjectKeys = [];
const keys = (op, subject) => {
  const p = authRequestKeys(op, subject, "unknown-network", secret);
  subjectKeys.push(p.p_subject, p.p_pair);
  return p;
};
try {
  const login = await action("authenticate", { email, password });
  assert.ok(login.redirect?.startsWith("/mypage"));
  pass("real login action accepts valid learner credentials");
  const wrong = `missing-${randomUUID()}@example.invalid`;
  const lp = keys("login", wrong);
  for (let i = 0; i < 8; i++) {
    const r = await action(
      "authenticate",
      { email: wrong, password },
      { "X-Forwarded-For": `198.51.100.${i + 1}` },
    );
    assert.match(r.state?.message ?? "", /로그인하지 못했습니다/);
  }
  const limited = await action(
    "authenticate",
    { email: wrong.toUpperCase(), password },
    { "X-Forwarded-For": "203.0.113.1" },
  );
  assert.ok(limited.state.retryAfter > 0);
  assert.match(limited.state.message, /요청이 잠시 많습니다/);
  pass(
    "real login action throttles despite case changes and spoofed forwarding headers",
  );
  const before = sql(
    `select attempts from life_private.auth_request_buckets where scope='login:pair' and key_digest='${lp.p_pair}'`,
  );
  assert.equal(before, "8");
  pass("HTTP guard persists rejected login budget in shared DB");
  const signupEmail = `signup-http-${randomUUID()}@example.invalid`;
  keys("signup", signupEmail);
  const signed = await action("register", {
    email: signupEmail,
    password,
    name: metadata.name,
    privacy_policy_id: metadata.privacy_policy_id,
    privacy_accepted: "on",
  });
  assert.equal(signed.state.ok, true);
  pass("signup action still creates a permitted synthetic learner");
  await action("register", {
    email: signupEmail,
    password,
    name: metadata.name,
  });
  await action("register", {
    email: signupEmail,
    password,
    name: metadata.name,
  });
  assert.ok(
    (
      await action("register", {
        email: signupEmail,
        password,
        name: metadata.name,
      })
    ).state.retryAfter > 0,
  );
  pass("signup guard also covers missing-consent repeated submissions");
  const absent = `absent-${randomUUID()}@example.invalid`;
  keys("recovery", email);
  keys("recovery", absent);
  const known = await action("requestPasswordReset", { email });
  const unknown = await action("requestPasswordReset", { email: absent });
  const repeated = await action("requestPasswordReset", { email });
  assert.deepEqual(known.state, unknown.state);
  assert.deepEqual(known.state, repeated.state);
  assert.equal(known.state.retryAfter, 60);
  pass(
    "known unknown and throttled mail requests return identical response and cooldown",
  );
  const pending = sql(
    `select recovery_sent_at from auth.users where id='${created.user.id}'`,
  );
  await action("requestPasswordReset", { email });
  assert.equal(
    sql(
      `select recovery_sent_at from auth.users where id='${created.user.id}'`,
    ),
    pending,
  );
  pass("repeated website mail request does not trigger another native send");
  const native = createClient(status.API_URL, status.ANON_KEY, options);
  const direct = await native.auth.resetPasswordForEmail(email, {
    redirectTo: origin + "/auth/reset-password",
  });
  assert.equal(direct.error?.status, 429);
  pass("direct native mail API also enforces 60-second cooldown");
  const hash = checked(
    await admin.auth.admin.generateLink({ type: "recovery", email }),
  ).properties.hashed_token;
  keys("reset", hash);
  const reset = await action("resetPassword", {
    token_hash: hash,
    password: "updatedhttptest2026!",
  });
  assert.ok(reset.redirect?.startsWith("/auth/password-updated"));
  pass("real reset completion action changes password through email proof");
  for (let i = 1; i < 5; i++)
    assert.match(
      (
        await action("resetPassword", {
          token_hash: hash,
          password: "updatedhttptest2026!",
        })
      ).state.message,
      /재설정 링크를 사용할 수 없습니다/,
    );
  assert.ok(
    (
      await action("resetPassword", {
        token_hash: hash,
        password: "updatedhttptest2026!",
      })
    ).state.retryAfter > 0,
  );
  pass("consumed recovery token replays are rate limited before native Auth");
  const signin = await native.auth.signInWithPassword({
    email,
    password: "updatedhttptest2026!",
  });
  assert.equal(signin.error, null);
  pass("password changed by protected reset remains usable");
  await native.auth.signOut();
  // Local synthetic browser fixture only; no recovery hash or live session persisted.
  writeFileSync(
    "/tmp/uc-life-abuse-browser.json",
    JSON.stringify({
      email,
      password: "updatedhttptest2026!",
      limitedEmail: wrong,
    }),
    { mode: 0o600 },
  );
  console.log(`${count} auth-abuse HTTP checks passed.`);
} finally {
  // Keep live limiter records until expiry: this test must not provide a reset shortcut.
}
