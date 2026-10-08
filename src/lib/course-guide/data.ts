import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCourseCards, getCourseInstructorNames } from "@/lib/portal/data";
import type { Identity } from "@/lib/portal/types";
import { CATALOG_ORGANIZATIONS, formatGuideSchedule, guidePeriodLabel, mergeCatalog, parseGuideSchedule, type CatalogOrganization, type CourseGuide, type CourseGuideSummary } from "./model";

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
async function getCatalogOrganizations() {
  try {
    const { data, error } = await (await createServerSupabaseClient())
      .from("life_organizations").select("id,slug").in("slug", Object.keys(CATALOG_ORGANIZATIONS));
    return { organizations: (data ?? []) as CatalogOrganization[], unavailable: !!error };
  } catch {
    return { organizations: [] as CatalogOrganization[], unavailable: true };
  }
}
export async function getCourseCatalog() {
  const [guides, offerings, organizations] = await Promise.all([getGuides(), getCourseCards(), getCatalogOrganizations()]);
  const names = await getCourseInstructorNames(offerings.offerings.map((offering) => offering.id));
  return {
    courses: mergeCatalog(guides.guides, offerings.offerings, organizations.organizations).map((course) => ({
      ...course,
      instructors: !course.offeringId ? [] : names === null ? null : names[course.offeringId] ?? [],
    })),
    unavailable: guides.unavailable || offerings.unavailable || organizations.unavailable,
  };
}
export async function getCourseGuide(id: string) {
  if (id.length > 100 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) return null;
  const { data, error } = await (await createServerSupabaseClient())
    .from("life_course_guides").select(GUIDE_FIELDS).eq("published", true).eq("id", id).maybeSingle();
  if (error) throw new Error("교육과정 안내를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
  if (!data) return null;
  const course = data as CourseGuide;
  const schedule = parseGuideSchedule(course.time_label);
  return { ...course, period_label: guidePeriodLabel(course.period_label, course.year),
    time_label: schedule ? formatGuideSchedule(schedule)! : course.time_label };
}

export function editableGuideOrgs(identity: Identity | null) {
  if (!identity) return [];
  return Array.from(new Set([
    ...identity.roles.filter((entry) => entry.role !== "INSTRUCTOR").map((entry) => entry.org_id),
    ...(identity.member_group === "office" && identity.member_org_id ? [identity.member_org_id] : []),
    ...(identity.member_entry_orgs ?? []).map((entry) => entry.org_id),
  ]));
}

export function canEditGuide(identity: Identity | null, orgId: string | null) {
  return !!orgId && editableGuideOrgs(identity).includes(orgId);
}
