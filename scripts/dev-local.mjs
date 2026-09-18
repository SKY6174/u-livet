import { execFileSync, spawn } from "node:child_process";
import { localAuthAbuseEnv } from "./local-auth-abuse-env.mjs";

execFileSync(process.execPath, ["scripts/configure-auth-local.mjs"], {
  stdio: "inherit",
});

// Supply local credentials only to the child process; preserve the user's .env.local.
const status = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
if (status.API_URL !== "http://127.0.0.1:55321")
  throw new Error("Dedicated local Supabase must be running on port 55321.");
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    ...(process.argv.includes("--build")
      ? ["build"]
      : [
          process.argv.includes("--production") ? "start" : "dev",
          "-p",
          "3100",
          "-H",
          "127.0.0.1",
        ]),
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      ...localAuthAbuseEnv(),
      NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
      CERTIFICATE_VERIFY_ORIGIN: "http://127.0.0.1:3100",
      AUTH_SITE_ORIGIN: "http://127.0.0.1:3100",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
