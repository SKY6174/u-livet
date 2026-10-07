export type CourseCurriculumSections = { content: string; audience: string; preparation: string };
export const MAX_COURSE_CURRICULUM_LENGTH = 20000;

export function parseCourseCurriculum(value: string): CourseCurriculumSections {
  const sections: CourseCurriculumSections = { content: "", audience: "", preparation: "" };
  let current: keyof CourseCurriculumSections = "content";
  for (const line of value.replace(/\r\n?/g, "\n").split("\n")) {
    const heading = line.trim();
    if (heading === "교육내용") { current = "content"; continue; }
    if (heading === "교육대상" || heading === "계획상 교육대상") { current = "audience"; continue; }
    if (heading === "준비사항" || heading === "준비물") { current = "preparation"; continue; }
    sections[current] += `${line}\n`;
  }
  for (const key of ["content", "audience", "preparation"] as const) sections[key] = sections[key].trim();
  return sections;
}

export function formatCourseCurriculum(sections: CourseCurriculumSections): string | null {
  const content = sections.content.trim();
  if (!content) return null;
  const value = [
    `교육내용\n${content}`,
    sections.audience.trim() ? `교육대상\n${sections.audience.trim()}` : "",
    sections.preparation.trim() ? `준비사항\n${sections.preparation.trim()}` : "",
  ].filter(Boolean).join("\n\n");
  return value.length <= MAX_COURSE_CURRICULUM_LENGTH ? value : null;
}
