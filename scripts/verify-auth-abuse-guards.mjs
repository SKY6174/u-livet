import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { localAuthAbuseEnv } from "./local-auth-abuse-env.mjs";
const require = createRequire(import.meta.url);
const {
  encodeReply,
} = require("next/dist/compiled/react-server-dom-webpack/client.node");
const status = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
assert.equal(status.API_URL, "http://127.0.0.1:55321");
const fixture = JSON.parse(
  readFileSync("/tmp/uc-life-abuse-browser.json", "utf8"),
);
assert.ok(fixture.email.endsWith("@example.invalid"));
const manifest = JSON.parse(
  readFileSync(".next/server/server-reference-manifest.json", "utf8"),
);
const actionId = Object.entries(manifest.node).find(
  ([, v]) => v.exportedName === "authenticate",
)[0];
const origin = "http://127.0.0.1:3101";
let checks = 0;
const pass = (s) => {
  checks++;
  console.log(`PASS ${s}`);
};
async function isolated(overrides, verify) {
  const env = {
    ...process.env,
    ...localAuthAbuseEnv(),
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    AUTH_SITE_ORIGIN: origin,
    ...overrides,
  };
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-p",
      "3101",
      "-H",
      "127.0.0.1",
    ],
    { env, stdio: "ignore" },
  );
  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      if (child.exitCode !== null)
        throw new Error("Isolated server exited early");
      try {
        if ((await fetch(origin + "/auth/login")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(ready, "isolated server ready");
    const form = new FormData();
    form.set("email", fixture.email);
    form.set("password", fixture.password);
    const r = await fetch(origin + "/auth/login", {
      method: "POST",
      headers: {
        "Next-Action": actionId,
        Accept: "text/x-component",
        Origin: origin,
      },
      body: await encodeReply([{}, form]),
    });
    const body = await r.text();
    const state = JSON.parse(
      body
        .split("\n")
        .find((line) => line.startsWith("1:{"))
        .slice(2),
    );
    verify(state);
  } finally {
    child.kill("SIGTERM");
    await new Promise((r) => child.once("exit", r));
  }
}
await isolated({ AUTH_RATE_LIMIT_SECRET: "" }, (s) =>
  assert.match(s.message, /보안 서비스에 연결하지 못했습니다/),
);
pass("missing limiter secret stops valid login before authentication");
await isolated(
  { SUPABASE_SERVICE_ROLE_KEY: "invalid-local-service-key" },
  (s) => assert.match(s.message, /보안 서비스에 연결하지 못했습니다/),
);
pass("limiter authorization/storage failure stops valid login");
await isolated(
  {
    AUTH_CAPTCHA_ENABLED: "true",
    AUTH_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  },
  (s) => assert.match(s.message, /보안 확인을 다시/),
);
pass("configured app requires CAPTCHA token even with valid password");
await isolated({ AUTH_SITE_ORIGIN: "https://life.example.invalid" }, (s) =>
  assert.match(s.message, /보안 서비스에 연결하지 못했습니다/),
);
pass("remote-site configuration cannot use local CAPTCHA exemption");
const configure = (mode) =>
  execFileSync(process.execPath, ["scripts/configure-auth-local.mjs"], {
    env: { ...process.env, AUTH_LOCAL_CAPTCHA_TEST: mode },
    stdio: ["ignore", "pipe", "pipe"],
  });
const client = () =>
  createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
try {
  configure("fail");
  let r = await client().auth.signInWithPassword({
    email: fixture.email,
    password: fixture.password,
  });
  assert.equal(r.error?.code, "captcha_failed");
  pass("native login rejects missing CAPTCHA token");
  r = await client().auth.signUp({
    email: "captcha-missing@example.invalid",
    password: fixture.password,
  });
  assert.equal(r.error?.code, "captcha_failed");
  pass("native signup rejects missing CAPTCHA token");
  r = await client().auth.resetPasswordForEmail(fixture.email);
  assert.equal(r.error?.code, "captcha_failed");
  pass("native recovery rejects missing CAPTCHA token");
  r = await client().auth.signInWithPassword({
    email: fixture.email,
    password: fixture.password,
    options: { captchaToken: "XXXX.DUMMY.TOKEN.XXXX" },
  });
  assert.equal(r.error?.code, "captcha_failed");
  pass("native provider validation failure rejects correct credentials");
  configure("pass");
  const c = client();
  r = await c.auth.signInWithPassword({
    email: fixture.email,
    password: fixture.password,
    options: { captchaToken: "XXXX.DUMMY.TOKEN.XXXX" },
  });
  assert.equal(r.error, null, r.error?.message);
  assert.ok(r.data.session);
  await c.auth.signOut();
  pass("native Turnstile integration accepts documented passing dummy token");
} finally {
  configure("");
}
console.log(
  `${checks} fail-closed and native CAPTCHA checks passed. Public test keys only; real bot detection not measured.`,
);
