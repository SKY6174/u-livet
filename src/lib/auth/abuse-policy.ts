import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export type AuthAttempt = "login" | "signup" | "recovery" | "reset";
export const AUTH_BUSY_MESSAGE =
  "요청이 잠시 많습니다. 대기 시간이 지나면 다시 시도해 주세요. 입력한 내용은 그대로 유지됩니다.";
export const AUTH_UNAVAILABLE_MESSAGE =
  "로그인 보안 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요. 계속 문제가 있으면 사업단에 문의해 주세요.";
export const BOT_RETRY_MESSAGE =
  "보안 확인을 다시 진행해 주세요. 확인이 끝나면 아래 버튼을 눌러 주세요.";

export function normalizeNetwork(value: string | null): string {
  const ip = value?.trim() ?? "";
  if (isIP(ip) === 4) return `v4:${ip}`;
  if (isIP(ip) !== 6 || ip.includes("%")) return "unknown-network";
  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  const halves = canonical.split("::");
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const groups = (
    halves.length === 2
      ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]
      : left
  ).map((g: string) => parseInt(g, 16));
  if (groups.slice(0, 5).every((v) => v === 0) && groups[5] === 65535) {
    return `v4:${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
  }
  return `v6:${groups
    .slice(0, 4)
    .map((g) => g.toString(16))
    .join(":")}::/64`;
}

export function requestNetwork(
  requestHeaders: Pick<Headers, "get">,
  trustedHeader?: string,
) {
  // The reverse proxy must overwrite this single-value header. Never infer trust
  // from the mere presence of client-supplied X-Forwarded-For / Forwarded.
  if (
    !trustedHeader ||
    !/^[a-z0-9-]+$/.test(trustedHeader) ||
    ["x-forwarded-for", "forwarded"].includes(trustedHeader)
  )
    return "unknown-network";
  return normalizeNetwork(requestHeaders.get(trustedHeader));
}

export function authRequestKeys(
  action: AuthAttempt,
  subject: string,
  network: string,
  secret: string,
) {
  if (secret.length < 32) throw new Error("AUTH_LIMIT_SECRET_REQUIRED");
  const normalized = subject.trim().toLowerCase();
  const digest = (scope: string, values: string[]) =>
    createHmac("sha256", secret)
      .update(JSON.stringify([action, scope, ...values]))
      .digest("hex");
  return {
    p_action: action,
    p_subject: digest("subject", [normalized]),
    p_network: digest("network", [network]),
    p_pair: digest("pair", [normalized, network]),
  };
}

export function botProtectionConfig(env: Record<string, string | undefined>) {
  const loopback = (value: string | undefined) => {
    try {
      const url = new URL(value ?? "");
      return (
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      );
    } catch {
      return false;
    }
  };
  const local =
    loopback(env.AUTH_SITE_ORIGIN) && loopback(env.NEXT_PUBLIC_SUPABASE_URL);
  const siteKey = env.AUTH_TURNSTILE_SITE_KEY?.trim() || null;
  const enabled = env.AUTH_CAPTCHA_ENABLED === "true";
  const nativeRateLimits = env.AUTH_PROFILE === "managed-cloud-v1" &&
    env.SUPABASE_DEPLOYMENT_KIND === "cloud" && env.AUTH_ABUSE_MODE === "native-rate-limits" &&
    env.AUTH_CAPTCHA_ENABLED === "false" && !siteKey;
  const testKey = siteKey !== null && /^[123]x0{8}/.test(siteKey);
  const valid =
    siteKey !== null &&
    /^[a-zA-Z0-9_-]{10,100}$/.test(siteKey) &&
    (local || !testKey);
  return {
    siteKey: enabled && valid ? siteKey : null,
    unavailable: !((enabled && valid) || nativeRateLimits || (local && !enabled && !siteKey)),
  };
}
