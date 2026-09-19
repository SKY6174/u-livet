import { isSameOriginRequest } from "@/lib/reports/request";
import { NextRequest, NextResponse } from "next/server";
import { getSessionIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; fileId: string }> };
export async function GET(_: NextRequest, { params }: Context) {
  const { id, fileId } = await params;
  if (!UUID.test(id) || !UUID.test(fileId) || !(await getSessionIdentity()))
    return new NextResponse(null, { status: 404 });
  const { data, error } = await (
    await createServerSupabaseClient()
  ).rpc("life_report_file", { f: id, file_id: fileId });
  if (error || !data) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(data.body, "base64"), {
    headers: {
      "Content-Type": data.mime,
      "Content-Disposition": `${data.mime.startsWith("image/") ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(data.filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
export async function DELETE(request: NextRequest, { params }: Context) {
  if (!isSameOriginRequest(request))
    return new NextResponse(null, { status: 403 });
  const { id, fileId } = await params;
  if (!UUID.test(id) || !UUID.test(fileId) || !(await getSessionIdentity()))
    return new NextResponse(null, { status: 404 });
  const { error } = await (
    await createServerSupabaseClient()
  ).rpc("life_report_file", { f: id, file_id: fileId, remove: true });
  return NextResponse.json({ ok: !error }, { status: error ? 403 : 200 });
}
