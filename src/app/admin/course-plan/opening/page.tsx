import type { Metadata } from "next";
import { CourseOpeningView } from "@/components/course-plan/course-opening-view";
import { normalizeOpeningFilters } from "@/lib/course-opening/model";
import { getCourseOpeningPlan } from "@/lib/course-opening/server";
import { getOpeningWorkingCopyOverview } from "@/lib/course-opening/working-copy-overview-server";

export const metadata: Metadata = {
  title: "2026년 과정 개설 준비 | U-LiVE",
  robots: { index: false, follow: false },
};

export default async function CourseOpeningPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [plan, workingCopies] = await Promise.all([getCourseOpeningPlan(), getOpeningWorkingCopyOverview()]);
  const filters = normalizeOpeningFilters(await searchParams);
  return <CourseOpeningView plan={plan} filters={filters} workingCopies={workingCopies} />;
}
