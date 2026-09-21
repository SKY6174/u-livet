import { attendanceIndex, attendanceSummary } from "@/lib/attendance/model";
import type { CatalogCourse } from "@/lib/course-guide/model";
import type { LearningCourse } from "./types";
export const requestLabels = {
  SUBMITTED: "접수 완료",
  REVIEWING: "검토 중",
  PLANNED: "개설 검토 반영",
  NOT_PLANNED: "검토 완료",
};
export function courseAttendance(course: LearningCourse, now: number) {
  const records = course.sessions
    .filter((s) => s.credited_minutes !== null)
    .map((s) => ({
      session_id: s.id,
      person_id: "self",
      credited_minutes: s.credited_minutes!,
      reason: "",
      revision: 0,
      recorded_at: "",
    }));
  return attendanceSummary(
    course.sessions,
    attendanceIndex(records),
    "self",
    now,
  );
}
export function nextClass(courses: LearningCourse[], now: number) {
  return (
    courses
      .filter((c) => c.active)
      .flatMap((course) =>
        course.sessions
          .filter(
            (s) => s.status === "SCHEDULED" && Date.parse(s.ends_at) > now,
          )
          .map((session) => ({ course, session })),
      )
      .sort(
        (a, b) =>
          Date.parse(a.session.starts_at) - Date.parse(b.session.starts_at),
      )[0] ?? null
  );
}
export function recommendCourses(
  catalog: CatalogCourse[],
  courses: LearningCourse[],
) {
  const academies = new Set(
    courses
      .filter((c) => c.active || c.status === "ACCEPTED")
      .map((c) => c.academy),
  );
  const ids = new Set(courses.map((c) => c.id));
  const names = new Set(courses.map((c) => c.name.replace(/\s/g, "")));
  return catalog
    .filter(
      (c) =>
        !ids.has(c.id) &&
        !("offering_id" in c && ids.has(String(c.offering_id))) &&
        !names.has(c.name.replace(/\s/g, "")),
    )
    .map((course) => ({ ...course, related: academies.has(course.academy) }))
    .sort((a, b) => Number(b.related) - Number(a.related))
    .slice(0, 3);
}
export function courseStage(course: LearningCourse, today: string) {
  if (!course.active) return "application";
  return course.ends_on < today ? "past" : "current";
}
