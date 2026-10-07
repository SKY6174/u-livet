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
  NOTE_TOO_LONG: "수강생 안내는 1,000자 이내로 입력해 주세요.",
  STALE_REVISION: "다른 담당자가 먼저 처리했습니다. 최신 상태를 확인해 주세요.",
  INVALID_TRANSITION: "현재 상태에서 선택할 수 없는 처리 단계입니다.",
  NOT_FOUND: "서류를 찾을 수 없습니다.",
  LINK_REQUIRED: "수강신청원서에 개설 과정을 먼저 연결해 주세요.",
  LINK_IMMUTABLE: "이미 연결된 과정은 변경할 수 없습니다. 담당자에게 확인해 주세요.",
  COURSE_NOT_FOUND: "개설 과정을 찾을 수 없습니다.",
  OFFERING_UNAVAILABLE: "교육기간이 종료되었거나 모집 준비·운영 마감 상태입니다. 실제 개설 기수를 확인해 주세요.",
  DOCUMENT_APPROVAL_REQUIRED: "원서를 승인한 후 수강 등록을 처리해 주세요.",
  APPLICATION_REQUIRED: "수강생이 과정 안내와 동의를 확인해 수강 신청을 먼저 완료해야 합니다.",
  CONSENT_REQUIRED: "현재 신청 안내에 대한 수강생 동의를 확인할 수 없습니다.",
  CAPACITY_FULL: "정원이 가득 찼습니다. 개설 과정의 정원을 확인해 주세요.",
  FULL: "정원이 가득 찼습니다. 개설 과정의 정원을 확인해 주세요.",
  STATUS_CHANGED: "신청 상태가 변경되었습니다. 최신 상태를 확인해 주세요.",
  INVALID_STATE: "현재 신청 상태에서는 수강 등록을 처리할 수 없습니다.",
};

function revalidateDocuments() {
  for (const path of ["/", "/admin", "/admin/learner-documents", "/mypage/documents", "/mypage", "/learning", "/admin/applications", "/admin/learners"])
    revalidatePath(path);
}

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
  revalidateDocuments();
  redirect(
    returnPath(
      form,
      `${DOCUMENT_STATUS_LABELS[nextStatus]} 상태로 처리했습니다.`,
      true,
    ),
  );
}

async function processDocumentLink(form: FormData, admit: boolean) {
  await requireIdentity("/admin/learner-documents");
  const requestId = String(form.get("request_id") ?? "");
  const offeringId = String(form.get("offering_id") ?? "");
  const revision = Number(form.get("revision"));
  if (!UUID.test(requestId) || (!admit && !UUID.test(offeringId)) || !Number.isInteger(revision) || revision < 1)
    redirect(returnPath(form, "연결할 과정과 원서 정보를 확인해 주세요.", false));
  const db = await createServerSupabaseClient();
  const { error } = admit
    ? await db.rpc("life_admit_learner_document", { r: requestId, expected_revision: revision })
    : await db.rpc("life_link_learner_document", { r: requestId, f: offeringId, expected_revision: revision });
  if (error) redirect(returnPath(form, ERRORS[error.message] ?? "처리를 완료하지 못했습니다. 개설 과정과 신청 상태를 확인해 주세요.", false));
  revalidateDocuments();
  redirect(returnPath(form, admit ? "수강 등록 절차를 처리했습니다. 등록·납부 상태를 확인해 주세요." : "개설 과정을 연결했습니다. 신청·등록 상태를 확인해 주세요.", true));
}

export async function linkLearnerDocument(form: FormData) {
  await processDocumentLink(form, false);
}

export async function admitLearnerDocument(form: FormData) {
  await processDocumentLink(form, true);
}
