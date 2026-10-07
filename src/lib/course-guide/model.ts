import type { CourseSummary } from "@/lib/portal/types";

export type CourseGuide = {
  id: string;
  year: number;
  sort_order: number;
  name: string;
  academy: string;
  summary: string;
  curriculum: string[];
  mode: CourseSummary["mode"];
  capacity: number;
  teaching_hours: number;
  period_label: string;
  schedule_history: string[];
  time_label: string;
  location: string;
  certificate: string | null;
  offering_id: string | null;
  org_id: string;
  card_image_url: string | null;
  revision: number;
};
export type CourseGuideSummary = Omit<CourseGuide,
  "curriculum" | "schedule_history" | "time_label" | "location" | "revision"
>;
export type CatalogCourse = Pick<CourseGuide,
  "id" | "name" | "academy" | "summary" | "mode" | "capacity" | "period_label" | "certificate"
> & { teaching_hours: number | null; href: string; offeringId: string | null; tuition: number | null; card_image_url: string | null; org_id: string | null;
  status?: string | null; apply_from?: string | null; apply_until?: string | null };

export function recruitmentLabel(course: Pick<CatalogCourse, "status" | "apply_from" | "apply_until">, now = Date.now()) {
  if (course.status === "ARCHIVED") return "운영 완료";
  if (course.status === "CLOSED") return "모집 종료";
  if (course.status === "DRAFT") return "모집 준비 중";
  if (course.status !== "PUBLISHED" || !course.apply_from || !course.apply_until) return "모집 안내 확인";
  if (now < Date.parse(course.apply_from)) return "모집 예정";
  return now < Date.parse(course.apply_until) ? "접수 중" : "접수 종료";
}
export type CatalogSearch = { q?: string | string[]; mode?: string | string[]; view?: string | string[] };
export function catalogFilters(params: CatalogSearch) {
  const q = (typeof params.q === "string" ? params.q : "").trim().slice(0, 100);
  const mode = typeof params.mode === "string" && ["ONLINE", "OFFLINE", "BLENDED"].includes(params.mode) ? params.mode : "";
  return { q, mode, view: params.view === "list" ? "list" as const : "cards" as const };
}
export function catalogHref(filters: ReturnType<typeof catalogFilters>, view: "cards" | "list") {
  const query = new URLSearchParams({ view });
  if (filters.q) query.set("q", filters.q);
  if (filters.mode) query.set("mode", filters.mode);
  return `/courses?${query}`;
}
export function mergeCatalog(guides: CourseGuideSummary[], offerings: CourseSummary[]): CatalogCourse[] {
  const linked = new Set(guides.map((guide) => guide.offering_id).filter(Boolean));
  const offeringById = new Map(offerings.map((offering) => [offering.id, offering]));
  return [
    ...guides.map((guide) => {
      const offering = guide.offering_id ? offeringById.get(guide.offering_id) : null;
      return { ...guide, offeringId: guide.offering_id, tuition: offering?.tuition ?? null,
        status: offering?.status ?? null, apply_from: offering?.apply_from ?? null, apply_until: offering?.apply_until ?? null,
        href: `/courses/${guide.id}` };
    }),
    ...offerings.filter((offering) => !linked.has(offering.id)).map((offering) => ({
      ...offering, period_label: `${offering.starts_on} ~ ${offering.ends_on}`,
      certificate: null, teaching_hours: null, offeringId: offering.id, href: `/offerings/${offering.id}`,
      card_image_url: null, org_id: null,
    })),
  ];
}
export function filterCatalog(courses: CatalogCourse[], filters: ReturnType<typeof catalogFilters>) {
  const q = filters.q.toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
  return courses.filter((course) => (!filters.mode || course.mode === filters.mode) &&
    (!q || `${course.name} ${course.summary} ${course.academy} ${course.certificate ?? ""}`
      .toLocaleLowerCase("ko-KR").replace(/\s+/g, "").includes(q)));
}
