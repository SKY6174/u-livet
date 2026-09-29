import "server-only";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { authEmailEnabled } from "@/lib/auth/email-config";
import { recoveryOrigin } from "@/lib/auth/recovery";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getPolicies } from "@/lib/portal/data";
import { manualAuthProfile } from "@/lib/auth/member-provisioning";

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
    const profile = await manualAuthProfile(personId);
    if (!profile || profile.email !== email.trim().toLowerCase() || profile.org_id !== orgId) return "failed";
    if (profile.auth_user_id) return profile.activation_complete ? "activated" : "existing";
    const client = createClient(config.url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
    });
    const nonce = randomBytes(32).toString("hex");
    const prepared = await client.rpc("life_prepare_manual_member_invite", {
      p_person: personId, p_nonce: nonce,
    });
    if (prepared.error) throw prepared.error;
    const { error } = await client.auth.admin.inviteUserByEmail(email, {
      data: { member_org_id: orgId, member_group: profile.member_group,
        manual_member_invitation: true, manual_member_invitation_nonce: nonce,
        name: profile.name,
        mobile_phone: profile.mobile_phone, email: profile.email },
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

export async function sendMemberSetupEmail(personId: string): Promise<InvitationResult> {
  if (!authEmailEnabled()) return "failed";
  try {
    const profile = await manualAuthProfile(personId);
    if (!profile?.auth_user_id) return "failed";
    if (profile.activation_complete) return "activated";
    const config = getSupabaseConfig();
    if (!config || !process.env.SUPABASE_SERVICE_ROLE_KEY) return "failed";
    const client = createClient(config.url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
    });
    const current = await client.auth.admin.getUserById(profile.auth_user_id);
    if (current.error || current.data.user?.email?.toLowerCase() !== profile.email) return "failed";
    const lastSent = Date.parse(current.data.user.recovery_sent_at ?? "");
    if (Number.isFinite(lastSent) && Date.now() - lastSent < 10 * 60_000) return "existing";
    if ((await manualAuthProfile(personId))?.activation_complete) return "activated";
    const { error } = await client.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${recoveryOrigin()}/auth/reset-password`,
    });
    if (error) {
      console.error("Manual member setup email failed", { code: error.code, status: error.status });
      return "failed";
    }
    return "sent";
  } catch {
    console.error("Manual member setup email request failed");
    return "failed";
  }
}
