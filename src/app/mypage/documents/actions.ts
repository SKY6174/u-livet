"use server";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { requireIdentity } from "@/lib/auth/session";
import {
  documentErrors,
  isDocumentType,
  refundAmounts,
  type LearnerDocumentType,
  type LearnerDocumentValues,
} from "@/lib/learner-documents/model";
import { renderLearnerDocument } from "@/lib/learner-documents/pdf";
import { DOCUMENT_KIND } from "@/lib/learner-document-workflow/types";
import { UUID } from "@/lib/portal/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type DocumentActionResult = {
  ok: boolean;
  message: string;
  requestId?: string;
  fieldErrors?: Partial<Record<keyof LearnerDocumentValues, string>>;
};

const ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "로그인 상태를 확인해 주세요.",
  INVALID_INPUT: "입력 내용을 다시 확인해 주세요.",
  COURSE_NOT_FOUND: "선택한 과정을 확인할 수 없습니다.",
  TUITION_UNAVAILABLE: "선택한 과정의 수강료가 아직 등록되지 않았습니다.",
  REFUND_AMOUNT_MISMATCH: "환불 금액을 다시 계산해 주세요.",
  INVALID_PDF: "제출 PDF를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.",
  IDEMPOTENCY_CONFLICT: "같은 제출 요청의 내용이 달라졌습니다. 페이지를 새로 고쳐 주세요.",
  APPLICATION_APPROVAL_REQUIRED: "승인된 수강신청원서가 있는 과정만 신청할 수 있습니다.",
  COMPLETION_APPROVAL_REQUIRED: "수료 인정이 완료된 과정만 장학금을 신청할 수 있습니다.",
};

const PDF_CREATION_ERROR = "제출 PDF를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.";
const SAFE_PDF_ERROR_PREFIXES = [
  "PDF에서 지원하지 않는 문자가 있습니다.",
  "입력 내용이 서식의 칸보다 깁니다.",
  "서명 이미지",
];

function publicPdfError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (SAFE_PDF_ERROR_PREFIXES.some((prefix) => message.startsWith(prefix)))
    return message;
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "UNKNOWN";
  console.error("Learner document PDF creation failed", {
    name: error instanceof Error ? error.name : "UnknownError",
    code,
  });
  return PDF_CREATION_ERROR;
}

async function pdfAssets(type: LearnerDocumentType) {
  const root = process.cwd();
  const [template, regular, bold] = await Promise.all([
    readFile(path.join(root, "public", "forms", `learner-${type}.pdf`)),
    readFile(path.join(root, "public", "fonts", "KoPubDotum-Medium.ttf")),
    readFile(path.join(root, "public", "fonts", "KoPubDotum-Bold.ttf")),
  ]);
  return {
    template: new Uint8Array(template),
    regular: new Uint8Array(regular),
    bold: new Uint8Array(bold),
  };
}

function isValues(value: unknown): value is LearnerDocumentValues {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LearnerDocumentValues>;
  return (
    typeof candidate.courseName === "string" &&
    typeof candidate.offeringId === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.phone === "string" &&
    typeof candidate.signature === "string" &&
    Array.isArray(candidate.purposes)
  );
}

export async function submitLearnerDocument(input: {
  type: string;
  requestKey: string;
  values: unknown;
}): Promise<DocumentActionResult> {
  await requireIdentity("/mypage/documents");
  if (
    !isDocumentType(input.type) ||
    !UUID.test(input.requestKey) ||
    !isValues(input.values)
  )
    return { ok: false, message: "제출 정보를 다시 확인해 주세요." };

  const type = input.type;
  const values: LearnerDocumentValues = {
    ...input.values,
    courseName: input.values.courseName.trim(),
    name: input.values.name.trim(),
    phone: input.values.phone.trim(),
    bank: input.values.bank.trim(),
    account: input.values.account.trim(),
    accountHolder: input.values.accountHolder.trim(),
  };
  const db = await createServerSupabaseClient();
  if (values.offeringId) {
    if (!UUID.test(values.offeringId))
      return { ok: false, message: ERROR_MESSAGES.COURSE_NOT_FOUND };
    const { data: offering, error } = await db
      .from("life_catalog")
      .select("id,name,tuition")
      .eq("id", values.offeringId)
      .maybeSingle();
    if (error)
      return { ok: false, message: ERROR_MESSAGES.COURSE_NOT_FOUND };
    // A published guide can accept preparatory documents before its draft
    // offering is in the public admissions catalog.
    if (!offering && type === "application") {
      const { data: guide, error: guideError } = await db.from("life_course_guides")
        .select("name").eq("offering_id", values.offeringId).eq("published", true).maybeSingle();
      if (guideError || !guide) return { ok: false, message: ERROR_MESSAGES.COURSE_NOT_FOUND };
      values.courseName = String(guide.name);
    } else if (!offering) return { ok: false, message: ERROR_MESSAGES.COURSE_NOT_FOUND };
    else values.courseName = String(offering.name);
    if (type === "refund") {
      const tuition = offering?.tuition == null ? null : Number(offering.tuition);
      Object.assign(values, refundAmounts(tuition, values.refundOccurrence));
    }
  }
  const fieldErrors = documentErrors(type, values);
  if (Object.keys(fieldErrors).length)
    return {
      ok: false,
      message: "표시된 항목을 확인해 주세요.",
      fieldErrors,
    };

  try {
    const bytes = await renderLearnerDocument(type, values, await pdfAssets(type));
    const buffer = Buffer.from(bytes);
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const { data, error } = await db.rpc("life_submit_learner_document", {
      k: DOCUMENT_KIND[type],
      f: values.offeringId || null,
      request_key: input.requestKey,
      course_name: values.courseName,
      applicant_name: values.name,
      phone: values.phone,
      occurrence: type === "refund" ? values.refundOccurrence : null,
      amount: type === "refund" ? Number(values.refundAmount) : null,
      pdf_base64: buffer.toString("base64"),
      pdf_sha256: sha256,
    });
    if (error)
      return {
        ok: false,
        message:
          ERROR_MESSAGES[error.message] ??
          "서류를 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      };
    revalidatePath("/mypage/documents");
    revalidatePath("/admin/learner-documents");
    return {
      ok: true,
      requestId: String(data),
      message:
        type === "application"
          ? "입력 완료 문서를 접수했습니다. 처리 현황에서 진행 과정을 확인할 수 있습니다."
          : "신청서를 접수했습니다. 처리 현황에서 진행 과정을 확인할 수 있습니다.",
    };
  } catch (error) {
    return {
      ok: false,
      message: publicPdfError(error),
    };
  }
}

export async function cancelLearnerDocument(
  requestId: string,
): Promise<DocumentActionResult> {
  await requireIdentity("/mypage/documents");
  if (!UUID.test(requestId))
    return { ok: false, message: "신청 정보를 확인해 주세요." };
  const { error } = await (
    await createServerSupabaseClient()
  ).rpc("life_cancel_learner_document", { r: requestId });
  if (error)
    return {
      ok: false,
      message: "접수 상태의 본인 서류만 취소할 수 있습니다.",
    };
  revalidatePath("/mypage/documents");
  revalidatePath("/admin/learner-documents");
  return { ok: true, message: "서류 접수를 취소했습니다." };
}
