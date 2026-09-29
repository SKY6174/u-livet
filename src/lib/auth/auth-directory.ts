import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";

export function createMemberAdminClient() {
  const config = getSupabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !key) throw new Error("MEMBER_AUTH_UNAVAILABLE");
  return createClient(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

type DirectoryProfile = {
  auth_user_id: string;
  member_category: "office" | "internal_instructor" | "external_instructor" | "learner";
  mobile_phone: string | null;
  phone_unique: boolean;
};

const MOBILE_PATTERN = /^\+82(10[0-9]{8}|1[16789][0-9]{7,8})$/;
const MEMBER_CATEGORIES = new Set(["office", "internal_instructor", "external_instructor", "learner"]);

/** Sync display-only Auth fields from the committed member and contact records. */
export async function syncAuthDirectoryFields(target: { userId?: string; personId?: string }) {
  if (!target.userId && !target.personId) throw new Error("MEMBER_AUTH_PROFILE_UNAVAILABLE");
  const admin = createMemberAdminClient();
  const { data, error } = await admin.rpc("life_auth_directory_profile", {
    p_user: target.userId ?? null, p_person: target.personId ?? null,
  });
  if (error) throw new Error("MEMBER_AUTH_PROFILE_UNAVAILABLE");
  if (!data) return false;
  const profile = data as DirectoryProfile;
  if (typeof profile.auth_user_id !== "string" || !MEMBER_CATEGORIES.has(profile.member_category)
    || target.userId && target.userId !== profile.auth_user_id)
    throw new Error("MEMBER_AUTH_PROFILE_UNAVAILABLE");

  const current = await admin.auth.admin.getUserById(profile.auth_user_id);
  if (current.error || !current.data.user) throw new Error("MEMBER_AUTH_CONFLICT");
  const user = current.data.user;
  const phone = profile.phone_unique && profile.mobile_phone && MOBILE_PATTERN.test(profile.mobile_phone)
    ? profile.mobile_phone : "";
  const categoryChanged = user.app_metadata?.member_category !== profile.member_category;
  // GoTrue stores E.164 without the leading plus sign.
  const phoneChanged = (user.phone ?? "") !== phone.replace(/^\+/, "");
  if (!categoryChanged && !phoneChanged) return true;
  if (phoneChanged && user.phone_confirmed_at) throw new Error("MEMBER_AUTH_PHONE_VERIFIED");
  if (phoneChanged && !phone) {
    const cleared = await admin.rpc("life_clear_auth_directory_phone", { p_user: profile.auth_user_id });
    if (cleared.error || cleared.data !== true) throw new Error("MEMBER_AUTH_METADATA_UNAVAILABLE");
  }
  if (!categoryChanged && !phone) return true;
  const updated = await admin.auth.admin.updateUserById(profile.auth_user_id, {
    ...(categoryChanged ? { app_metadata: { ...user.app_metadata, member_category: profile.member_category } } : {}),
    ...(phoneChanged && phone ? { phone } : {}),
  });
  if (updated.error) {
    console.error("Auth directory sync failed", { code: updated.error.code, status: updated.error.status });
    throw new Error("MEMBER_AUTH_METADATA_UNAVAILABLE");
  }
  return true;
}
