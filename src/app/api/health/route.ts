import { createServerSupabaseClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export async function GET() {
  let ok = false;
  try {
    const { error } = await (await createServerSupabaseClient())
      .from("life_catalog")
      .select("id")
      .limit(1);
    ok = !error;
  } catch {
    ok = false;
  }
  return Response.json(
    { status: ok ? "healthy" : "unavailable" },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
