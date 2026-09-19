import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";

export function createRecoveryClient() {
  const config = getSupabaseConfig();
  if (!config) throw new Error("AUTH_NOT_CONFIGURED");
  return createClient(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function recoveryOrigin() {
  const value = process.env.AUTH_SITE_ORIGIN;
  if (!value) throw new Error("AUTH_SITE_ORIGIN_REQUIRED");
  const url = new URL(value);
  const local =
    url.protocol === "http:" &&
    ["127.0.0.1", "localhost"].includes(url.hostname);
  if (
    (!local && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("INVALID_AUTH_SITE_ORIGIN");
  return url.origin;
}
