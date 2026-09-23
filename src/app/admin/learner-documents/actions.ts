"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_STATUS_LABELS,
  type LearnerDocumentKind,
  type LearnerDocumentStatus,
} from "@/lib/learner-document-workflow/types";
import { UUID } from "@/lib/portal/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const ERRORS: Record<string, string> = {
  MFA_REAUTH_REQUIRED: "처리 전에 추가 인증을 다시 완료해 주세요.",
  FORBIDDEN: "이 서류를 처리할 권한이 없습니다.",
  NOTE_REQUIRED: "수강생에게 보여 줄 처리 안내를 입력해 주세요.",
  STALE_REVISION: "다른 담당자가 먼저 처리했습니다. 최신 상태를 확인해 주세요.",
  INVALID_TRANSITION: "현재 상태에서 선택할 수 없는 처리 단계입니다.",
  NOT_FOUND: "서류를 찾을 수 없습니다.",
};

function returnPath(form: FormData, message: string, ok: boolean) {
  const params = new URLSearchParams();
  const kind = String(form.get("filter_kind") ?? "");
  const status = String(form.get("filter_status") ?? "");
  const query = String(form.get("filter_query") ?? "").trim().slice(0, 100);
  if (kind in DOCUMENT_KIND_LABELS) params.set("kind", kind);
  if (status in DOCUMENT_STATUS_LABELS) params.set("status", status);
  if (query) params.set("q", query);
  params.set(ok ? "notice" : "error", message);
  return `/admin/learner-documents?${params}`;
}
export async function updateLearnerDocumentStatus(form: FormData) {
  await requireIdentity("/admin/learner-documents");
  const requestId = String(form.get("request_id") ?? "");
  const nextStatus = String(form.get("next_status") ?? "") as LearnerDocumentStatus;
  const revision = Number(form.get("revision"));
  const note = String(form.get("note") ?? "").trim();
  if (
    !UUID.test(requestId) ||
    !(nextStatus in DOCUMENT_STATUS_LABELS) ||
    !Number.isInteger(revision) ||
    revision < 1 ||
    !note ||
    note.length > 1000
  )
    redirect(returnPath(form, "처리 단계와 안내 내용을 확인해 주세요.", false));

  const { error } = await (
    await createServerSupabaseClient()
  ).rpc("life_decide_learner_document", {
    r: requestId,
    next_status: nextStatus,
    note,
    expected_revision: revision,
  });
  if (error)
    redirect(
      returnPath(
        form,
        ERRORS[error.message] ?? "서류를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        false,
      ),
    );
  revalidatePath("/admin/learner-documents");
  revalidatePath("/mypage/documents");
  redirect(
    returnPath(
      form,
      `${DOCUMENT_STATUS_LABELS[nextStatus]} 상태로 처리했습니다.`,
      true,
    ),
  );
}
