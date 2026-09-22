import { NextRequest, NextResponse } from "next/server";
import { getSessionIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { UUID } from "@/lib/portal/data";
import { isSameOriginRequest } from "@/lib/reports/request";

export const maxDuration = 120;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return new NextResponse(null, { status: 403 });
  const { id } = await params;
  if (!UUID.test(id) || !(await getSessionIdentity())) return new NextResponse(null, { status: 401 });
  if (Number(request.headers.get("content-length")) > 140_000) return new NextResponse(null, { status: 413 });
  let text: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return new NextResponse(null, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 140_000) { await reader.cancel(); return new NextResponse(null, { status: 413 }); }
      chunks.push(value);
    }
    text = JSON.parse(Buffer.concat(chunks).toString("utf8")).text;
  } catch { return new NextResponse(null, { status: 400 }); }
  if (typeof text !== "string" || text.length < 80 || text.length > 95_000)
    return NextResponse.json({ message: "PDF에서 읽은 내용을 확인해 주세요." }, { status: 400 });
  const db = await createServerSupabaseClient();
  const { data: context, error } = await db.rpc("life_operation_context", { f: id });
  if (error || !context?.manager) return new NextResponse(null, { status: 403 });
  if (context.documents?.some((document: { kind: string; status: string }) => document.kind === "result" && document.status === "SUBMITTED"))
    return NextResponse.json({ message: "최종 제출된 보고서는 가져올 수 없습니다." }, { status: 409 });
  const { data: { session } } = await db.auth.getSession();
  const config = getSupabaseConfig();
  if (!session || !config) return new NextResponse(null, { status: 401 });
  try {
    const analysis = await fetch(`${config.url}/functions/v1/operation-report-ai`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${session.access_token}`, "apikey": config.key, "Content-Type": "application/json" },
      body: JSON.stringify({ offeringId: id, courseName: context.course.name, text }),
      cache: "no-store",
    });
    const data = await analysis.json().catch(() => ({ message: "AI 응답을 읽지 못했습니다." }));
    if (!analysis.ok) return NextResponse.json({
      message: analysis.status === 429
        ? "AI 요청이 많습니다. 잠시 후 다시 시도해 주세요."
        : analysis.status >= 500
          ? "AI 서버에 연결하지 못했습니다. 원본 PDF와 추출한 사진은 보관되어 있습니다."
          : typeof data.message === "string" && /[가-힣]/.test(data.message)
            ? data.message
            : "AI 제안을 받지 못했습니다. 잠시 후 다시 시도해 주세요.",
    }, { status: analysis.status, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(data, { status: analysis.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "AI 서버에 연결하지 못했습니다. 원본 PDF는 보관되어 있습니다." }, { status: 503 });
  }
}
