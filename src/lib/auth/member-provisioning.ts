import "server-only";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { isSchoolEmail } from "@/lib/auth/login-audience";

export function createMemberAdminClient() {
  const config = getSupabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !key) throw new Error("MEMBER_AUTH_UNAVAILABLE");
  return createClient(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function provisionMember(personId: string, email: string, operator: SupabaseClient) {
  const admin = createMemberAdminClient();
  const normalizedEmail = email.trim().toLowerCase();
  if (!isSchoolEmail(normalizedEmail)) throw new Error("MEMBER_SCHOOL_EMAIL_REQUIRED");
  const linked = await admin.from("life_auth_links").select("auth_user_id")
    .eq("person_id", personId).maybeSingle();
  if (linked.error) throw new Error("MEMBER_AUTH_UNAVAILABLE");
  if (linked.data?.auth_user_id) {
    const user = await admin.auth.admin.getUserById(linked.data.auth_user_id);
    if (user.error || user.data.user?.email?.toLowerCase() !== normalizedEmail)
      throw new Error("MEMBER_AUTH_CONFLICT");
    return;
  }

  const nonce = randomBytes(32).toString("hex");
  const permit = await operator.rpc("life_prepare_member_auth", { p_person: personId, p_nonce: nonce });
  if (permit.error) throw new Error("MEMBER_AUTH_UNAVAILABLE");
  const created = await admin.auth.admin.createUser({
    email: normalizedEmail,
    email_confirm: true,
    password: `aA1!${randomBytes(48).toString("base64url")}`,
    user_metadata: { member_provisioning_nonce: nonce },
  });
  if (created.error || !created.data.user) {
    // The Auth transaction may have committed before a network failure.
    const retry = await admin.from("life_auth_links").select("auth_user_id")
      .eq("person_id", personId).maybeSingle();
    if (retry.data?.auth_user_id) {
      const user = await admin.auth.admin.getUserById(retry.data.auth_user_id);
      if (!user.error && user.data.user?.email?.toLowerCase() === normalizedEmail) return;
    }
    throw new Error("MEMBER_AUTH_UNAVAILABLE");
  }
  const linkedAfterCreate = await admin.from("life_auth_links").select("auth_user_id")
    .eq("person_id", personId).maybeSingle();
  if (linkedAfterCreate.error || linkedAfterCreate.data?.auth_user_id !== created.data.user.id)
    throw new Error("MEMBER_AUTH_CONFLICT");
}
