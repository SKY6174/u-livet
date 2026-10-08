import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OFFICE_POSITIONS, isOfficePosition } from "@/lib/auth/login-audience";
import type { AccountProfile } from "./model";

export async function getAccountProfile(): Promise<AccountProfile | null> {
  try {
    const { data, error } = await (await createServerSupabaseClient()).rpc("life_my_account_profile");
    if (error || !data) return null;
    const profile = data as AccountProfile & { has_profile: boolean; office_position: string | null };
    return { ...profile, job_title: profile.has_profile ? profile.job_title
      : profile.office_position && isOfficePosition(profile.office_position) ? OFFICE_POSITIONS[profile.office_position] : null };
  } catch { return null; }
}
