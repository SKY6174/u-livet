import type { Metadata } from "next";
import { CoursePlanView } from "@/components/course-plan/course-plan-view";
import { normalizeFilters } from "@/lib/course-plan/model";
import { getCoursePlan } from "@/lib/course-plan/server";

export const metadata: Metadata = {
  title: "2026년 교육과정 현황 | U-LiVET",
  robots: { index: false, follow: false },
};

export default async function CoursePlanPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const plan = await getCoursePlan();
  const filters = normalizeFilters(await props.searchParams);
  return <CoursePlanView plan={plan} filters={filters} />;
}
