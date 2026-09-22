import { isSameOriginRequest } from "@/lib/reports/request";
import { NextRequest, NextResponse } from "next/server";
import { getSessionIdentity } from "@/lib/auth/session";
import { getOffering, UUID } from "@/lib/portal/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DOCUMENTS } from "@/lib/reports/types";
import { detectFileMime, MAX_FILE_SIZE } from "@/lib/reports/validation";
export const runtime = "nodejs";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginRequest(request))
    return new NextResponse(null, { status: 403 });
  const { id } = await params;
  const me = await getSessionIdentity();
  if (!me || !UUID.test(id)) return new NextResponse(null, { status: 401 });
  const offering = await getOffering(id);
  if (
    !offering ||
    !me.roles.some(
      (r) => r.org_id === offering.org_id && r.role === "COURSE_MANAGER",
    )
  )
    return new NextResponse(null, { status: 403 });
  try {
    // Bound streamed bodies as well as Content-Length before parsing multipart data.
    const reader = request.body?.getReader();
    if (!reader) return new NextResponse(null, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_FILE_SIZE + 65536) {
        await reader.cancel();
        return NextResponse.json(
          { message: "파일이 너무 큽니다." },
          { status: 413 },
        );
      }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
    const file = form.get("file"),
      kind = String(form.get("kind") ?? ""),
      caption = String(form.get("caption") ?? "").trim();
    if (
      !(file instanceof File) ||
      file.size < 1 ||
      file.size > MAX_FILE_SIZE ||
      caption.length > 300 ||
      ![...DOCUMENTS.map((d) => d[0]), "photo"].includes(kind)
    )
      return NextResponse.json(
        { message: "파일과 분류를 확인해 주세요." },
        { status: 400 },
      );
    const bytes = Buffer.from(await file.arrayBuffer()),
      mime = detectFileMime(bytes);
    if (
      !mime ||
      (kind === "photo"
        ? !mime.startsWith("image/")
        : mime !== "application/pdf")
    )
      return NextResponse.json(
        { message: "원본은 PDF, 사진은 JPG 또는 PNG로 올려 주세요." },
        { status: 400 },
      );
    const db = await createServerSupabaseClient();
    if (kind === "result") {
      const { data: context, error: contextError } = await db.rpc("life_operation_context", { f: id });
      if (contextError || !context?.manager || context.documents?.some((document: { kind: string; status: string }) => document.kind === "result" && document.status === "SUBMITTED"))
        return NextResponse.json({ message: "제출 완료된 결과보고서의 원본은 교체할 수 없습니다." }, { status: 409 });
    }
    const { data: fileId, error } = await db.rpc("life_save_report_file", {
      f: id,
      kind,
      filename: file.name.replace(/[\r\n/\\]/g, "_").slice(0, 200),
      mime,
      body: bytes.toString("base64"),
      caption,
    });
    if (error)
      return NextResponse.json(
        {
          message:
            error.message === "PHOTO_LIMIT"
              ? "운영사진은 최대 12장입니다."
              : "저장하지 못했습니다. 권한·추가 인증 상태를 확인해 주세요.",
        },
        { status: 400 },
      );
    return NextResponse.json({ ok: true, fileId });
  } catch {
    return NextResponse.json(
      { message: "파일을 업로드하지 못했습니다. 다시 시도해 주세요." },
      { status: 400 },
    );
  }
}
