export const ACADEMIES = ["스마트테크", "라이프케어", "로컬창업", "팝업"] as const;
export type Academy = (typeof ACADEMIES)[number];
export const AFFILIATIONS = {
  INTERNAL: "교내",
  EXTERNAL: "교외",
  UNCONFIRMED: "확인 필요",
} as const;
export type Affiliation = keyof typeof AFFILIATIONS;
export const BUDGET_LABELS = {
  materials: "재료비",
  printing: "인쇄비",
  instructors: "강사료",
  operations: "운영비",
  support: "보조인력",
  scholarships: "장학금",
} as const;
export type SourceNumber = number | "-" | null;
export type Budget = Record<keyof typeof BUDGET_LABELS | "total", SourceNumber>;
export type Staffing = {
  sourceText: string | null;
  members: { name: string; affiliation: Affiliation }[];
};
export type PlannedCourse = {
  id: string;
  academy: Academy;
  sourceOrder: number;
  task: string;
  title: string;
  capacity: number;
  hours: number;
  recruited: number | null;
  completed: number | null;
  instructors: Staffing;
  assistantInstructors: Staffing;
  supportStaff: Staffing;
  department: string;
  partner: string;
  schedule: {
    startDate: string;
    endDate: string;
    sourcePeriod: string;
    frequency: string;
    time: string;
    location: string;
    weekdays: string;
  };
  budget: Budget;
  certificate: string | null;
  notes: string | null;
};
export type CoursePlan = {
  year: number;
  source: { title: string; fileName: string; page: number; sha256: string };
  academySummaries: {
    academy: Academy;
    capacity: number;
    hours: number;
    budget: Budget;
  }[];
  total: { capacity: number; hours: number; budget: Budget };
  courses: PlannedCourse[];
};
export type CourseFilters = {
  q: string;
  academy: Academy | "";
  affiliation: Affiliation | "";
};
export function normalizeFilters(
  params: Record<string, string | string[] | undefined>,
): CourseFilters {
  const value = (key: string) =>
    typeof params[key] === "string" ? params[key] as string : "";
  const academy = value("academy");
  const affiliation = value("affiliation");
  return {
    q: value("q").trim().slice(0, 100),
    academy: ACADEMIES.includes(academy as Academy) ? academy as Academy : "",
    affiliation: Object.hasOwn(AFFILIATIONS, affiliation)
      ? affiliation as Affiliation
      : "",
  };
}
export function filterCourses(courses: PlannedCourse[], filters: CourseFilters) {
  const query = filters.q.normalize("NFC").toLocaleLowerCase("ko-KR");
  return courses.filter((course) => {
    const text = [
      course.title, course.department, course.partner, course.certificate,
      course.instructors.sourceText, course.assistantInstructors.sourceText,
      course.supportStaff.sourceText,
    ].join(" ").normalize("NFC").toLocaleLowerCase("ko-KR");
    const teachers = [
      ...course.instructors.members,
      ...course.assistantInstructors.members,
    ];
    return (
      (!query || text.includes(query)) &&
      (!filters.academy || course.academy === filters.academy) &&
      (!filters.affiliation || teachers.some((p) => p.affiliation === filters.affiliation))
    );
  });
}
export function sumCourses(courses: PlannedCourse[]) {
  return courses.reduce((sum, course) => ({
    count: sum.count + 1,
    capacity: sum.capacity + course.capacity,
    hours: sum.hours + course.hours,
    budget: sum.budget + (typeof course.budget.total === "number" ? course.budget.total : 0),
  }), { count: 0, capacity: 0, hours: 0, budget: 0 });
}
export function formatSourceNumber(value: SourceNumber, unit = "") {
  if (value === null) return "미기재";
  if (value === "-") return "- (원문 표기)";
  return value.toLocaleString("ko-KR") + unit;
}
export function formatSourceText(value: string | null) {
  return value === null ? "미기재" : value === "-" ? "- (원문 표기)" : value;
}
