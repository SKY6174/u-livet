import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { getOffering } from "@/lib/portal/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ReportBundle } from "./types";
export async function getManagedReport(id: string) {
  const me = await requireIdentity(`/admin/offerings/${id}/reports`);
  const offering = await getOffering(id);
  if (
    !offering ||
    !me.roles.some(
      (r) => r.role === "COURSE_MANAGER" && r.org_id === offering.org_id,
    )
  )
    notFound();
  const { data, error } = await (
    await createServerSupabaseClient()
  ).rpc("life_course_report", { f: id });
  return { offering, bundle: error ? null : (data as ReportBundle | null) };
}
