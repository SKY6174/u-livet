import "server-only";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import data from "../../../docs/operations/2026-course-opening-plans.json";
import type { OpeningPlan } from "./model";

export async function getCourseOpeningPlan(): Promise<OpeningPlan> {
  const me = await requireIdentity("/admin/course-plan/opening");
  if (!me.roles.some((role) => role.role === "COURSE_MANAGER")) notFound();
  return data;
}
