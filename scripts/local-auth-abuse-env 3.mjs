import { randomBytes } from "node:crypto";
import {
  constants,
  openSync,
  closeSync,
  readFileSync,
  writeFileSync,
  fstatSync,
  mkdirSync,
} from "node:fs";
import { fileURLToPath } from "node:url";

// Dedicated development-only secret, stable across process restarts; never exported to browser.
export function localAuthAbuseEnv() {
  const dir = new URL("../supabase/.temp/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  const path = fileURLToPath(new URL("auth-rate-secret", dir));
  try {
    const fd = openSync(
      path,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
      0o600,
    );
    try {
      writeFileSync(fd, randomBytes(32).toString("hex"));
    } finally {
      closeSync(fd);
    }
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (
      !stat.isFile() ||
      (stat.mode & 0o077) !== 0 ||
      stat.uid !== process.getuid()
    )
      throw new Error("Local auth secret requires an owned private file");
    const secret = readFileSync(fd, "utf8");
    if (!/^[0-9a-f]{64}$/.test(secret))
      throw new Error("Invalid local auth secret");
    const captchaTest = process.env.AUTH_LOCAL_CAPTCHA_TEST ?? "";
    if (!["", "pass", "fail"].includes(captchaTest))
      throw new Error("Unknown local CAPTCHA test mode");
    return {
      AUTH_RATE_LIMIT_SECRET: secret,
      AUTH_TRUSTED_IP_HEADER: "",
      AUTH_CAPTCHA_ENABLED: captchaTest ? "true" : "false",
      AUTH_TURNSTILE_SITE_KEY: captchaTest ? "1x00000000000000000000AA" : "",
    };
  } finally {
    closeSync(fd);
  }
}
