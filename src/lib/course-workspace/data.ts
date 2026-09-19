import { cache } from "react";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { getOffering, UUID } from "@/lib/portal/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CourseWorkspace } from "./types";

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
