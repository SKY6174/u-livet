import "server-only";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import data from "./data-2026.json";
import type { CoursePlan } from "./model";

export async function getCoursePlan(): Promise<CoursePlan> {
  const me = await requireIdentity("/admin/course-plan");
  if (!me.roles.some((role) => role.role === "COURSE_MANAGER")) notFound();
  return data as CoursePlan;
}
