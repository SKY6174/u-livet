import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPolicies } from "@/lib/portal/data";
import { publicSignupEnabled } from "./signup-config";
import { socialReturnTo, type RegistrationState } from "./registration";

export async function getSignupPolicy() {
  if (!publicSignupEnabled()) return undefined;
  const client = await createServerSupabaseClient();
  const result = await client.rpc("life_signup_policy");
  if (result.error || typeof result.data !== "string") return undefined;
  return (await getPolicies("ACCOUNT_PRIVACY", result.data))[0];
}

export async function socialDestination(next: unknown): Promise<string> {
  const client = await createServerSupabaseClient();
  const result = await client.rpc("life_registration_status");
  const state = result.error ? "UNAVAILABLE" : result.data?.state as RegistrationState;
  const target = socialReturnTo(next);
  if (state === "PENDING" && publicSignupEnabled()) return `/auth/complete-signup?next=${encodeURIComponent(target)}`;
  if (state === "COMPLETE") {
    const security = await client.rpc("life_security_status");
    if (!security.error && security.data?.active && !security.data?.needs_reset) {
      const context = await client.rpc("life_login_context");
      if (context.error || !context.data) { await client.auth.signOut(); return "/auth/login?social_error=unavailable"; }
      if (security.data.mfa_required && !security.data.mfa_verified) return `/auth/security?next=${encodeURIComponent(target)}`;
      const identity = await client.rpc("life_identity");
      if (!identity.error && identity.data) return target;
    }
  }
  await client.auth.signOut();
  return `/auth/login?social_error=${state === "EMAIL_LOGIN_REQUIRED" ? "staff" : state === "CLOSED" || state === "PENDING" ? "closed" : "unavailable"}`;
}
