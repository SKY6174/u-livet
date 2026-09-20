import { cache } from "react";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import type { AttendanceBook } from "./model";

// Request-local memoization only: attendance must never be shared between sessions.
export const getAttendanceBook = cache(async (id: string, audience: "instructor" | "learner") => {
  const path = audience === "instructor" ? `/instructor/offerings/${id}/attendance` : `/learning/${id}/attendance`;
  await requireIdentity(path);
  if (!UUID.test(id)) notFound();
  const result = await (async () => {
    try {
      return await (await createServerSupabaseClient()).rpc(
        audience === "instructor" ? "life_teaching_attendance" : "life_my_attendance", { f: id },
      );
    } catch { return { data: null, error: { message: "CONNECTION_FAILED" } }; }
  })();
  if (result.error?.message === "FORBIDDEN") notFound();
  return { book: result.error ? null : result.data as AttendanceBook | null, unavailable: !!result.error || !result.data };
});
