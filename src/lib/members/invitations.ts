import "server-only";
import { createClient } from "@supabase/supabase-js";
import { authEmailEnabled } from "@/lib/auth/email-config";
import { recoveryOrigin } from "@/lib/auth/recovery";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getPolicies } from "@/lib/portal/data";

export type InvitationResult = "sent" | "existing" | "activated" | "failed";

export async function canInviteManualMembers(orgId: string) {
  if (!authEmailEnabled() || !getSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    return false;
  try {
    recoveryOrigin();
    return (await getPolicies("ACCOUNT_PRIVACY")).some((policy) => policy.org_id === orgId);
  } catch {
    return false;
  }
}

export async function inviteManualMember(personId: string, email: string, orgId: string): Promise<InvitationResult> {
  const config = getSupabaseConfig();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !serviceKey || !authEmailEnabled()) return "failed";
  try {
    const client = createClient(config.url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
    });
    const { data: link, error: linkError } = await client.from("life_auth_links")
      .select("auth_user_id").eq("person_id", personId).maybeSingle();
    if (linkError) throw linkError;
    if (link) return "activated";
    const { error } = await client.auth.admin.inviteUserByEmail(email, {
      data: { member_org_id: orgId, manual_member_invitation: true },
      redirectTo: `${recoveryOrigin()}/auth/accept-invitation`,
    });
    if (!error) return "sent";
    if (error.code === "email_exists" || error.code === "user_already_exists") return "existing";
    console.error("Manual member invitation failed", { code: error.code, status: error.status });
  } catch {
    console.error("Manual member invitation request failed");
  }
  return "failed";
}
