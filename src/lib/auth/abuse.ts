import "server-only";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getBotProtection } from "./bot-config";
import {
  AUTH_BUSY_MESSAGE,
  AUTH_UNAVAILABLE_MESSAGE,
  BOT_RETRY_MESSAGE,
  authRequestKeys,
  requestNetwork,
  type AuthAttempt,
} from "./abuse-policy";
import type { ActionState } from "@/lib/portal/types";

type Result =
  | { allowed: true; captchaToken?: string }
  | {
      allowed: false;
      reason: "limited" | "unavailable" | "captcha";
      state: ActionState;
    };

export async function guardAuthRequest(
  action: AuthAttempt,
  subject: string,
  form: FormData,
  flow: "native" | "oauth" = "native",
): Promise<Result> {
  try {
    const config = getSupabaseConfig();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const secret = process.env.AUTH_RATE_LIMIT_SECRET ?? "";
    const bot = getBotProtection();
    if (!config || !serviceKey || (flow === "native" && bot.unavailable))
      throw new Error("AUTH_GUARD_CONFIGURATION");
    const network = requestNetwork(
      await headers(),
      process.env.AUTH_TRUSTED_IP_HEADER,
    );
    const client = createClient(config.url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(5000) }),
      },
    });
    const result = await client.rpc(
      "life_check_auth_request",
      // OAuth has no email yet. Scope its subject to the trusted network so a
      // single global provider bucket cannot block every learner on the site.
      authRequestKeys(action, flow === "oauth" ? `oauth:${subject}:${network}` : subject, network, secret),
    );
    if (
      result.error ||
      typeof result.data?.allowed !== "boolean" ||
      !Number.isInteger(result.data.retry_after) ||
      result.data.retry_after < 0 ||
      result.data.retry_after > 3600
    )
      throw new Error("AUTH_LIMIT_UNAVAILABLE");
    if (!result.data.allowed)
      return {
        allowed: false,
        reason: "limited",
        state: {
          message: AUTH_BUSY_MESSAGE,
          retryAfter: Math.max(1, result.data.retry_after),
        },
      };
    // Native Auth owns token verification; avoid consuming the one-time token twice.
    const token = String(form.get("cf-turnstile-response") ?? "");
    if (flow === "native" && action !== "reset" && bot.siteKey && (!token || token.length > 2048))
      return {
        allowed: false,
        reason: "captcha",
        state: { message: BOT_RETRY_MESSAGE },
      };
    return { allowed: true, captchaToken: flow === "native" && bot.siteKey ? token : undefined };
  } catch {
    // No account identifiers, tokens, or credentials are logged.
    return {
      allowed: false,
      reason: "unavailable",
      state: { message: AUTH_UNAVAILABLE_MESSAGE },
    };
  }
}

export function authProviderError(error: {
  code?: string;
  status?: number;
}): ActionState | null {
  if (error.code === "captcha_failed") return { message: BOT_RETRY_MESSAGE };
  if (error.status === 429)
    return { message: AUTH_BUSY_MESSAGE, retryAfter: 60 };
  return null;
}
