import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MonitoringDocument, MonitoringGuide, MonitoringPlan } from "./model";

export async function getAnnualMonitoringData() {
  try {
    const db = await createServerSupabaseClient();
    const [guides, plans, documents] = await Promise.all([
      db.from("life_course_guides")
        .select("id,year,sort_order,name,academy,period_label,offering_id")
        .eq("published", true).eq("year", 2026).order("sort_order"),
      db.rpc("life_monitoring_plans"),
      db.rpc("life_operation_list"),
    ]);
    if (guides.error || plans.error || documents.error || !Array.isArray(plans.data) || !Array.isArray(documents.data))
      return { guides: [], plans: [], documents: [], unavailable: true };
    const linkedIds = new Set((guides.data ?? []).map((guide) => guide.offering_id).filter(Boolean));
    return {
      guides: (guides.data ?? []) as MonitoringGuide[],
      plans: plans.data as MonitoringPlan[],
      documents: (documents.data as MonitoringDocument[])
        .filter((document) => linkedIds.has(document.id))
        .map(({ id, plan_status, result_status }) => ({ id, plan_status, result_status })),
      unavailable: false,
    };
  } catch {
    return { guides: [], plans: [], documents: [], unavailable: true };
  }
}
