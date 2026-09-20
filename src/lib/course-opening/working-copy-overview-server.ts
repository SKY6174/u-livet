import "server-only";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import { validOpeningCopySummaries, type OpeningCopyOverview } from "./working-copy-overview";

export async function getOpeningWorkingCopyOverview(): Promise<OpeningCopyOverview> {
  const me = await requireIdentity("/admin/course-plan/opening");
  // Match the organization used by the existing plan registration form.
  const org = me.roles.find(role => role.role === "COURSE_MANAGER")?.org_id;
  const unavailable = { items: [], unavailable: true };
  if (!org || !UUID.test(org)) return unavailable;
  try {
    const { data, error } = await (await createServerSupabaseClient()).rpc("life_opening_working_copy_summaries", { o: org });
    if (error || !validOpeningCopySummaries(data)) return unavailable;
    return { items: data, unavailable: false };
  } catch { return unavailable; }
}
