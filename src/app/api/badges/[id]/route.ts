import { getSessionIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
};
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
  ).rpc("life_badge_download", { i: id });
  if (error?.message === "MFA_REAUTH_REQUIRED")
    return Response.json({ error: "추가 인증 후 다시 내려받아 주세요.", reauthenticate: "/auth/security" }, { status: 403, headers });
  if (error || !data)
    return Response.json(
      {
        error:
          error?.message === "BADGE_NOT_CURRENT"
            ? "유효한 최신 배지만 내려받을 수 있습니다."
            : "찾을 수 없습니다.",
      },
      { status: error?.message === "BADGE_NOT_CURRENT" ? 409 : 404, headers },
    );
  return new Response(data.body, {
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="badge-${id}.json"`,
      "X-Artifact-SHA256": data.sha256,
    },
  });
}
