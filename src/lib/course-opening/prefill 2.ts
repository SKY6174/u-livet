import type { OpeningCourse, OpeningPlan } from "./model";

export function findOpeningCourse(plan: OpeningPlan, sourceId: unknown) {
  if (typeof sourceId !== "string") return undefined;
  return plan.courses.find((course) => course.sourceId === sourceId);
}

export function createOfferingPrefill(course: OpeningCourse) {
  return {
    title: course.title,
    academy: course.academy,
    capacity: course.capacity,
    location: course.schedule.location,
    summary: course.summaryFromPlan,
    curriculum: [
      "교육내용",
      ...course.curriculumFromPlan.map((item) => `• ${item}`),
      "",
      "계획상 교육대상",
      course.targetAsPlanned,
      "※ 운영계획서의 대상 구성입니다. 실제 지원자격·증빙·우선순위는 모집 공고에서 확인하세요.",
    ].join("\n"),
  };
}
