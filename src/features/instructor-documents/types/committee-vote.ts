export type CommitteeVoteErrorCode =
  | "INVALID_CREDENTIALS"
  | "LOCKED"
  | "MEETING_CLOSED"
  | "INCOMPLETE_AGENDAS"
  | "SCORE_OUT_OF_RANGE"
  | "CONFLICT"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_DOCUMENT"
  | "DOCUMENT_TOO_LARGE"
  | "STORAGE_NOT_CONFIGURED"
  | "STORAGE_UPLOAD_FAILED"
  | "AI_NOT_CONFIGURED"
  | "AI_AUTH_FAILED"
  | "AI_RATE_LIMITED"
  | "AI_RESPONSE_INVALID"
  | "AI_ANALYSIS_FAILED"
  | "DOCUMENT_NOT_DETECTED"
  | "PDF_RENDER_FAILED"
  | "NETWORK_ERROR"
  | "SERVER_ERROR";

export class CommitteeVoteApiError extends Error {
  readonly code: CommitteeVoteErrorCode;
  readonly status?: number;

  constructor(code: CommitteeVoteErrorCode, message: string, status?: number) {
    super(message);
    this.name = "CommitteeVoteApiError";
    this.code = code;
    this.status = status;
  }
}
