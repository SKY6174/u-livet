import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import http from "node:http";

const NAME = "supabase_auth_uc-life-core";
const BACKUP = `${NAME}_policy_backup`;
const run = (args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const inspect = (name) => JSON.parse(run(["inspect", name]))[0];
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
const old = inspect(NAME);
assert.equal(old.Config.Labels["com.supabase.cli.project"], "uc-life-core");
assert.equal(old.State.Running, true);
assert.equal(old.Mounts.length, 0, "Auth must not have data volumes");
const symbols = Array.from({ length: 94 }, (_, i) =>
  String.fromCharCode(i + 33),
)
  .filter((c) => !/[a-zA-Z0-9]/.test(c))
  .join("");
const requirements = `abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789:${symbols.replaceAll(":", "\\:")}`;
const captchaTest = process.env.AUTH_LOCAL_CAPTCHA_TEST ?? "";
assert.ok(
  ["", "pass", "fail"].includes(captchaTest),
  "Unknown local CAPTCHA test mode",
);
const expected = {
  GOTRUE_PASSWORD_MIN_LENGTH: "12",
  GOTRUE_PASSWORD_REQUIRED_CHARACTERS: requirements,
  GOTRUE_MFA_TOTP_ENROLL_ENABLED: "true",
  GOTRUE_MFA_TOTP_VERIFY_ENABLED: "true",
  GOTRUE_SMTP_MAX_FREQUENCY: "60s",
  // Public Cloudflare test keys, only on the asserted dedicated local project.
  GOTRUE_SECURITY_CAPTCHA_ENABLED: captchaTest ? "true" : "false",
  GOTRUE_SECURITY_CAPTCHA_PROVIDER: captchaTest ? "turnstile" : "",
  GOTRUE_SECURITY_CAPTCHA_SECRET:
    captchaTest === "pass"
      ? "1x0000000000000000000000000000000AA"
      : captchaTest === "fail"
        ? "2x0000000000000000000000000000000AA"
        : "",
};
const env = Object.fromEntries(
  old.Config.Env.map((item) => {
    const p = item.indexOf("=");
    return [item.slice(0, p), item.slice(p + 1)];
  }),
);
if (Object.entries(expected).every(([key, value]) => env[key] === value)) {
  console.log(
    "Local Auth policy matches: password rules, TOTP, and 60-second email cooldown.",
  );
  process.exit(0);
}
const endpoint =
  process.env.DOCKER_HOST ||
  run(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]);
assert.ok(
  endpoint.startsWith("unix://"),
  "Only local Docker UNIX sockets are allowed",
);
const socketPath = endpoint.slice(7);
assert.ok(socketPath.startsWith("/"));
assert.equal(
  run(["ps", "-a", "--filter", `name=^/${BACKUP}$`, "--format", "{{.Names}}"]),
  "",
  "A previous backup needs manual recovery before retrying",
);
const networks = Object.fromEntries(
  Object.entries(old.NetworkSettings.Networks).map(([name, network]) => [
    name,
    {
      Aliases: (network.Aliases ?? []).filter(
        (alias) => alias !== old.Id.slice(0, 12),
      ),
    },
  ]),
);
assert.deepEqual(Object.keys(networks), ["supabase_network_uc-life-core"]);
const body = JSON.stringify({
  ...old.Config,
  Env: Object.entries({ ...env, ...expected }).map(
    ([key, value]) => `${key}=${value}`,
  ),
  HostConfig: old.HostConfig,
  NetworkingConfig: { EndpointsConfig: networks },
});
const create = () =>
  new Promise((resolve, reject) => {
    const request = http.request(
      {
        socketPath,
        path: `/containers/create?name=${NAME}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (response) => {
        response.resume();
        response.on("end", () =>
          response.statusCode === 201
            ? resolve()
            : reject(new Error("Could not create the local Auth replacement")),
        );
      },
    );
    request.on("error", () =>
      reject(new Error("Could not contact local Docker")),
    );
    request.setTimeout(15000, () => request.destroy());
    request.end(body);
  });
let backedUp = false;
let stopped = false;
try {
  run(["stop", NAME]);
  stopped = true;
  run(["rename", NAME, BACKUP]);
  backedUp = true;
  await create();
  run(["start", NAME]);
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const current = inspect(NAME);
    if (current.State.Health?.Status === "healthy") {
      ready = true;
      break;
    }
    if (!current.State.Running || current.State.Health?.Status === "unhealthy")
      break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.ok(ready, "Replacement Auth did not become healthy");
  run(["rm", BACKUP]);
  backedUp = false;
  console.log(
    "Local Auth policy applied and health verified. Database and other services preserved.",
  );
} catch {
  if (backedUp) {
    try {
      run(["rm", "-f", NAME]);
    } catch {
      /* The replacement may not have been created. */
    }
    run(["rename", BACKUP, NAME]);
    run(["start", NAME]);
  } else if (stopped) {
    run(["start", NAME]);
  }
  throw new Error(
    "Local Auth policy update failed; original container restored. No credentials were logged.",
  );
}
