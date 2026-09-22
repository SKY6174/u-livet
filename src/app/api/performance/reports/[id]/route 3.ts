import { getSessionIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import type { PerformanceReport } from "@/lib/performance/types";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getSessionIdentity()))
    return Response.json(
      { error: "로그인이 필요합니다." },
      { status: 401, headers },
    );
  const { id } = await params;
  if (!UUID.test(id))
    return Response.json(
      { error: "찾을 수 없습니다." },
      { status: 404, headers },
    );
  const { data, error } = await (
    await createServerSupabaseClient()
  ).rpc("life_performance_report", { r: id });
  if (error || !data)
    return Response.json(
      { error: "찾을 수 없습니다." },
      { status: 404, headers },
    );
  const r = data as PerformanceReport;
  if (r.status !== "APPROVED")
    return Response.json(
      { error: "확정본만 내려받을 수 있습니다." },
      { status: 409, headers },
    );
  return new Response(
    JSON.stringify(
      {
        scope: "등록 지표 내부 확정본",
        id: r.id,
        version: r.version,
        created_at: r.created_at,
        approved_at: r.approved_at,
        approval_reference: r.approval_reference,
        supersedes_id: r.supersedes_id,
        reason: r.reason,
        current_source_changed: r.stale,
        snapshot: r.snapshot,
      },
      null,
      2,
    ),
    {
      headers: {
        ...headers,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="performance-${id}-v${r.version}.json"`,
      },
    },
  );
}
