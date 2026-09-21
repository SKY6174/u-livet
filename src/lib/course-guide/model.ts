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
};
export type CatalogCourse = Pick<CourseGuide,
  "id" | "name" | "academy" | "summary" | "mode" | "capacity" | "period_label" | "certificate"
> & { teaching_hours: number | null; href: string };
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
export function mergeCatalog(guides: CourseGuide[], offerings: CourseSummary[]): CatalogCourse[] {
  const linked = new Set(guides.map((guide) => guide.offering_id).filter(Boolean));
  return [
    ...guides.map((guide) => ({ ...guide, href: `/courses/${guide.id}` })),
    ...offerings.filter((offering) => !linked.has(offering.id)).map((offering) => ({
      ...offering, period_label: `${offering.starts_on} ~ ${offering.ends_on}`,
      certificate: null, teaching_hours: null, href: `/offerings/${offering.id}`,
    })),
  ];
}
export function filterCatalog(courses: CatalogCourse[], filters: ReturnType<typeof catalogFilters>) {
  const q = filters.q.toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
  return courses.filter((course) => (!filters.mode || course.mode === filters.mode) &&
    (!q || `${course.name} ${course.summary} ${course.academy} ${course.certificate ?? ""}`
      .toLocaleLowerCase("ko-KR").replace(/\s+/g, "").includes(q)));
}
