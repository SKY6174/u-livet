import type { CourseSummary, InstructorName } from "@/lib/portal/types";

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
  status?: string | null; apply_from?: string | null; apply_until?: string | null; ends_on?: string | null;
  instructors?: InstructorName[] | null; organization_slug?: string | null };
export const CATALOG_ORGANIZATIONS = { "uc-anchor": "앵커사업단", "uc-sanhak": "산학협력단" } as const;
export type CatalogOrganization = { id: string; slug: string };

function isGuideRoom(value: string) { return /\d/.test(value) && /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*호?$/.test(value); }

export function splitGuideLocation(location: string) {
  const parts = location.split(",").map(part => part.trim());
  let rooms = 0;
  while (rooms < parts.length && isGuideRoom(parts[rooms])) rooms++;
  return { roomNumber: parts.slice(0, rooms).join(", "), roomName: parts.slice(rooms).join(", ") };
}

export function formatGuideLocation(roomNumber: string, roomName: string): string | null {
  const rooms = roomNumber.trim(), name = roomName.trim();
  if (rooms && rooms.split(",").some(room => !isGuideRoom(room.trim()))) return null;
  const location = [rooms, name].filter(Boolean).join(", ");
  return location.length >= 1 && location.length <= 160 ? location : null;
}

export const GUIDE_WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;
export const MAX_GUIDE_SCHEDULE_ROWS = 7;
export type GuideScheduleRow = { day: string; startTime: string; endTime: string };

function validGuideDate(date: string) {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = Date.parse(date);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === date;
}

export function parseGuidePeriod(period: string, year: number): { startDate: string; endDate: string } | null {
  const part = "(?:(\\d{4})[./-])?(\\d{1,2})[./-](\\d{1,2})\\.?";
  const match = period.replace(/\s+/g, "").match(new RegExp(`^${part}(?:[-–—~]${part})?$`));
  if (!match) return null;
  const startYear = Number(match[1] ?? year);
  const startMonth = Number(match[2]);
  const month = Number(match[5] ?? match[2]);
  const day = Number(match[6] ?? match[3]);
  const endYear = match[4] ? Number(match[4]) : startYear + Number(month < startMonth);
  const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const startDate = iso(startYear, startMonth, Number(match[3]));
  const endDate = iso(endYear, month, day);
  return validGuideDate(startDate) && validGuideDate(endDate) && endDate >= startDate ? { startDate, endDate } : null;
}

export function formatGuidePeriod(startDate: string, endDate: string): string | null {
  if (!validGuideDate(startDate) || !validGuideDate(endDate) || endDate < startDate) return null;
  const start = startDate.split("-").map(Number);
  const end = endDate.split("-").map(Number);
  return `${start[0]}. ${start[1]}. ${start[2]}. - ${start[0] === end[0] ? "" : `${end[0]}. `}${end[1]}. ${end[2]}.`;
}

export function guidePeriodLabel(period: string, year: number) {
  const dates = parseGuidePeriod(period, year);
  return dates ? formatGuidePeriod(dates.startDate, dates.endDate)! : period;
}

function validGuideTime(time: string) { return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time); }

export function formatGuideSchedule(rows: GuideScheduleRow[]): string | null {
  if (!rows.length || rows.length > MAX_GUIDE_SCHEDULE_ROWS || rows.some(row =>
    !GUIDE_WEEKDAYS.some(day => day === row.day) || !validGuideTime(row.startTime) || !validGuideTime(row.endTime) || row.endTime <= row.startTime)) return null;
  const label = rows.map(row => `${row.day} ${row.startTime} - ${row.endTime}`).join("\n");
  return label.length <= 160 ? label : null;
}

export function parseGuideSchedule(label: string): GuideScheduleRow[] | null {
  const rows: GuideScheduleRow[] = [];
  const lines = label.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return null;
  for (const line of lines) {
    const match = line.match(/^([월화수목금토일·,/\s–—~-]+)\s+(\d{2}:\d{2})\s*[-–—~]\s*(\d{2}:\d{2})$/);
    if (!match) return null;
    const group = match[1].trim();
    const range = group.match(/^([월화수목금토일])\s*[-–—~]\s*([월화수목금토일])$/);
    let days: string[];
    if (range) {
      const first = GUIDE_WEEKDAYS.findIndex(day => day === range[1]);
      const last = GUIDE_WEEKDAYS.findIndex(day => day === range[2]);
      if (last < first) return null;
      days = GUIDE_WEEKDAYS.slice(first, last + 1);
    } else {
      if (!/^[월화수목금토일](?:[·,/\s]+[월화수목금토일])*$/.test(group)) return null;
      days = group.split(/[·,/\s]+/);
    }
    rows.push(...days.map(day => ({ day, startTime: match[2], endTime: match[3] })));
  }
  return formatGuideSchedule(rows) ? rows : null;
}

export function guideEndDate(period: string, year: number): string | null {
  return parseGuidePeriod(period, year)?.endDate ?? null;
}

export function courseIsUpcoming(course: Pick<CatalogCourse, "status" | "ends_on">, now = Date.now()) {
  const today = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
  return course.status !== "ARCHIVED" && (!course.ends_on || course.ends_on >= today);
}

export function recruitmentLabel(course: Pick<CatalogCourse, "status" | "apply_from" | "apply_until" | "ends_on">, now = Date.now()) {
  if (!courseIsUpcoming(course, now)) return "운영 완료";
  if (course.status === "CLOSED") return "모집 종료";
  if (course.status === "DRAFT") return "모집 준비 중";
  if (course.status !== "PUBLISHED" || !course.apply_from || !course.apply_until) return "모집 안내 확인";
  if (now < Date.parse(course.apply_from)) return "모집 예정";
  return now < Date.parse(course.apply_until) ? "접수 중" : "접수 종료";
}
export type CatalogSearch = { q?: string | string[]; mode?: string | string[]; view?: string | string[]; state?: string | string[]; org?: string | string[] };
export function catalogFilters(params: CatalogSearch) {
  const org = params.org === "uc-anchor" || params.org === "uc-sanhak" ? params.org : "";
  const q = (typeof params.q === "string" ? params.q : "").trim().slice(0, 100);
  const mode = typeof params.mode === "string" && ["ONLINE", "OFFLINE", "BLENDED"].includes(params.mode) ? params.mode : "";
  const state = params.state === "completed" ? "completed" as const : params.state === "all" ? "all" as const : "current" as const;
  return { org, q, mode, state, view: params.view === "list" ? "list" as const : "cards" as const };
}
export function catalogHref(filters: ReturnType<typeof catalogFilters>, view: "cards" | "list") {
  const query = new URLSearchParams({ view });
  if (filters.org) query.set("org", filters.org);
  if (filters.q) query.set("q", filters.q);
  if (filters.mode) query.set("mode", filters.mode);
  if (filters.state !== "current") query.set("state", filters.state);
  return `/courses?${query}`;
}
export function mergeCatalog(guides: CourseGuideSummary[], offerings: CourseSummary[], organizations: CatalogOrganization[] = []): CatalogCourse[] {
  const organizationById = new Map(organizations.map(org => [org.id, org.slug]));
  const linked = new Set(guides.map((guide) => guide.offering_id).filter(Boolean));
  const offeringById = new Map(offerings.map((offering) => [offering.id, offering]));
  return [
    ...guides.map((guide) => {
      const offering = guide.offering_id ? offeringById.get(guide.offering_id) : null;
      return { ...guide, period_label: guidePeriodLabel(guide.period_label, guide.year), offeringId: guide.offering_id, tuition: offering?.tuition ?? null,
        organization_slug: organizationById.get(offering?.org_id ?? guide.org_id) ?? null,
        status: offering?.status ?? null, apply_from: offering?.apply_from ?? null, apply_until: offering?.apply_until ?? null,
        ends_on: offering?.ends_on ?? guideEndDate(guide.period_label, guide.year),
        href: `/courses/${guide.id}` };
    }),
    ...offerings.filter((offering) => !linked.has(offering.id)).map((offering) => ({
      ...offering, period_label: formatGuidePeriod(offering.starts_on, offering.ends_on) ?? `${offering.starts_on} ~ ${offering.ends_on}`,
      certificate: null, teaching_hours: null, offeringId: offering.id, href: `/offerings/${offering.id}`,
      card_image_url: null, org_id: null,
      organization_slug: organizationById.get(offering.org_id) ?? null,
    })),
  ];
}
export function filterCatalog(courses: CatalogCourse[], filters: ReturnType<typeof catalogFilters>, now = Date.now()) {
  const q = filters.q.toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
  return courses.filter((course) => (!filters.org || course.organization_slug === filters.org) && (filters.state === "all" || (filters.state === "completed" ? !courseIsUpcoming(course, now) : courseIsUpcoming(course, now))) && (!filters.mode || course.mode === filters.mode) &&
    (!q || `${course.name} ${course.summary} ${course.academy} ${course.certificate ?? ""}`
      .toLocaleLowerCase("ko-KR").replace(/\s+/g, "").includes(q)));
}
