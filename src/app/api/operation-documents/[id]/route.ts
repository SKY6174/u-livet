import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import { isSameOriginRequest } from "@/lib/reports/request";
import { validContent, validBudget } from "@/lib/operation-documents/model";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";
const messages: Record<string, string> = {
  REVISION_CHANGED:
    "다른 수정이 먼저 저장되었습니다. 현재 입력을 복사해 두고 새로고침해 주세요.",
  DOCUMENT_LOCKED:
    "현재 단계에서는 수정할 수 없습니다. 결과보고서는 담당자 예산 확정 후 책임강사가 작성합니다.",
  BUDGET_FORBIDDEN: "예산은 담당자만 수정할 수 있습니다.",
  BUDGET_LOCKED: "예산이 확정되었습니다. 변경하려면 담당자가 예산 입력 단계로 되돌려야 합니다.",
  SIGNATURE_STAGE: "결과보고서 서명은 담당자 예산 확정 후에 입력해 주세요.",
  SIGNATURE_FORBIDDEN: "결과보고서는 지정된 책임강사 본인만 서명할 수 있습니다.",
  SIGNATURE_STALE: "내용이 바뀌었습니다. 기존 서명을 지우고 수정 후 다시 서명해 주세요.",
  SIGNATURE_REQUIRED: "책임강사가 결과보고서 내용 확인 후 서명해야 최종 제출할 수 있습니다.",
  CONTENT_REQUIRED: "필수 항목을 모두 작성하고 내용 확인에 체크해 주세요.",
  RESPONSIBLE_REQUIRED: "유효하게 배정된 책임강사를 먼저 지정해 주세요.",
  INVALID_RESPONSIBLE:
    "현재 과정에 배정된 강사만 책임강사로 지정할 수 있습니다.",
  BUDGET_REQUIRED:
    "예산 금액을 모두 입력하고 최종 확인에 체크해 주세요. 해당 없으면 0을 입력하세요.",
  REASON_REQUIRED: "보완·수정 사유를 입력해 주세요.",
  MFA_REAUTH_REQUIRED: MFA_REAUTH_MESSAGE,
};
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginRequest(request))
    return new NextResponse(null, { status: 403 });
  const { id } = await params;
  if (!UUID.test(id) || !(await getSessionIdentity()))
    return new NextResponse(null, { status: 401 });
  try {
    const reader = request.body?.getReader();
    if (!reader) return new NextResponse(null, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 3_200_000) {
        await reader.cancel();
        return NextResponse.json(
          { message: "사진 용량을 줄여 주세요. 문서는 최대 3MB입니다." },
          { status: 413 },
        );
      }
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (
      !body ||
      typeof body !== "object" ||
      !Number.isSafeInteger(body.revision) ||
      body.revision < 0 ||
      !["plan", "result"].includes(body.kind)
    )
      return new NextResponse(null, { status: 400 });
    const db = await createServerSupabaseClient();
    let response;
    if (body.intent === "save") {
      if (
        !validContent(body.content, body.kind) ||
        (body.budget !== null && !validBudget(body.budget))
      )
        return NextResponse.json(
          { message: "입력 형식·날짜·숫자·사진 용량을 확인해 주세요." },
          { status: 400 },
        );
      response = await db.rpc("life_operation_save", {
        f: id,
        k: body.kind,
        c: body.content,
        b: body.budget,
        expected_revision: body.revision,
      });
    } else if (body.intent === "assign" && UUID.test(body.person ?? "")) {
      response = await db.rpc("life_operation_assign", {
        f: id,
        p: body.person,
        expected_revision: body.revision,
      });
      if (!response.error)
        response = await db.rpc("life_operation_context", { f: id });
    } else if (
      ["review", "submit", "return", "reopen"].includes(body.intent) &&
      typeof body.note === "string" &&
      body.note.length <= 2000 &&
      typeof body.confirmed === "boolean"
    ) {
      response = await db.rpc("life_operation_transition", {
        f: id,
        k: body.kind,
        intent: body.intent,
        expected_revision: body.revision,
        note: body.note,
        confirmed: body.confirmed,
      });
    } else return new NextResponse(null, { status: 400 });
    if (response.error)
      return NextResponse.json(
        {
          message:
            messages[response.error.message] ??
            "처리하지 못했습니다. 권한과 입력 내용, 문서 상태를 확인해 주세요.",
        },
        { status: response.error.message === "REVISION_CHANGED" ? 409 : 400 },
      );
    revalidatePath("/operation-documents", "layout");
    return NextResponse.json(
      { context: response.data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        message:
          "연결 또는 입력 내용에 문제가 있습니다. 저장되지 않았으므로 다시 시도해 주세요.",
      },
      { status: 400 },
    );
  }
}
