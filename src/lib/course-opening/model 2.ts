import { AFFILIATIONS, normalizeFilters, type CourseFilters } from "@/lib/course-plan/model";

export type OpeningPlan = typeof import("../../../docs/operations/2026-course-opening-plans.json");
export type OpeningCourse = OpeningPlan["courses"][number];
export const COVERAGE_OPTIONS = {
  additional: "현황표에 없는 추가 자료",
  matched: "기존 현황표 대응 과정",
} as const;
export type OpeningFilters = CourseFilters & {
  coverage: keyof typeof COVERAGE_OPTIONS | "";
  savedOnly: boolean;
};

export function normalizeOpeningFilters(params: Record<string, string | string[] | undefined>): OpeningFilters {
  const coverage = params.coverage;
  return {
    ...normalizeFilters(params),
    coverage: coverage === "additional" || coverage === "matched" ? coverage : "",
    savedOnly: params.drafts === "saved",
  };
}

export function filterOpeningCourses(courses: OpeningCourse[], filters: OpeningFilters) {
  const query = filters.q.normalize("NFC").toLocaleLowerCase("ko-KR");
  const classification = filters.affiliation ? AFFILIATIONS[filters.affiliation] : "";
  return courses.filter((course) => {
    const teachers = [...course.staff.teachers, ...course.staff.assistantInstructors];
    const text = [
      course.sourceId, course.title, course.facultyCoordinator, course.targetAsPlanned,
      course.partnerAsPlanned, course.summaryFromPlan, ...course.curriculumFromPlan,
      course.schedule.location, course.qualificationInformationAsWritten,
      ...teachers.flatMap((person) => [person.name, person.affiliationAndPosition]),
      ...course.staff.supportStaff.flatMap((person) => [person.name, person.department]),
    ].join(" ").normalize("NFC").toLocaleLowerCase("ko-KR");
    return (
      (!query || text.includes(query)) &&
      (!filters.academy || course.academy === filters.academy) &&
      (!classification || teachers.some((person) => person.classification === classification)) &&
      (!filters.coverage || (filters.coverage === "matched" ? !!course.existingCourseId : !course.existingCourseId))
    );
  });
}
