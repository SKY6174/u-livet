import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireIdentity } from "@/lib/auth/session";
import { UUID } from "@/lib/portal/data";
import { OPENING_SOURCE, validOpeningValues, type OpeningWorkingCopy } from "./working-copy";

export async function getOpeningWorkingCopy(org: string, source: string) {
  const me = await requireIdentity(`/admin/courses?plan=${source}`);
  const unavailable = { copy: null, unavailable: true };
  if (!UUID.test(org) || !OPENING_SOURCE.test(source) || !me.roles.some(r => r.org_id === org && r.role === "COURSE_MANAGER")) return unavailable;
  try {
    const { data, error } = await (await createServerSupabaseClient()).rpc("life_opening_working_copy", { o: org, source });
    if (error || (data && (!validOpeningValues(data.payload) || !Number.isInteger(data.revision) || data.revision < 1 || !Number.isFinite(Date.parse(data.updated_at))))) return unavailable;
    return { copy: data as OpeningWorkingCopy | null, unavailable: false };
  } catch { return unavailable; }
}
