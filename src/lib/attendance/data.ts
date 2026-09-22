import { cache } from "react";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import type { AttendanceBook } from "./model";

// Request-local memoization only: attendance must never be shared between sessions.
export const getAttendanceBook = cache(async (id: string, audience: "instructor" | "learner" | "manager") => {
  const path = audience === "manager" ? `/admin/offerings/${id}/reports` : audience === "instructor" ? `/instructor/offerings/${id}/attendance` : `/learning/${id}/attendance`;
  await requireIdentity(path);
  if (!UUID.test(id)) notFound();
  const result = await (async () => {
    try {
      return await (await createServerSupabaseClient()).rpc(
        audience === "learner" ? "life_my_attendance" : "life_teaching_attendance", { f: id },
      );
    } catch { return { data: null, error: { message: "CONNECTION_FAILED" } }; }
  })();
  if (result.error?.message === "FORBIDDEN") notFound();
  const book = result.error ? null : result.data as AttendanceBook | null;
  if (book) {
    try {
      const qr = await (await createServerSupabaseClient()).rpc("life_qr_checkins", { f: id });
      book.qr_checkins = qr.error ? [] : qr.data ?? [];
      book.qr_unavailable = !!qr.error;
    } catch { book.qr_checkins = []; book.qr_unavailable = true; }
  }
  return { book, unavailable: !!result.error || !result.data };
});
