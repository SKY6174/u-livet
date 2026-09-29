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

type ManualAuthProfile = {
  person_id: string;
  auth_user_id: string | null;
  org_id: string;
  member_group: "office" | "instructor" | "learner";
  email: string;
  name: string;
  office_position: string | null;
  instructor_kind: "INTERNAL" | "EXTERNAL" | null;
  office_phone: string | null;
  mobile_phone: string | null;
  instructor_phone: string | null;
  birth_date: string | null;
  activation_complete: boolean;
};

export async function manualAuthProfile(personId: string): Promise<ManualAuthProfile | null> {
  const { data, error } = await createMemberAdminClient().rpc("life_manual_member_auth_profile", { p_person: personId });
  if (error) throw new Error("MEMBER_AUTH_PROFILE_UNAVAILABLE");
  if (!data) return null;
  if (data.person_id !== personId || typeof data.email !== "string"
    || !["office", "instructor", "learner"].includes(data.member_group))
    throw new Error("MEMBER_AUTH_PROFILE_UNAVAILABLE");
  return data as ManualAuthProfile;
}

function manualAuthMetadata(profile: ManualAuthProfile) {
  return {
    name: profile.name,
    email: profile.email,
    member_org_id: profile.org_id,
    member_group: profile.member_group,
    office_position: profile.office_position,
    instructor_kind: profile.instructor_kind,
    office_phone: profile.office_phone,
    mobile_phone: profile.mobile_phone,
    instructor_phone: profile.instructor_phone,
    birth_date: profile.birth_date,
  };
}

export async function syncManualMemberAuthMetadata(personId: string) {
  const profile = await manualAuthProfile(personId);
  if (!profile) return { linked: false, activated: false };
  if (!profile.auth_user_id) return { linked: false, activated: false };
  const admin = createMemberAdminClient();
  const current = await admin.auth.admin.getUserById(profile.auth_user_id);
  if (current.error || current.data.user?.email?.toLowerCase() !== profile.email)
    throw new Error("MEMBER_AUTH_CONFLICT");
  const existing = current.data.user.user_metadata ?? {};
  const metadata = manualAuthMetadata(profile);
  if (Object.entries(metadata).some(([key, value]) => existing[key] !== value)) {
    const updated = await admin.auth.admin.updateUserById(profile.auth_user_id, {
      user_metadata: { ...existing, ...metadata },
    });
    if (updated.error) throw new Error("MEMBER_AUTH_METADATA_UNAVAILABLE");
  }
  return { linked: true, activated: profile.activation_complete };
}

export async function provisionMember(personId: string, email: string, operator: SupabaseClient) {
  const admin = createMemberAdminClient();
  const normalizedEmail = email.trim().toLowerCase();
  if (!isSchoolEmail(normalizedEmail)) throw new Error("MEMBER_SCHOOL_EMAIL_REQUIRED");
  const profile = await manualAuthProfile(personId);
  if (!profile || profile.email !== normalizedEmail) throw new Error("MEMBER_AUTH_CONFLICT");
  if (profile.auth_user_id) return syncManualMemberAuthMetadata(personId);

  const nonce = randomBytes(32).toString("hex");
  const permit = await operator.rpc("life_prepare_member_auth", { p_person: personId, p_nonce: nonce });
  if (permit.error) throw new Error("MEMBER_AUTH_UNAVAILABLE");
  const created = await admin.auth.admin.createUser({
    email: normalizedEmail,
    email_confirm: true,
    password: `aA1!${randomBytes(48).toString("base64url")}`,
    user_metadata: { ...manualAuthMetadata(profile), member_provisioning_nonce: nonce },
  });
  if (created.error || !created.data.user) {
    // The Auth transaction may have committed before a network failure.
    const retry = await manualAuthProfile(personId);
    if (retry?.auth_user_id) return syncManualMemberAuthMetadata(personId);
    throw new Error("MEMBER_AUTH_UNAVAILABLE");
  }
  const linkedAfterCreate = await manualAuthProfile(personId);
  if (linkedAfterCreate?.auth_user_id !== created.data.user.id)
    throw new Error("MEMBER_AUTH_CONFLICT");
  return { linked: true, activated: false };
}
