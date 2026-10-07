import { cache } from "react";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { getOffering, UUID } from "@/lib/portal/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CourseWorkspace } from "./types";

export type CourseRunInfo = { order: number; total: number };

export async function getCourseRunInfo(
  offeringId: string,
  courseVersionId: string,
): Promise<CourseRunInfo | null> {
  const db = await createServerSupabaseClient();
  const { data: version, error: versionError } = await db
    .from("life_course_versions")
    .select("course_id")
    .eq("id", courseVersionId)
    .maybeSingle();
  if (versionError || !version?.course_id) return null;

  const { data: versions, error: versionsError } = await db
    .from("life_course_versions")
    .select("id")
    .eq("course_id", version.course_id);
  if (versionsError || !versions?.length) return null;

  const { data: runs, error: offeringsError } = await db
    .from("life_offerings")
    .select("id, starts_on, created_at")
    .in("course_version_id", versions.map((item) => item.id));
  if (offeringsError || !runs) return null;

  runs.sort((left, right) =>
      left.starts_on.localeCompare(right.starts_on) ||
      left.created_at.localeCompare(right.created_at) ||
      left.id.localeCompare(right.id),
  );
  if (runs.length < 2) return null;
  const index = runs.findIndex((run) => run.id === offeringId);
  return index < 0 ? null : { order: index + 1, total: runs.length };
}

export const getCourseWorkspaces = cache(async (id?: string) => {
  if (id !== undefined && !UUID.test(id))
    return { courses: [], unavailable: true };
  try {
    const { data, error } = await (
      await createServerSupabaseClient()
    ).rpc("life_course_workspace", { f: id ?? null });
    return { courses: (data ?? []) as CourseWorkspace[], unavailable: !!error };
  } catch {
    return { courses: [] as CourseWorkspace[], unavailable: true };
  }
});

export const getManagedCourse = cache(async (id: string) => {
  const me = await requireIdentity(`/admin/offerings/${id}`);
  const offering = await getOffering(id);
  if (
    !offering ||
    !me.roles.some(
      (r) => r.role === "COURSE_MANAGER" && r.org_id === offering.org_id,
    )
  )
    notFound();
  const result = await getCourseWorkspaces(id);
  return {
    offering,
    workspace: result.unavailable ? null : (result.courses[0] ?? null),
  };
});
