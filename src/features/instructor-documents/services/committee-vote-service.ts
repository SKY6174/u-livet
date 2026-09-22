import { createClient } from "@/lib/supabase/client";
import { CommitteeVoteApiError, type CommitteeVoteErrorCode } from "../types/committee-vote";
import type { AdvisoryNameVerificationStatus, AdvisoryDocumentType, AdvisoryIntakeContext, AdvisoryResume, AdvisoryResumeAiAnalysis, AdvisorySubmissionAttachment, AdvisoryIntakeSubmission } from "../types/advisory-intake";
export async function invoke<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const {data, error} = await createClient().functions.invoke("instructor-documents", {body: {action, ...body}});
  if (error || !data?.ok) {
    let envelope = data;
    if (error && "context" in error && error.context instanceof Response) {
      try { envelope = await error.context.json(); } catch { /* Non-JSON network response. */ }
    }
    throw new CommitteeVoteApiError(envelope?.error?.code || "NETWORK_ERROR", action.startsWith("consent-") && typeof envelope?.error?.message === "string" ? envelope.error.message : "서류 요청을 처리하지 못했습니다.");
  }
  return data.data as T;
}
export function getAdvisoryIntakeContext(token: string): Promise<AdvisoryIntakeContext> {
  return invoke<AdvisoryIntakeContext>("advisory-intake-context", { voter_token: token });
}

export function saveAdvisoryResume(token: string, resume: AdvisoryResume) {
  return invoke<{ saved: boolean; updated_at: string }>("advisory-intake-save-profile", {
    voter_token: token,
    resume
  });
}

export function saveAdvisoryResumeDraft(token: string, resume: AdvisoryResume) {
  return invoke<{ saved: boolean; is_draft: true; updated_at: string }>("advisory-intake-save-profile-draft", {
    voter_token: token,
    resume
  });
}

export function saveAdvisorySubmissionDraft(
  token: string,
  draft: Omit<AdvisoryIntakeSubmission, "signature_data_url" | "signature_file_name">
) {
  return invoke<{ saved: boolean; updated_at: string }>("advisory-intake-save-submission-draft", {
    voter_token: token,
    draft
  });
}

export function analyzeAdvisoryResume(
  token: string,
  fileName: string,
  contentType: string,
  dataUrl: string
): Promise<AdvisoryResumeAiAnalysis> {
  return invoke<AdvisoryResumeAiAnalysis>("advisory-intake-analyze-resume", {
    voter_token: token,
    file_name: fileName,
    content_type: contentType,
    data_url: dataUrl
  });
}

export function uploadAdvisoryDocument(
  token: string,
  documentType: AdvisoryDocumentType,
  fileName: string,
  dataUrl: string
) {
  return invoke<{
    saved: boolean;
    document_type: AdvisoryDocumentType;
    original_name: string;
    updated_at: string;
    name_verification_status: AdvisoryNameVerificationStatus;
    name_matches_member: boolean | null;
    name_verified_at: string | null;
  }>(
    "advisory-intake-upload",
    { voter_token: token, document_type: documentType, file_name: fileName, data_url: dataUrl }
  );
}

export function analyzeAdvisoryDocumentLayout(
  token: string,
  documentType: AdvisoryDocumentType,
  fileName: string,
  dataUrl: string
) {
  return invoke<{
    readable: boolean;
    confidence: number;
    rotation_degrees: 0 | 90 | 180 | 270;
    top_left_x: number;
    top_left_y: number;
    top_right_x: number;
    top_right_y: number;
    bottom_right_x: number;
    bottom_right_y: number;
    bottom_left_x: number;
    bottom_left_y: number;
  }>("advisory-intake-analyze-document-layout", {
    voter_token: token,
    document_type: documentType,
    file_name: fileName,
    data_url: dataUrl
  });
}

export function analyzeAdvisoryIdentityBankLayouts(
  token: string,
  fileName: string,
  dataUrl: string
) {
  type Layout = {
    readable: boolean;
    confidence: number;
    rotation_degrees: 0 | 90 | 180 | 270;
    top_left_x: number;
    top_left_y: number;
    top_right_x: number;
    top_right_y: number;
    bottom_right_x: number;
    bottom_right_y: number;
    bottom_left_x: number;
    bottom_left_y: number;
  };
  return invoke<{ identity: Layout; bank: Layout }>("advisory-intake-analyze-document-layout", {
    voter_token: token,
    document_type: "IDENTITY_BANK",
    file_name: fileName,
    data_url: dataUrl
  });
}

export function verifyAdvisoryDocumentNames(token: string, force = false) {
  return invoke<{ documents: Array<{
    document_type: AdvisoryDocumentType;
    name_verification_status: AdvisoryNameVerificationStatus;
    name_matches_member: boolean | null;
    name_verified_at?: string | null;
    extracted_bank_name?: string;
    extracted_account_number?: string;
    extracted_account_holder?: string;
    extracted_resident_number?: string;
    extracted_address?: string;
  }> }>("advisory-intake-verify-document-names", { voter_token: token, force });
}

export function uploadAdvisoryAttachment(token: string, fileName: string, dataUrl: string) {
  return invoke<{ attachment: AdvisorySubmissionAttachment }>("advisory-intake-upload-attachment", {
    voter_token: token,
    file_name: fileName,
    data_url: dataUrl
  });
}

export function deleteAdvisoryAttachment(token: string, attachmentId: string) {
  return invoke<{ deleted: boolean }>("advisory-intake-delete-attachment", {
    voter_token: token,
    attachment_id: attachmentId
  });
}

export function submitAdvisoryIntake(token: string, submission: AdvisoryIntakeSubmission) {
  return invoke<{ submitted_at: string; revision: number }>("advisory-intake-submit", {
    voter_token: token,
    submission
  });
}

export function saveExpertGeneratedDocument(
  token: string,
  documentType: "IDENTITY_BANK_PDF" | "RESUME_PDF",
  fileName: string,
  dataUrl: string
) {
  return invoke<{ saved: boolean; document_type: string; original_name: string; updated_at: string }>(
    "expert-document-save-generated",
    { voter_token: token, document_type: documentType, file_name: fileName, data_url: dataUrl }
  );
}

export function getCommitteeVoteErrorMessage(error: unknown): string {
  if (!(error instanceof CommitteeVoteApiError)) {
    return "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }

  const messages: Record<CommitteeVoteErrorCode, string> = {
    INVALID_CREDENTIALS: "성명 또는 보안 PIN을 확인해 주세요.",
    LOCKED: "인증 시도가 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.",
    MEETING_CLOSED: "현재 심의·의결을 제출할 수 없는 회의입니다.",
    INCOMPLETE_AGENDAS: "모든 안건의 표결 또는 평가를 선택해 주세요.",
    SCORE_OUT_OF_RANGE: "평가점수가 해당 평가분야의 배점을 초과했습니다. 배점 범위 안에서 입력해 주세요.",
    CONFLICT: "필수 항목과 강사 성명을 확인해 주세요.",
    FORBIDDEN: "서류 인증이 만료되었거나 접근 권한이 없습니다. 다시 인증해 주세요.",
    NOT_FOUND: "서류 대상을 찾을 수 없습니다.",
    INVALID_DOCUMENT: "허용된 형식의 올바른 문서가 아닙니다.",
    DOCUMENT_TOO_LARGE: "문서가 허용된 파일 크기를 초과했습니다.",
    STORAGE_NOT_CONFIGURED: "강사 서류 보안 저장소가 운영 서버에 구성되지 않았습니다.",
    STORAGE_UPLOAD_FAILED: "강사 서류 보안 저장소에 문서를 업로드하지 못했습니다.",
    AI_NOT_CONFIGURED: "AI 문서 판독 서버의 API 키가 없거나 유효하지 않습니다. 관리자가 서버 비밀값을 갱신해야 합니다.",
    AI_AUTH_FAILED: "AI 문서 판독 API 인증에 실패했습니다. 관리자가 서버 비밀값을 확인해야 합니다.",
    AI_RATE_LIMITED: "AI 문서 판독 사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.",
    AI_RESPONSE_INVALID: "AI 문서 판독 응답 형식이 올바르지 않습니다. 다시 시도해 주세요.",
    AI_ANALYSIS_FAILED: "문서 내용을 AI로 판독하지 못했습니다. 선명한 원본을 확인한 뒤 다시 시도해 주세요.",
    DOCUMENT_NOT_DETECTED: "신분증 또는 통장 계좌정보 영역을 찾지 못했습니다. 선명한 원본을 확인해 주세요.",
    PDF_RENDER_FAILED: "PDF 페이지를 이미지로 변환하지 못했습니다. 암호화 여부나 파일 손상을 확인해 주세요.",
    NETWORK_ERROR: "강사 서류 보안 서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.",
    SERVER_ERROR: "강사 서류 서버에서 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."
  };

  return messages[error.code] || error.message;
}
