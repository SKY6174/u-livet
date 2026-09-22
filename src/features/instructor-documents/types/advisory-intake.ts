export type AdvisoryDocumentType = "ID_COPY" | "BANK_COPY";
export type AdvisoryOpinionFontSize = 10 | 11 | 12 | 13;
export type AdvisoryNameVerificationStatus = "MATCH" | "MISMATCH" | "UNVERIFIED" | "FAILED";

export interface AdvisoryEducationRow {
  period: string;
  school: string;
  department_major: string;
  degree_type: string;
}

export interface AdvisoryCareerRow {
  employment_period: string;
  organization: string;
  position: string;
  duties: string;
}

export interface AdvisoryPolicyResearchRow {
  year: string;
  title: string;
  role: string;
  client: string;
  notes: string;
}

export interface AdvisoryLicenseRow {
  acquired_date: string;
  type: string;
  issuer: string;
}

export interface AdvisoryResume {
  korean_name: string;
  hanja_name: string;
  english_name: string;
  email: string;
  resident_number: string;
  address: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  phones: {
    home: string;
    work: string;
    mobile: string;
  };
  education: AdvisoryEducationRow[];
  careers: AdvisoryCareerRow[];
  include_policy_research: boolean;
  policy_research: AdvisoryPolicyResearchRow[];
  include_licenses: boolean;
  licenses: AdvisoryLicenseRow[];
}

export interface AdvisoryResumeAiAnalysis {
  resume: AdvisoryResume;
  warnings: string[];
  model: "gpt-5.6-luna" | "gemini-3.1-pro-preview";
}

export interface AdvisoryStoredDocumentStatus {
  exists: boolean;
  is_draft?: boolean;
  original_name?: string;
  updated_at?: string;
  signed_url?: string;
  content_type?: string;
  name_verification_status?: AdvisoryNameVerificationStatus | null;
  name_matches_member?: boolean | null;
  name_verified_at?: string | null;
  extracted_bank_name?: string;
  extracted_account_number?: string;
  extracted_account_holder?: string;
  extracted_resident_number?: string;
  extracted_address?: string;
  extracted_at?: string | null;
}

export interface AdvisorySubmissionAttachment {
  id: string;
  original_name: string;
  content_type: string;
  file_extension: string;
  size_bytes: number;
  submitted_at: string;
  signed_url?: string;
}

export interface AdvisoryIntakeContext {
  meeting: {
    id: string;
    title: string;
    meeting_date?: string | null;
    meeting_end_date?: string | null;
    submission_deadline?: string | null;
    closes_at?: string | null;
    status: string;
  };
  member: {
    id: string | number;
    name: string;
    org?: string | null;
    dept?: string | null;
    rank?: string | null;
  };
  submission?: {
    opinion_title: string;
    opinion_markdown: string;
    personal_info_consent: boolean;
    unique_id_consent: boolean;
    has_signature?: boolean;
    signature_url?: string | null;
    signature_original_name?: string | null;
    square_bullet_font_size?: AdvisoryOpinionFontSize;
    triangle_bullet_font_size?: AdvisoryOpinionFontSize;
    revision: number;
    submitted_at: string;
  } | null;
  submission_draft?: {
    opinion_title: string;
    opinion_markdown: string;
    personal_info_consent: boolean;
    unique_id_consent: boolean;
    square_bullet_font_size: AdvisoryOpinionFontSize;
    triangle_bullet_font_size: AdvisoryOpinionFontSize;
    updated_at: string;
  } | null;
  resume: AdvisoryResume | null;
  documents: {
    ID_COPY: AdvisoryStoredDocumentStatus;
    BANK_COPY: AdvisoryStoredDocumentStatus;
    RESUME: AdvisoryStoredDocumentStatus;
  };
  attachments: AdvisorySubmissionAttachment[];
}

export interface AdvisoryIntakeSubmission {
  opinion_title: string;
  opinion_markdown: string;
  personal_info_consent: boolean;
  unique_id_consent: boolean;
  signature_data_url?: string;
  signature_file_name?: string;
  square_bullet_font_size: AdvisoryOpinionFontSize;
  triangle_bullet_font_size: AdvisoryOpinionFontSize;
}

export interface AdvisoryOpinionAdminUpdate {
  opinion_title: string;
  opinion_markdown: string;
  square_bullet_font_size: AdvisoryOpinionFontSize;
  triangle_bullet_font_size: AdvisoryOpinionFontSize;
}

export interface AdvisorySubmissionStatusMember {
  member_id: string | number;
  name: string;
  org?: string | null;
  dept?: string | null;
  rank?: string | null;
  has_opinion: boolean;
  opinion_is_draft?: boolean;
  has_consent: boolean;
  consent_is_draft?: boolean;
  requires_final_submission?: boolean;
  submitted_at?: string | null;
  has_id_copy: boolean;
  has_bank_copy: boolean;
  id_name_verification_status?: AdvisoryNameVerificationStatus | null;
  id_name_matches_member?: boolean | null;
  bank_name_verification_status?: AdvisoryNameVerificationStatus | null;
  bank_name_matches_member?: boolean | null;
  has_resume: boolean;
  resume_is_draft?: boolean;
  attachment_count: number;
}

export interface AdvisoryBundleDocument {
  signed_url: string;
  content_type: string;
  original_name: string;
  name_verification_status?: AdvisoryNameVerificationStatus | null;
  name_matches_member?: boolean | null;
  name_verified_at?: string | null;
  extracted_bank_name?: string;
  extracted_account_number?: string;
  extracted_account_holder?: string;
  extracted_resident_number?: string;
  extracted_address?: string;
  extracted_at?: string | null;
}

export interface AdvisoryDocumentBundle {
  meeting: AdvisorySubmissionStatus["meeting"] & {
    meeting_date?: string | null;
    meeting_end_date?: string | null;
    submission_deadline?: string | null;
  };
  member: {
    id: string | number;
    name: string;
    org?: string | null;
    dept?: string | null;
    rank?: string | null;
  };
  submission: AdvisoryIntakeContext["submission"];
  resume: AdvisoryResume | null;
  resume_is_draft?: boolean;
  documents: {
    ID_COPY: AdvisoryBundleDocument | null;
    BANK_COPY: AdvisoryBundleDocument | null;
  };
  attachments: AdvisorySubmissionAttachment[];
}

export interface AdvisorySubmissionStatus {
  meeting: { id: string; title: string };
  members: AdvisorySubmissionStatusMember[];
}

export interface AdvisoryInstructorDocumentStatus {
  instructor_id?: string;
  member_id: string | number;
  name: string;
  org?: string | null;
  dept?: string | null;
  has_id_copy: boolean;
  has_bank_copy: boolean;
  has_resume: boolean;
  updated_at?: string | null;
  masked_birth_date?: string;
  bank_name?: string;
  masked_account_number?: string;
}

export interface ExpertDocumentInvite {
  instructor_id: string;
  name: string;
  public_code: string;
  pin: string;
  expires_at: string;
}

export interface ExpertDocumentPublicContext {
  public_code: string;
  expires_at: string;
  expert: { name: string; organization?: string; department?: string; position?: string };
}

export interface ExpertDocumentDownloads {
  documents: Array<{
    document_type: "ID_COPY" | "BANK_COPY";
    original_name: string;
    content_type: string;
    signed_url: string;
  }>;
  resume: AdvisoryResume | null;
  generated_documents: Array<{
    document_type: "IDENTITY_BANK_PDF" | "RESUME_PDF";
    original_name: string;
    signed_url: string;
  }>;
}

export interface ExpertDocumentAdminSession {
  token: string;
  member: Record<string, unknown>;
  expires_at: string;
}
