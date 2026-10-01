import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCourseCards } from "@/lib/portal/data";
import { mergeCatalog, type CourseGuide, type CourseGuideSummary } from "./model";

const GUIDE_FIELDS = "id,year,sort_order,name,academy,summary,curriculum,mode,capacity,teaching_hours,period_label,schedule_history,time_label,location,certificate,offering_id,org_id,card_image_url,revision";
const GUIDE_SUMMARY_FIELDS = "id,year,sort_order,name,academy,summary,mode,capacity,teaching_hours,period_label,certificate,offering_id,org_id,card_image_url";
async function getGuides() {
  try {
    const { data, error } = await (await createServerSupabaseClient())
      .from("life_course_guides").select(GUIDE_SUMMARY_FIELDS).eq("published", true)
      .order("year", { ascending: false }).order("sort_order");
    return { guides: (data ?? []) as CourseGuideSummary[], unavailable: !!error };
  } catch {
    return { guides: [] as CourseGuideSummary[], unavailable: true };
  }
}
export async function getCourseCatalog() {
  const [guides, offerings] = await Promise.all([getGuides(), getCourseCards()]);
  return {
    courses: mergeCatalog(guides.guides, offerings.offerings),
    unavailable: guides.unavailable || offerings.unavailable,
  };
}
export async function getCourseGuide(id: string) {
  if (id.length > 100 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) return null;
  const { data, error } = await (await createServerSupabaseClient())
    .from("life_course_guides").select(GUIDE_FIELDS).eq("published", true).eq("id", id).maybeSingle();
  if (error) throw new Error("교육과정 안내를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
  return data as CourseGuide | null;
}

export function canEditGuide(roles: { role: string; org_id: string }[] | undefined, orgId: string | null) {
  return !!orgId && !!roles?.some((entry) => entry.org_id === orgId &&
    (entry.role === "COURSE_MANAGER" || entry.role === "SYSTEM_ADMIN"));
}
