import { getSessionIdentity } from "@/lib/auth/session";
import { UUID } from "@/lib/portal/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type FileResult = {
  base64: string;
  sha256: string;
  byte_size: number;
  kind: "APPLICATION" | "SCHOLARSHIP" | "REFUND";
  course_name: string;
  submitted_at: string;
};

const KIND_NAMES: Record<FileResult["kind"], string> = {
  APPLICATION: "수강신청원서",
  SCHOLARSHIP: "장학금지급신청서",
  REFUND: "수강료환불신청서",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await getSessionIdentity()))
    return new Response("로그인이 필요합니다.", { status: 401 });
  const { id } = await context.params;
  if (!UUID.test(id)) return new Response("문서를 찾을 수 없습니다.", { status: 404 });
  const { data, error } = await (
    await createServerSupabaseClient()
  ).rpc("life_learner_document_file", { r: id });
  if (error || !data)
    return new Response("문서를 열 권한이 없거나 문서를 찾을 수 없습니다.", {
      status: error?.message === "FORBIDDEN" ? 403 : 404,
    });
  const file = data as FileResult;
  const bytes = Buffer.from(file.base64, "base64");
  if (bytes.length !== Number(file.byte_size) || !bytes.subarray(0, 8).equals(Buffer.from("%PDF-1.7")))
    return new Response("보관된 PDF를 확인할 수 없습니다.", { status: 500 });
  const day = file.submitted_at.slice(0, 10);
  const safeCourse = file.course_name.replace(/[\\/:*?"<>|\r\n]/g, " ").trim().slice(0, 60);
  const filename = `${KIND_NAMES[file.kind]}_${safeCourse}_${day}.pdf`;
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="learner-document.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "X-Document-SHA256": file.sha256,
    },
  });
}
