import { getSessionIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
export const runtime = "nodejs";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
  if (!(await getSessionIdentity()))
    return new Response("로그인이 필요합니다.", { status: 401, headers });
  if (!UUID.test(id))
    return new Response("찾을 수 없습니다.", { status: 404, headers });
  const { data, error } = await (
    await createServerSupabaseClient()
  ).rpc("life_download_certificate", { i: id });
  if (error?.message === "MFA_REAUTH_REQUIRED")
    return new Response("추가 인증이 필요합니다. 계정 보안·추가 인증 화면에서 6자리 코드를 확인한 뒤 다시 내려받아 주세요.", { status: 403, headers });
  if (error || !data)
    return new Response("다운로드할 수 있는 현재 원본이 없습니다.", {
      status: 404,
      headers,
    });
  const bytes = Buffer.from(data.base64, "base64");
  return new Response(bytes, {
    headers: {
      ...headers,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${data.number}.pdf"`,
    },
  });
}
