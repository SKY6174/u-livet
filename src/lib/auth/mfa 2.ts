import "server-only";
import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
export type SecurityStatus = {
  active: boolean;
  needs_reset: boolean;
  staff_required: boolean;
  mfa_required: boolean;
  mfa_verified: boolean;
  recent: boolean;
  fresh_minutes: number;
};
export const getSecurityContext = cache(async () => {
  try {
    const client = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user) return null;
    const result = await client.rpc("life_security_status");
    if (result.error || !result.data?.active) return null;
    return { email: user.email ?? "", status: result.data as SecurityStatus };
  } catch {
    return null;
  }
});
