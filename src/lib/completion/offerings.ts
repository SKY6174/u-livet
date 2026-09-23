import { PREFILLED_COURSES, findPrefilledCourse } from "@/lib/operation-documents/prefilled-data";
import type { WorkspaceOffering } from "@/lib/portal/types";

export type CompletionCourse = {
  id: string;
  registered: boolean;
  sourceId: string | null;
  name: string;
  academy: string;
  capacity: number | null;
  yearLabel: string;
  startsOn: string;
  endsOn: string;
  status: string | null;
};

export function mergeCompletionOfferings(offerings: WorkspaceOffering[]): CompletionCourse[] {
  const matchedOfferingIds = new Set<string>();
  const planned = PREFILLED_COURSES.map((course) => {
    const offering = offerings.find((candidate) =>
      !matchedOfferingIds.has(candidate.id) && (
        candidate.name === course.title || findPrefilledCourse(candidate.name)?.id === course.id
      ),
    );
    if (offering) matchedOfferingIds.add(offering.id);
    return {
      id: offering?.id ?? course.id,
      registered: Boolean(offering),
      sourceId: course.sourceId,
      name: course.title,
      academy: course.academy,
      capacity: offering?.capacity ?? course.capacity,
      yearLabel: offering?.year_label ?? "2차년도 · 2026",
      startsOn: offering?.starts_on ?? course.startsOn,
      endsOn: offering?.ends_on ?? course.endsOn,
      status: offering?.status ?? null,
    };
  });
  const additional = offerings
    .filter((offering) => !matchedOfferingIds.has(offering.id))
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on) || a.name.localeCompare(b.name, "ko-KR"))
    .map((offering) => ({
      id: offering.id,
      registered: true,
      sourceId: null,
      name: offering.name,
      academy: "추가 등록 과정",
      capacity: offering.capacity,
      yearLabel: offering.year_label,
      startsOn: offering.starts_on,
      endsOn: offering.ends_on,
      status: offering.status,
    }));
  return [...planned, ...additional];
}
