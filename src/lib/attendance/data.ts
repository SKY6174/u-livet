import { cache } from "react";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import type { AttendanceBook } from "./model";

// Request-local memoization only: attendance must never be shared between sessions.
export const getAttendanceBook = cache(async (id: string, audience: "instructor" | "learner" | "manager", includeQr = true) => {
  const path = audience === "manager" ? `/admin/offerings/${id}/reports` : audience === "instructor" ? `/instructor/offerings/${id}/attendance` : `/learning/${id}/attendance`;
  await requireIdentity(path);
  if (!UUID.test(id)) notFound();
  let db: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  try { db = await createServerSupabaseClient(); }
  catch { return { book: null, unavailable: true }; }
  async function read(name: string) {
    try {
      return await db.rpc(name, { f: id });
    } catch { return { data: null, error: { message: "CONNECTION_FAILED" } }; }
  }
  // Both RPCs enforce their own course/person scope. Start independent reads together.
  const [result, qr] = await Promise.all([
    read(audience === "learner" ? "life_my_attendance" : "life_teaching_attendance"),
    includeQr ? read("life_qr_checkins") : null,
  ]);
  if (result.error?.message === "FORBIDDEN") notFound();
  const book = result.error ? null : result.data as AttendanceBook | null;
  if (book && qr) {
    book.qr_checkins = qr.error ? [] : qr.data ?? [];
    book.qr_unavailable = !!qr.error;
  }
  return { book, unavailable: !!result.error || !result.data };
});
