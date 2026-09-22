"use client";
/* eslint-disable @next/next/no-img-element -- Uploaded private images and A4 canvas capture. */
import React from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Contact, CreditCard, FileText, LogOut, Paperclip, Plus, Save, Send, ShieldCheck, Sparkles, Trash2, Upload } from "lucide-react";
import {
  analyzeAdvisoryDocumentLayout,
  analyzeAdvisoryIdentityBankLayouts,
  analyzeAdvisoryResume,
  deleteAdvisoryAttachment,
  getAdvisoryIntakeContext,
  getCommitteeVoteErrorMessage,
  saveAdvisoryResume,
  saveAdvisoryResumeDraft,
  saveAdvisorySubmissionDraft,
  saveExpertGeneratedDocument,
  submitAdvisoryIntake,
  uploadAdvisoryAttachment,
  uploadAdvisoryDocument,
  verifyAdvisoryDocumentNames
} from "../../services/committee-vote-service";
import { CommitteeVoteApiError } from "../../types/committee-vote";
import {
  type AdvisoryCareerRow,
  type AdvisoryDocumentType,
  type AdvisoryIntakeContext,
  type AdvisoryOpinionFontSize,
  type AdvisoryResume
} from "../../types/advisory-intake";
import { AdvisoryOpinionPreview } from "./advisory-opinion-preview";
import { AdvisoryConsentPreview } from "./advisory-consent-preview";
import { AdvisoryIdentityBankPreview } from "./advisory-identity-bank-preview";
import { AdvisoryResumePreview } from "./advisory-resume-preview";
import { AdvisoryA4PreviewShell } from "./advisory-a4-preview-shell";
import { AdvisorySignaturePad } from "./advisory-signature-pad";
import { waitForAdvisoryDocumentFonts } from "./advisory-document-font";
import {
  advisoryDocumentUrlToDataUrl,
  createAdvisoryDocumentAnalysisPreview,
  createAdvisoryDocumentRemakePages,
  isUsableAdvisoryDocumentLayout,
  normalizeAdvisoryDocument,
  type AdvisoryDocumentLayout
} from "../../features/committee/utils/advisory-document-image";
import {
  ADVISORY_BEST_PRACTICE_HEADING,
  ADVISORY_IMPROVEMENT_HEADING,
  ADVISORY_OPERATION_HEADING,
  type AdvisoryOpinionSectionKey,
  composeAdvisoryOpinionMarkdown,
  parseAdvisoryOpinionMarkdown
} from "../../features/committee/utils/advisory-opinion";
import { formatBankAccountNumber } from "../../utils/bank-account";
import { getPdfCanvasPlacement, PDF_STANDARD, toPdf17DataUri } from "../../utils/pdf-export-standard";
import { createPdf17 } from "@/lib/pdf/browser";

const CONSENT_VERSION = "2026-08-14";
type AdvisoryPage = "OPINION" | "CONSENT" | "IDENTITY_BANK" | "RESUME";
type ResumeDraftStatus = "idle" | "pending" | "saving" | "saved" | "error";
type SubmissionDraftStatus = ResumeDraftStatus;
type IdentityBankRemakePhase = "SELECTED" | "ANALYZING" | "OPTIMIZING" | "UPLOADING" | "VERIFYING" | "COMPLETED" | "FAILED";
interface IdentityBankRemakeStatus {
  fileName: string;
  phase: IdentityBankRemakePhase;
  message: string;
}
interface AdvisoryDraft {
  opinionTitle?: string;
  operationOpinion?: string;
  bestPracticeOpinion?: string;
  improvementOpinion?: string;
  selectedOpinionSections?: AdvisoryOpinionSectionKey[];
  preservedMarkdown?: string;
  opinionMarkdown?: string;
  squareBulletFontSize?: AdvisoryOpinionFontSize;
  triangleBulletFontSize?: AdvisoryOpinionFontSize;
  personalInfoConsent?: boolean;
  uniqueIdConsent?: boolean;
}
const ADVISORY_FONT_SIZES: AdvisoryOpinionFontSize[] = [10, 11, 12, 13];
const MAX_EDUCATION_ROWS = 3;
const MAX_CAREER_ROWS = 5;
const MAX_POLICY_RESEARCH_ROWS = 3;
const MAX_LICENSE_ROWS = 6;
const MAX_AI_RESUME_FILE_BYTES = 6 * 1024 * 1024;
const MAX_ADVISORY_ATTACHMENT_FILES = 5;
const MAX_ADVISORY_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const moveAdvisoryCareerRow = (
  rows: AdvisoryCareerRow[],
  sourceIndex: number,
  targetIndex: number
): AdvisoryCareerRow[] => {
  if (targetIndex < 0 || targetIndex >= rows.length || sourceIndex === targetIndex) return rows;
  const reordered = [...rows];
  const [moved] = reordered.splice(sourceIndex, 1);
  reordered.splice(targetIndex, 0, moved);
  return reordered;
};
const ADVISORY_PAGE_HASH: Record<AdvisoryPage, string> = {
  OPINION: "advisory-opinion",
  CONSENT: "advisory-consent",
  IDENTITY_BANK: "advisory-identity-bank",
  RESUME: "advisory-resume"
};
const getInitialAdvisoryPage = (): AdvisoryPage => {
  const hash = window.location.hash.replace(/^#/, "");
  if (["advisory-id-copy", "advisory-bank-copy"].includes(hash)) return "IDENTITY_BANK";
  return (Object.entries(ADVISORY_PAGE_HASH).find(([, value]) => value === hash)?.[0] as AdvisoryPage) || "OPINION";
};
const advisoryDraftKey = (meetingId: string, memberId: string | number) => `advisory-opinion-draft:${meetingId}:${memberId}`;
const normalizedPersonName = (value: string) => value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(new RegExp("[^\\p{L}\\p{N}]", "gu"), "");
const createEmptyAdvisoryResume = (name = ""): AdvisoryResume => ({
  korean_name: name,
  hanja_name: "",
  english_name: "",
  email: "",
  resident_number: "",
  address: "",
  bank_name: "",
  account_number: "",
  account_holder: name,
  phones: { home: "", work: "", mobile: "" },
  education: [{ period: "", school: "", department_major: "", degree_type: "" }],
  careers: [{ employment_period: "", organization: "", position: "", duties: "" }],
  include_policy_research: false,
  policy_research: [],
  include_licenses: false,
  licenses: []
});

const normalizeAdvisoryResume = (
  resume: AdvisoryResume | null,
  name: string,
  maxCareerRows = MAX_CAREER_ROWS
): AdvisoryResume => {
  const empty = createEmptyAdvisoryResume(name);
  if (!resume) return empty;
  const education = (resume.education || []).slice(0, MAX_EDUCATION_ROWS);
  const careers = (resume.careers || []).slice(0, maxCareerRows).map(row => ({
    employment_period: row.employment_period || "",
    organization: row.organization || "",
    position: row.position || "",
    duties: row.duties || ""
  }));
  const policyResearch = (resume.policy_research || []).slice(0, MAX_POLICY_RESEARCH_ROWS);
  const licenses = (resume.licenses || []).slice(0, MAX_LICENSE_ROWS);
  const includePolicyResearch = Boolean(resume.include_policy_research || policyResearch.length);
  const includeLicenses = Boolean(resume.include_licenses || licenses.length);
  return {
    ...empty,
    ...resume,
    bank_name: resume.bank_name || "",
    account_number: formatBankAccountNumber(resume.bank_name || "", resume.account_number || ""),
    account_holder: resume.account_holder || resume.korean_name || name,
    phones: { ...empty.phones, ...resume.phones },
    education: education.length > 0 ? education : empty.education,
    careers: careers.length > 0 ? careers : empty.careers,
    include_policy_research: includePolicyResearch,
    policy_research: includePolicyResearch && policyResearch.length === 0
      ? [{ year: "", title: "", role: "", client: "", notes: "" }]
      : policyResearch,
    include_licenses: includeLicenses,
    licenses: includeLicenses && licenses.length === 0
      ? [{ acquired_date: "", type: "", issuer: "" }]
      : licenses
  };
};

const resumeWithExtractedDocuments = (loaded: AdvisoryIntakeContext): AdvisoryResume => {
  const normalized = normalizeAdvisoryResume(loaded.resume, loaded.member.name);
  const bankDocument = loaded.documents.BANK_COPY;
  const identityDocument = loaded.documents.ID_COPY;
  const bankName = bankDocument.extracted_bank_name || normalized.bank_name;
  return {
    ...normalized,
    resident_number: identityDocument.extracted_resident_number || normalized.resident_number,
    address: identityDocument.extracted_address || normalized.address,
    bank_name: bankName,
    account_number: formatBankAccountNumber(
      bankName,
      bankDocument.extracted_account_number || normalized.account_number
    ),
    account_holder: bankDocument.extracted_account_holder || normalized.account_holder
  };
};

interface AdvisoryExternalSubmissionProps {
  voterToken: string;
  onLogout: () => void;
  documentOnly?: boolean;
  initialDocument?: "IDENTITY_BANK" | "RESUME";
}

const readFileDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ""));
  reader.onerror = () => reject(new Error("FILE_READ_FAILED"));
  reader.readAsDataURL(file);
});

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="advisory-form-field">
    <span>{label}</span>
    {children}
  </label>
);

export function AdvisoryExternalSubmission({ voterToken, onLogout, documentOnly = false, initialDocument = "IDENTITY_BANK" }: AdvisoryExternalSubmissionProps) {
  const [context, setContext] = React.useState<AdvisoryIntakeContext | null>(null);
  const [activePage, setActivePage] = React.useState<AdvisoryPage>(documentOnly ? initialDocument : getInitialAdvisoryPage);
  const [opinionTitle, setOpinionTitle] = React.useState("");
  const [operationOpinion, setOperationOpinion] = React.useState("");
  const [bestPracticeOpinion, setBestPracticeOpinion] = React.useState("");
  const [improvementOpinion, setImprovementOpinion] = React.useState("");
  const [selectedOpinionSections, setSelectedOpinionSections] = React.useState<AdvisoryOpinionSectionKey[]>(["operation", "bestPractice"]);
  const [preservedMarkdown, setPreservedMarkdown] = React.useState("");
  const [squareBulletFontSize, setSquareBulletFontSize] = React.useState<AdvisoryOpinionFontSize>(12);
  const [triangleBulletFontSize, setTriangleBulletFontSize] = React.useState<AdvisoryOpinionFontSize>(11);
  const [personalInfoConsent, setPersonalInfoConsent] = React.useState(false);
  const [uniqueIdConsent, setUniqueIdConsent] = React.useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = React.useState("");
  const [signatureFileName, setSignatureFileName] = React.useState("");
  const [signaturePreviewUrl, setSignaturePreviewUrl] = React.useState("");
  const [idPreviewUrl, setIdPreviewUrl] = React.useState("");
  const [bankPreviewUrl, setBankPreviewUrl] = React.useState("");
  const [resume, setResume] = React.useState<AdvisoryResume>(createEmptyAdvisoryResume());
  const [resumeDraftStatus, setResumeDraftStatus] = React.useState<ResumeDraftStatus>("idle");
  const [submissionDraftStatus, setSubmissionDraftStatus] = React.useState<SubmissionDraftStatus>("idle");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSavingResume, setIsSavingResume] = React.useState(false);
  const [isAnalyzingResume, setIsAnalyzingResume] = React.useState(false);
  const [pendingAiResume, setPendingAiResume] = React.useState<AdvisoryResume | null>(null);
  const [selectedAiCareerIndexes, setSelectedAiCareerIndexes] = React.useState<number[]>([]);
  const [uploadingType, setUploadingType] = React.useState<AdvisoryDocumentType | "">("");
  const [isRemakingIdentityBank, setIsRemakingIdentityBank] = React.useState(false);
  const [identityBankRemakeStatus, setIdentityBankRemakeStatus] = React.useState<IdentityBankRemakeStatus | null>(null);
  const [isExtractingDocumentInfo, setIsExtractingDocumentInfo] = React.useState(false);
  const [isUploadingAttachments, setIsUploadingAttachments] = React.useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const [savingGeneratedPdf, setSavingGeneratedPdf] = React.useState<"IDENTITY_BANK_PDF" | "RESUME_PDF" | "">("");
  const identityPreviewRef = React.useRef<HTMLDivElement>(null);
  const resumePreviewRef = React.useRef<HTMLDivElement>(null);
  const resumeDraftReadyRef = React.useRef(false);
  const resumeBaselineRef = React.useRef("");
  const resumeLatestSerializedRef = React.useRef("");
  const resumeDraftTimerRef = React.useRef<number | null>(null);
  const resumeDraftQueueRef = React.useRef<Promise<void>>(Promise.resolve());
  const submissionDraftReadyRef = React.useRef(false);
  const submissionDraftBaselineRef = React.useRef("");
  const submissionDraftLatestSerializedRef = React.useRef("");
  const submissionDraftTimerRef = React.useRef<number | null>(null);
  const submissionDraftQueueRef = React.useRef<Promise<void>>(Promise.resolve());

  const savePreviewPdf = React.useCallback(async (
    documentType: "IDENTITY_BANK_PDF" | "RESUME_PDF",
    showNotice = true
  ) => {
    const previewHost = documentType === "IDENTITY_BANK_PDF" ? identityPreviewRef.current : resumePreviewRef.current;
    const paper = previewHost?.querySelector<HTMLElement>(".advisory-paper");
    if (!paper || !context) throw new Error("PDF 미리보기를 준비하지 못했습니다.");
    setSavingGeneratedPdf(documentType);
    let captureHost: HTMLDivElement | null = null;
    try {
      await waitForAdvisoryDocumentFonts(document);
      const { default: html2canvas } = await import("html2canvas");
      captureHost = document.createElement("div");
      captureHost.className = "advisory-pdf-capture-host";
      const capturePaper = paper.cloneNode(true) as HTMLElement;
      capturePaper.classList.add("advisory-print-color-safe", "advisory-pdf-capture-paper");
      captureHost.appendChild(capturePaper);
      document.body.appendChild(captureHost);
      await Promise.all(Array.from(capturePaper.querySelectorAll("img"))
        .map(image => image.decode().catch(() => undefined)));
      const canvas = await html2canvas(capturePaper, { backgroundColor: "#ffffff", logging: false, scale: 2, useCORS: true });
      const pdf = await createPdf17({ orientation: PDF_STANDARD.orientation, unit: PDF_STANDARD.unit, format: PDF_STANDARD.format });
      const placement = getPdfCanvasPlacement(canvas.width, canvas.height);
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", placement.x, placement.y, placement.width, placement.height, undefined, "FAST");
      const fileName = documentType === "IDENTITY_BANK_PDF"
        ? `강사-신분증-통장사본(${context.member.name}).pdf`
        : `강사-이력서(${context.member.name}).pdf`;
      const dataUri = await toPdf17DataUri(pdf.output("arraybuffer"));
      await saveExpertGeneratedDocument(voterToken, documentType, fileName, dataUri);
      if (showNotice) setNotice(`${fileName}를 비공개 저장소에 PDF로 저장했습니다.`);
    } finally {
      captureHost?.remove();
      setSavingGeneratedPdf("");
    }
  }, [context, voterToken]);

  React.useEffect(() => {
    let cancelled = false;
    resumeDraftReadyRef.current = false;
    submissionDraftReadyRef.current = false;
    if (resumeDraftTimerRef.current !== null) window.clearTimeout(resumeDraftTimerRef.current);
    if (submissionDraftTimerRef.current !== null) window.clearTimeout(submissionDraftTimerRef.current);
    const load = async () => {
      try {
        const loaded = await getAdvisoryIntakeContext(voterToken);
        const requiresNameVerification = ([loaded.documents.ID_COPY, loaded.documents.BANK_COPY]).some(document =>
          document.exists && [undefined, null, "UNVERIFIED"].includes(document.name_verification_status)
        ) || (loaded.documents.ID_COPY.exists && (
          !loaded.documents.ID_COPY.extracted_resident_number || !loaded.documents.ID_COPY.extracted_address
        )) || (loaded.documents.BANK_COPY.exists && (
          !loaded.documents.BANK_COPY.extracted_bank_name
          || !loaded.documents.BANK_COPY.extracted_account_number
          || !loaded.documents.BANK_COPY.extracted_account_holder
        ));
        if (cancelled) return;
        const storedDraft = documentOnly ? null : localStorage.getItem(advisoryDraftKey(loaded.meeting.id, loaded.member.id));
        let draft: AdvisoryDraft = {};
        if (!loaded.submission && !loaded.submission_draft && storedDraft) {
          try {
            draft = JSON.parse(storedDraft) as AdvisoryDraft;
          } catch {
            localStorage.removeItem(advisoryDraftKey(loaded.meeting.id, loaded.member.id));
          }
        }
        const serverDraft = loaded.submission_draft;
        const sourceMarkdown = loaded.submission?.opinion_markdown || serverDraft?.opinion_markdown || draft?.opinionMarkdown || "";
        const sourceTitle = loaded.submission?.opinion_title || serverDraft?.opinion_title || draft?.opinionTitle || loaded.meeting.title;
        setContext(loaded);
        setOpinionTitle(sourceTitle);
        const storedSections = parseAdvisoryOpinionMarkdown(sourceMarkdown);
        setOperationOpinion(draft?.operationOpinion ?? storedSections.operationOpinion);
        setBestPracticeOpinion(draft?.bestPracticeOpinion ?? storedSections.bestPracticeOpinion);
        setImprovementOpinion(draft?.improvementOpinion ?? storedSections.improvementOpinion);
        const restoredSections = draft?.selectedOpinionSections ?? storedSections.selectedSections ?? [];
        setSelectedOpinionSections(restoredSections.length >= 2 ? restoredSections : ["operation", "bestPractice"]);
        setPreservedMarkdown(draft?.preservedMarkdown ?? storedSections.preservedMarkdown ?? "");
        const restoredSquareFontSize = loaded.submission?.square_bullet_font_size || serverDraft?.square_bullet_font_size || draft?.squareBulletFontSize || 12;
        const restoredTriangleFontSize = loaded.submission?.triangle_bullet_font_size || serverDraft?.triangle_bullet_font_size || draft?.triangleBulletFontSize || 11;
        const restoredPersonalConsent = Boolean(loaded.submission?.personal_info_consent ?? serverDraft?.personal_info_consent ?? draft.personalInfoConsent);
        const restoredUniqueConsent = Boolean(loaded.submission?.unique_id_consent ?? serverDraft?.unique_id_consent ?? draft.uniqueIdConsent);
        setSquareBulletFontSize(restoredSquareFontSize);
        setTriangleBulletFontSize(restoredTriangleFontSize);
        setPersonalInfoConsent(restoredPersonalConsent);
        setUniqueIdConsent(restoredUniqueConsent);
        const restoredMarkdown = composeAdvisoryOpinionMarkdown({
          operationOpinion: draft?.operationOpinion ?? storedSections.operationOpinion,
          bestPracticeOpinion: draft?.bestPracticeOpinion ?? storedSections.bestPracticeOpinion,
          improvementOpinion: draft?.improvementOpinion ?? storedSections.improvementOpinion,
          selectedSections: restoredSections.length >= 2 ? restoredSections : ["operation", "bestPractice"],
          preservedMarkdown: draft?.preservedMarkdown ?? storedSections.preservedMarkdown ?? ""
        });
        submissionDraftBaselineRef.current = JSON.stringify({
          opinion_title: sourceTitle,
          opinion_markdown: restoredMarkdown,
          personal_info_consent: restoredPersonalConsent,
          unique_id_consent: restoredUniqueConsent,
          square_bullet_font_size: restoredSquareFontSize,
          triangle_bullet_font_size: restoredTriangleFontSize
        });
        submissionDraftLatestSerializedRef.current = submissionDraftBaselineRef.current;
        submissionDraftReadyRef.current = true;
        setSubmissionDraftStatus(serverDraft ? "saved" : "idle");
        setSignaturePreviewUrl(loaded.submission?.signature_url || "");
        const loadedResume = resumeWithExtractedDocuments(loaded);
        resumeBaselineRef.current = JSON.stringify(loadedResume);
        resumeLatestSerializedRef.current = resumeBaselineRef.current;
        resumeDraftReadyRef.current = true;
        setResumeDraftStatus(loaded.documents.RESUME.is_draft ? "saved" : "idle");
        setResume(loadedResume);
        const [idPreview, bankPreview] = await Promise.all([
          loaded.documents.ID_COPY.signed_url
            ? advisoryDocumentUrlToDataUrl(loaded.documents.ID_COPY.signed_url, loaded.documents.ID_COPY.content_type || "image/jpeg", "ID_COPY")
            : Promise.resolve(""),
          loaded.documents.BANK_COPY.signed_url
            ? advisoryDocumentUrlToDataUrl(loaded.documents.BANK_COPY.signed_url, loaded.documents.BANK_COPY.content_type || "image/jpeg", "BANK_COPY")
            : Promise.resolve("")
        ]);
        if (!cancelled) {
          setIdPreviewUrl(idPreview);
          setBankPreviewUrl(bankPreview);
        }
        if (requiresNameVerification) {
          void verifyAdvisoryDocumentNames(voterToken).then(async () => {
            const refreshed = await getAdvisoryIntakeContext(voterToken);
            if (cancelled) return;
            setContext(refreshed);
            setResume(current => {
              const extracted = resumeWithExtractedDocuments(refreshed);
              const nextResume = {
                ...current,
                resident_number: refreshed.documents.ID_COPY.extracted_resident_number || current.resident_number,
                address: refreshed.documents.ID_COPY.extracted_address || current.address,
                bank_name: refreshed.documents.BANK_COPY.extracted_bank_name || current.bank_name,
                account_number: refreshed.documents.BANK_COPY.extracted_account_number || current.account_number,
                account_holder: refreshed.documents.BANK_COPY.extracted_account_holder || current.account_holder,
                korean_name: current.korean_name || extracted.korean_name
              };
              resumeBaselineRef.current = JSON.stringify(nextResume);
              resumeLatestSerializedRef.current = resumeBaselineRef.current;
              return nextResume;
            });
          }).catch(error => {
            if (!cancelled) setNotice(getCommitteeVoteErrorMessage(error));
          });
        }
      } catch (error) {
        if (!cancelled) setNotice(getCommitteeVoteErrorMessage(error));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [voterToken, documentOnly]);

  React.useEffect(() => {
    const handleHashChange = () => {
      const page = getInitialAdvisoryPage();
      setActivePage(documentOnly && !["IDENTITY_BANK", "RESUME"].includes(page) ? "IDENTITY_BANK" : page);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [documentOnly]);

  React.useEffect(() => {
    if (!context || documentOnly || !submissionDraftReadyRef.current) return;
    const opinionMarkdown = composeAdvisoryOpinionMarkdown({
      operationOpinion,
      bestPracticeOpinion,
      improvementOpinion,
      selectedSections: selectedOpinionSections,
      preservedMarkdown
    });
    const draftPayload = {
      opinion_title: opinionTitle,
      opinion_markdown: opinionMarkdown,
      personal_info_consent: personalInfoConsent,
      unique_id_consent: uniqueIdConsent,
      square_bullet_font_size: squareBulletFontSize,
      triangle_bullet_font_size: triangleBulletFontSize
    };
    const serializedDraft = JSON.stringify(draftPayload);
    submissionDraftLatestSerializedRef.current = serializedDraft;
    const localTimer = window.setTimeout(() => {
      localStorage.setItem(
        advisoryDraftKey(context.meeting.id, context.member.id),
        JSON.stringify({ opinionTitle, operationOpinion, bestPracticeOpinion, improvementOpinion, selectedOpinionSections, preservedMarkdown, squareBulletFontSize, triangleBulletFontSize, personalInfoConsent, uniqueIdConsent })
      );
    }, 400);
    if (serializedDraft === submissionDraftBaselineRef.current) {
      return () => window.clearTimeout(localTimer);
    }
    setSubmissionDraftStatus("pending");
    if (submissionDraftTimerRef.current !== null) window.clearTimeout(submissionDraftTimerRef.current);
    submissionDraftTimerRef.current = window.setTimeout(() => {
      setSubmissionDraftStatus("saving");
      submissionDraftQueueRef.current = submissionDraftQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          await saveAdvisorySubmissionDraft(voterToken, draftPayload);
          submissionDraftBaselineRef.current = serializedDraft;
          setSubmissionDraftStatus(current => submissionDraftLatestSerializedRef.current === serializedDraft ? "saved" : current);
        })
        .catch(() => setSubmissionDraftStatus("error"));
    }, 900);
    return () => {
      window.clearTimeout(localTimer);
      if (submissionDraftTimerRef.current !== null) window.clearTimeout(submissionDraftTimerRef.current);
    };
  }, [bestPracticeOpinion, context, documentOnly, improvementOpinion, operationOpinion, opinionTitle, personalInfoConsent, preservedMarkdown, selectedOpinionSections, squareBulletFontSize, triangleBulletFontSize, uniqueIdConsent, voterToken]);

  React.useEffect(() => {
    if (!context || !resumeDraftReadyRef.current) return;
    const draftResume = normalizeAdvisoryResume(resume, context.member.name);
    const serializedDraft = JSON.stringify(draftResume);
    resumeLatestSerializedRef.current = serializedDraft;
    if (serializedDraft === resumeBaselineRef.current) return;

    setResumeDraftStatus("pending");
    if (resumeDraftTimerRef.current !== null) window.clearTimeout(resumeDraftTimerRef.current);
    resumeDraftTimerRef.current = window.setTimeout(() => {
      setResumeDraftStatus("saving");
      resumeDraftQueueRef.current = resumeDraftQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          await saveAdvisoryResumeDraft(voterToken, draftResume);
          resumeBaselineRef.current = serializedDraft;
          setResumeDraftStatus(current => resumeLatestSerializedRef.current === serializedDraft ? "saved" : current);
        })
        .catch(() => setResumeDraftStatus("error"));
    }, 1200);

    return () => {
      if (resumeDraftTimerRef.current !== null) window.clearTimeout(resumeDraftTimerRef.current);
    };
  }, [context, resume, voterToken]);

  const toggleOpinionSection = (section: AdvisoryOpinionSectionKey) => {
    if (selectedOpinionSections.includes(section)) {
      if (selectedOpinionSections.length <= 2) {
        setNotice("자문의견 사안은 3개 중 2개 이상 선택해야 합니다.");
        return;
      }
      setSelectedOpinionSections(current => current.filter(item => item !== section));
      return;
    }
    setSelectedOpinionSections(current => [...current, section]);
  };

  const navigateToPage = (page: AdvisoryPage) => {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${ADVISORY_PAGE_HASH[page]}`);
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateDocumentStatus = (
    type: AdvisoryDocumentType,
    saved: Awaited<ReturnType<typeof uploadAdvisoryDocument>>
  ) => {
    setContext(current => current ? {
      ...current,
      documents: { ...current.documents, [type]: {
        exists: true,
        original_name: saved.original_name,
        updated_at: saved.updated_at,
        name_verification_status: saved.name_verification_status,
        name_matches_member: saved.name_matches_member,
        name_verified_at: saved.name_verified_at
      } }
    } : current);
  };

  const handleIdentityBankRemake = async (file?: File) => {
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) {
      setIdentityBankRemakeStatus({ fileName: file.name, phase: "FAILED", message: "30MB 이하 파일만 선택할 수 있습니다." });
      setNotice("기존 신분증·통장사본 파일은 30MB 이하만 선택할 수 있습니다.");
      return;
    }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      setIdentityBankRemakeStatus({ fileName: file.name, phase: "FAILED", message: "PDF, JPG, PNG 파일만 변환할 수 있습니다." });
      setNotice("기존 신분증·통장사본은 PDF, JPG, PNG 파일만 변환할 수 있습니다.");
      return;
    }
    let documentsWereStored = false;
    try {
      setIsRemakingIdentityBank(true);
      setIdentityBankRemakeStatus({ fileName: file.name, phase: "SELECTED", message: "파일 선택을 확인했습니다. 변환을 준비하고 있습니다." });
      setNotice("기존 파일에서 신분증과 통장 계좌정보 면을 찾아 새 양식으로 변환하는 중입니다...");
      let pages;
      try {
        pages = await createAdvisoryDocumentRemakePages(file);
      } catch {
        throw new CommitteeVoteApiError("PDF_RENDER_FAILED", "PDF_RENDER_FAILED");
      }
      let identityMatch: { page: (typeof pages)[number]; layout: AdvisoryDocumentLayout } | null = null;
      let bankMatch: { page: (typeof pages)[number]; layout: AdvisoryDocumentLayout } | null = null;
      for (const page of pages) {
        const analysisMessage = `기존 파일 ${page.pageNumber}/${pages.length}페이지에서 신분증과 통장 영역을 확인하는 중입니다...`;
        setIdentityBankRemakeStatus({ fileName: file.name, phase: "ANALYZING", message: analysisMessage });
        setNotice(analysisMessage);
        const combinedLayouts = await analyzeAdvisoryIdentityBankLayouts(
          voterToken,
          page.sourceFile.name,
          page.analysisDataUrl
        );
        const identityLayout: AdvisoryDocumentLayout | null = identityMatch ? null : combinedLayouts.identity;
        const bankLayout: AdvisoryDocumentLayout | null = bankMatch ? null : combinedLayouts.bank;
        if (!identityMatch && isUsableAdvisoryDocumentLayout(identityLayout)) identityMatch = { page, layout: identityLayout };
        if (!bankMatch && isUsableAdvisoryDocumentLayout(bankLayout)) bankMatch = { page, layout: bankLayout };
        if (identityMatch && bankMatch) break;
      }
      if (!identityMatch || !bankMatch) {
        throw new CommitteeVoteApiError("DOCUMENT_NOT_DETECTED", "DOCUMENT_NOT_DETECTED");
      }

      setIdentityBankRemakeStatus({ fileName: file.name, phase: "OPTIMIZING", message: "두 문서 영역을 찾았습니다. 표준 크기로 보정하고 있습니다." });
      const [identityFile, bankFile] = await Promise.all([
        normalizeAdvisoryDocument(identityMatch.page.sourceFile, "ID_COPY", identityMatch.layout),
        normalizeAdvisoryDocument(bankMatch.page.sourceFile, "BANK_COPY", bankMatch.layout)
      ]);
      const [identityDataUrl, bankDataUrl] = await Promise.all([
        readFileDataUrl(identityFile),
        readFileDataUrl(bankFile)
      ]);
      setIdentityBankRemakeStatus({ fileName: file.name, phase: "UPLOADING", message: "변환된 신분증과 통장사본을 보안 저장소에 저장하고 있습니다." });
      const [identitySaved, bankSaved] = await Promise.all([
        uploadAdvisoryDocument(voterToken, "ID_COPY", identityFile.name, identityDataUrl),
        uploadAdvisoryDocument(voterToken, "BANK_COPY", bankFile.name, bankDataUrl)
      ]);
      documentsWereStored = true;
      updateDocumentStatus("ID_COPY", identitySaved);
      updateDocumentStatus("BANK_COPY", bankSaved);
      setIdPreviewUrl(identityDataUrl);
      setBankPreviewUrl(bankDataUrl);

      setIdentityBankRemakeStatus({ fileName: file.name, phase: "VERIFYING", message: "파일 저장을 완료했습니다. 추출 정보와 완성 PDF를 갱신하고 있습니다." });
      try {
        await verifyAdvisoryDocumentNames(voterToken, true);
        const refreshed = await getAdvisoryIntakeContext(voterToken);
        setContext(refreshed);
        setResume(current => ({
          ...current,
          resident_number: refreshed.documents.ID_COPY.extracted_resident_number || current.resident_number,
          address: refreshed.documents.ID_COPY.extracted_address || current.address,
          bank_name: refreshed.documents.BANK_COPY.extracted_bank_name || current.bank_name,
          account_number: refreshed.documents.BANK_COPY.extracted_account_number || current.account_number,
          account_holder: refreshed.documents.BANK_COPY.extracted_account_holder || current.account_holder
        }));
        await new Promise(resolve => window.setTimeout(resolve, 150));
        await savePreviewPdf("IDENTITY_BANK_PDF", false);
        const completedMessage = "신분증·통장사본 저장과 A4 PDF 갱신을 완료했습니다.";
        setIdentityBankRemakeStatus({ fileName: file.name, phase: "COMPLETED", message: completedMessage });
        setNotice(`${completedMessage} 추출 정보와 미리보기를 확인해 주세요.`);
      } catch (postProcessError) {
        const refreshed = await getAdvisoryIntakeContext(voterToken).catch(() => null);
        if (refreshed) setContext(refreshed);
        const completedMessage = "신분증·통장사본은 저장되었습니다. AI 정보 확인 또는 완성 PDF 갱신은 다시 실행해 주세요.";
        setIdentityBankRemakeStatus({ fileName: file.name, phase: "COMPLETED", message: completedMessage });
        setNotice(`${completedMessage} ${getCommitteeVoteErrorMessage(postProcessError)}`);
      }
    } catch (error) {
      const refreshed = await getAdvisoryIntakeContext(voterToken).catch(() => null);
      if (refreshed) setContext(refreshed);
      const failureMessage = documentsWereStored
        ? "파일은 저장되었지만 후속 처리 상태를 확인하지 못했습니다."
        : "기존 파일 자동 변환 또는 저장에 실패했습니다.";
      setIdentityBankRemakeStatus({ fileName: file.name, phase: documentsWereStored ? "COMPLETED" : "FAILED", message: failureMessage });
      setNotice(`${failureMessage} ${getCommitteeVoteErrorMessage(error)} 현재 제출현황을 확인한 뒤 다시 시도해 주세요.`);
    } finally {
      setIsRemakingIdentityBank(false);
    }
  };

  const handleDocumentUpload = async (type: AdvisoryDocumentType, file?: File) => {
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) {
      setNotice("원본 파일은 30MB 이하만 선택할 수 있습니다.");
      return;
    }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      setNotice("PDF, JPG, PNG 파일만 제출할 수 있습니다.");
      return;
    }
    try {
      setUploadingType(type);
      setNotice("문서 경계를 확인하고 1MB 이하로 최적화하는 중입니다...");
      let layout: AdvisoryDocumentLayout | null = null;
      if (file.type.startsWith("image/")) {
        try {
          const analysisDataUrl = await createAdvisoryDocumentAnalysisPreview(file);
          layout = await analyzeAdvisoryDocumentLayout(voterToken, type, file.name, analysisDataUrl);
        } catch {
          // AI 경계 판독 실패 시에도 EXIF 방향 정규화와 용량 최적화는 계속한다.
        }
      }
      const optimizedFile = await normalizeAdvisoryDocument(file, type, layout);
      const optimizedDataUrl = await readFileDataUrl(optimizedFile);
      const saved = await uploadAdvisoryDocument(voterToken, type, optimizedFile.name, optimizedDataUrl);
      updateDocumentStatus(type, saved);
      if (type === "ID_COPY") setIdPreviewUrl(optimizedDataUrl);
      else setBankPreviewUrl(optimizedDataUrl);
      setUploadingType("");
      const correctionSummary = layout?.readable && layout.confidence >= .45 ? " 자동 크롭·기울기 보정을 적용했습니다." : "";
      setNotice(`${type === "ID_COPY" ? "신분증" : "통장"} 사본을 ${(optimizedFile.size / 1024 / 1024).toFixed(2)}MB로 저장했습니다.${correctionSummary} AI 정보 확인 중입니다.`);
      try {
        await verifyAdvisoryDocumentNames(voterToken);
        const refreshed = await getAdvisoryIntakeContext(voterToken);
        setContext(refreshed);
        setResume(current => ({
          ...current,
          resident_number: refreshed.documents.ID_COPY.extracted_resident_number || current.resident_number,
          address: refreshed.documents.ID_COPY.extracted_address || current.address,
          bank_name: refreshed.documents.BANK_COPY.extracted_bank_name || current.bank_name,
          account_number: refreshed.documents.BANK_COPY.extracted_account_number || current.account_number,
          account_holder: refreshed.documents.BANK_COPY.extracted_account_holder || current.account_holder
        }));
        const verified = refreshed.documents[type];
        const bankSummary = type === "BANK_COPY" && (verified.extracted_bank_name || verified.extracted_account_number)
          ? ` 은행명 ${verified.extracted_bank_name || "미확인"}, 계좌번호 ${verified.extracted_account_number || "미확인"}을 자동 입력했습니다.`
          : "";
        const identitySummary = type === "ID_COPY" && (verified.extracted_resident_number || verified.extracted_address)
          ? " 주민등록번호와 주소를 자동 입력하고 이력서에 반영했습니다."
          : "";
        setNotice(verified.name_matches_member === false
          ? `성명 불일치: ${type === "ID_COPY" ? "신분증 성명" : "통장 예금주"}가 전문가 성명과 일치하지 않습니다.${identitySummary}${bankSummary}`
          : `${type === "ID_COPY" ? "신분증" : "통장"} 사본 저장과 AI 확인을 완료했습니다.${identitySummary}${bankSummary}`);
        if (refreshed.documents.ID_COPY.exists && refreshed.documents.BANK_COPY.exists) {
          await new Promise(resolve => window.setTimeout(resolve, 150));
          await savePreviewPdf("IDENTITY_BANK_PDF", false);
          setNotice(current => `${current} 완성 PDF도 비공개 저장소에 갱신했습니다.`);
        }
      } catch (error) {
        setNotice(`${type === "ID_COPY" ? "신분증" : "통장"} 사본은 정상 저장했습니다. ${getCommitteeVoteErrorMessage(error)}`);
      }
    } catch (error) {
      setNotice(getCommitteeVoteErrorMessage(error));
    } finally {
      setUploadingType("");
    }
  };

  const handleDocumentInformationExtraction = async () => {
    if (!context || (!context.documents.ID_COPY.exists && !context.documents.BANK_COPY.exists)) return;
    try {
      setIsExtractingDocumentInfo(true);
      setNotice("신분증과 통장사본의 개인정보를 AI로 다시 확인하는 중입니다...");
      await verifyAdvisoryDocumentNames(voterToken, true);
      const refreshed = await getAdvisoryIntakeContext(voterToken);
      setContext(refreshed);
      setResume(current => ({
        ...current,
        resident_number: refreshed.documents.ID_COPY.extracted_resident_number || current.resident_number,
        address: refreshed.documents.ID_COPY.extracted_address || current.address,
        bank_name: refreshed.documents.BANK_COPY.extracted_bank_name || current.bank_name,
        account_number: refreshed.documents.BANK_COPY.extracted_account_number || current.account_number,
        account_holder: refreshed.documents.BANK_COPY.extracted_account_holder || current.account_holder
      }));
      const identity = refreshed.documents.ID_COPY;
      const bank = refreshed.documents.BANK_COPY;
      const missingFields = [
        identity.exists && !identity.extracted_resident_number ? "주민등록번호" : "",
        identity.exists && !identity.extracted_address ? "주소" : "",
        bank.exists && !bank.extracted_bank_name ? "은행명" : "",
        bank.exists && !bank.extracted_account_number ? "계좌번호" : ""
      ].filter(Boolean);
      setNotice(missingFields.length === 0
        ? "신분증·통장사본 정보 추출을 완료하고 이력서에도 반영했습니다."
        : `정보 확인을 마쳤지만 ${missingFields.join("·")}은 판독하지 못했습니다. 선명한 원본으로 다시 제출하거나 이력서에서 직접 입력해 주세요.`);
    } catch (error) {
      setNotice(getCommitteeVoteErrorMessage(error));
    } finally {
      setIsExtractingDocumentInfo(false);
    }
  };

  const handleAttachmentUpload = async (files: FileList | null) => {
    if (!files?.length || !context) return;
    const selectedFiles = Array.from(files);
    if (context.attachments.length + selectedFiles.length > MAX_ADVISORY_ATTACHMENT_FILES) {
      setNotice(`별첨은 회의별 최대 ${MAX_ADVISORY_ATTACHMENT_FILES}개까지 등록할 수 있습니다.`);
      return;
    }
    if (selectedFiles.some(file => file.size > MAX_ADVISORY_ATTACHMENT_BYTES)) {
      setNotice("별첨 파일은 개별 5MB 이하만 등록할 수 있습니다.");
      return;
    }
    try {
      setIsUploadingAttachments(true);
      setNotice("별첨 파일을 비공개 저장소에 업로드하는 중입니다...");
      for (const file of selectedFiles) {
        const dataUrl = await readFileDataUrl(file);
        const saved = await uploadAdvisoryAttachment(voterToken, file.name, dataUrl);
        setContext(current => current ? { ...current, attachments: [...current.attachments, saved.attachment] } : current);
      }
      setNotice(`${selectedFiles.length}개 별첨 파일을 저장했습니다.`);
    } catch (error) {
      setNotice(getCommitteeVoteErrorMessage(error));
    } finally {
      setIsUploadingAttachments(false);
    }
  };

  const handleAttachmentDelete = async (attachmentId: string) => {
    try {
      setDeletingAttachmentId(attachmentId);
      await deleteAdvisoryAttachment(voterToken, attachmentId);
      setContext(current => current ? {
        ...current,
        attachments: current.attachments.filter(attachment => attachment.id !== attachmentId)
      } : current);
      setNotice("별첨 파일을 삭제했습니다.");
    } catch (error) {
      setNotice(getCommitteeVoteErrorMessage(error));
    } finally {
      setDeletingAttachmentId("");
    }
  };

  const handleResumeAiImport = async (file: File) => {
    if (!context) return;
    if (file.size === 0 || file.size > MAX_AI_RESUME_FILE_BYTES) {
      setNotice("AI 분석용 이력서는 6MB 이하 파일만 업로드할 수 있습니다.");
      return;
    }
    try {
      setIsAnalyzingResume(true);
      setNotice("GPT-5.6이 기존 이력서를 분석하고 있습니다. 응답할 수 없으면 Gemini로 자동 전환합니다.");
      const dataUrl = await readFileDataUrl(file);
      const analysis = await analyzeAdvisoryResume(voterToken, file.name, file.type, dataUrl);
      const analysisProvider = analysis.model.startsWith("gemini") ? "Gemini" : "GPT-5.6";
      const analyzedResume = normalizeAdvisoryResume(analysis.resume, context.member.name, 20);
      const warningText = analysis.warnings.length > 0 ? ` 확인 필요: ${analysis.warnings.join(" · ")}` : "";
      if (analyzedResume.careers.length > MAX_CAREER_ROWS) {
        setPendingAiResume(analyzedResume);
        setSelectedAiCareerIndexes(analyzedResume.careers.slice(0, MAX_CAREER_ROWS).map((_, index) => index));
        setNotice(`교육 및 산업체 경력이 ${analyzedResume.careers.length}개 확인되었습니다. 아래에서 최대 ${MAX_CAREER_ROWS}개를 선택해 주세요.${warningText}`);
      } else {
        setPendingAiResume(null);
        setSelectedAiCareerIndexes([]);
        setResume(normalizeAdvisoryResume(analyzedResume, context.member.name));
        setNotice(`${analysisProvider} 분석 결과를 입력했습니다. 내용을 확인한 뒤 이력서 저장을 눌러 주세요.${warningText}`);
      }
    } catch (error) {
      setNotice(getCommitteeVoteErrorMessage(error));
    } finally {
      setIsAnalyzingResume(false);
    }
  };

  const toggleAiCareerSelection = (index: number) => {
    setSelectedAiCareerIndexes(current => {
      if (current.includes(index)) return current.filter(item => item !== index);
      if (current.length >= MAX_CAREER_ROWS) return current;
      return [...current, index].sort((left, right) => left - right);
    });
  };

  const applyAiCareerSelection = () => {
    if (!pendingAiResume || selectedAiCareerIndexes.length === 0) return;
    const selectedCareers = selectedAiCareerIndexes
      .map(index => pendingAiResume.careers[index])
      .filter((row): row is AdvisoryCareerRow => Boolean(row));
    setResume(normalizeAdvisoryResume({ ...pendingAiResume, careers: selectedCareers }, context?.member.name || pendingAiResume.korean_name));
    setPendingAiResume(null);
    setSelectedAiCareerIndexes([]);
    setNotice(`선택한 교육 및 산업체 경력 ${selectedCareers.length}개를 포함해 AI 분석 결과를 입력했습니다. 내용을 확인한 뒤 이력서 저장을 눌러 주세요.`);
  };

  const handleResumeSave = async () => {
    if (pendingAiResume) {
      setNotice("AI가 추출한 교육 및 산업체 경력을 선택해 적용하거나 선택을 취소한 뒤 저장해 주세요.");
      return;
    }
    try {
      setIsSavingResume(true);
      setResumeDraftStatus("saving");
      setNotice("");
      if (resumeDraftTimerRef.current !== null) {
        window.clearTimeout(resumeDraftTimerRef.current);
        resumeDraftTimerRef.current = null;
      }
      await resumeDraftQueueRef.current.catch(() => undefined);
      const formattedResume = normalizeAdvisoryResume(resume, context?.member.name || resume.korean_name);
      const saved = await saveAdvisoryResume(voterToken, formattedResume);
      resumeBaselineRef.current = JSON.stringify(formattedResume);
      resumeLatestSerializedRef.current = resumeBaselineRef.current;
      setResumeDraftStatus("idle");
      setResume(formattedResume);
      setContext(current => current ? {
        ...current,
        resume: formattedResume,
        documents: { ...current.documents, RESUME: { exists: true, updated_at: saved.updated_at } }
      } : current);
      await new Promise(resolve => window.setTimeout(resolve, 100));
      await savePreviewPdf("RESUME_PDF", false);
      setNotice("이력서를 암호화하고 A4 PDF로 저장했습니다. 변경이 있을 때만 다시 제출하세요.");
    } catch (error) {
      setResumeDraftStatus("error");
      setNotice(getCommitteeVoteErrorMessage(error));
    } finally {
      setIsSavingResume(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (!context) return;
    if (!context.documents.ID_COPY.exists) {
      setNotice("신분증 사본을 저장한 뒤 최종 제출해 주세요.");
      navigateToPage("IDENTITY_BANK");
      return;
    }
    if (!context.documents.BANK_COPY.exists) {
      setNotice("통장 사본을 저장한 뒤 최종 제출해 주세요.");
      navigateToPage("IDENTITY_BANK");
      return;
    }
    if (!context.documents.RESUME.exists) {
      setNotice("이력서를 저장한 뒤 최종 제출해 주세요.");
      navigateToPage("RESUME");
      return;
    }
    if (!personalInfoConsent || !uniqueIdConsent) {
      setNotice("개인정보 수집·이용과 고유식별정보 제공에 모두 동의해야 제출할 수 있습니다.");
      navigateToPage("CONSENT");
      return;
    }
    if (!signatureDataUrl && !context.submission?.has_signature) {
      setNotice("개인정보 동의서에 서명하거나 서명 이미지를 업로드해 주세요.");
      navigateToPage("CONSENT");
      return;
    }
    if (selectedOpinionSections.length < 2) {
      setNotice("자문의견 사안은 3개 중 2개 이상 선택해 주세요.");
      navigateToPage("OPINION");
      return;
    }
    const opinionBySection: Record<AdvisoryOpinionSectionKey, string> = {
      operation: operationOpinion,
      bestPractice: bestPracticeOpinion,
      improvement: improvementOpinion
    };
    if (selectedOpinionSections.some(section => opinionBySection[section].trim().length < 10)) {
      setNotice("선택한 자문의견 사안을 각각 10자 이상 작성해 주세요.");
      navigateToPage("OPINION");
      return;
    }
    const opinionMarkdown = composeAdvisoryOpinionMarkdown({ operationOpinion, bestPracticeOpinion, improvementOpinion, selectedSections: selectedOpinionSections, preservedMarkdown });
    try {
      setIsSubmitting(true);
      setNotice("");
      if (submissionDraftTimerRef.current !== null) {
        window.clearTimeout(submissionDraftTimerRef.current);
        submissionDraftTimerRef.current = null;
      }
      await submissionDraftQueueRef.current.catch(() => undefined);
      const submitted = await submitAdvisoryIntake(voterToken, {
        opinion_title: opinionTitle,
        opinion_markdown: opinionMarkdown,
        personal_info_consent: personalInfoConsent,
        unique_id_consent: uniqueIdConsent,
        signature_data_url: signatureDataUrl || undefined,
        signature_file_name: signatureFileName || undefined,
        square_bullet_font_size: squareBulletFontSize,
        triangle_bullet_font_size: triangleBulletFontSize
      });
      setContext(current => current ? {
        ...current,
        submission_draft: null,
        submission: {
          opinion_title: opinionTitle,
          opinion_markdown: opinionMarkdown,
          personal_info_consent: true,
          unique_id_consent: true,
          has_signature: true,
          signature_url: signaturePreviewUrl,
          signature_original_name: signatureFileName || context.submission?.signature_original_name || "signature-pad.png",
          square_bullet_font_size: squareBulletFontSize,
          triangle_bullet_font_size: triangleBulletFontSize,
          revision: submitted.revision,
          submitted_at: submitted.submitted_at
        }
      } : current);
      localStorage.removeItem(advisoryDraftKey(context.meeting.id, context.member.id));
      submissionDraftBaselineRef.current = JSON.stringify({
        opinion_title: opinionTitle,
        opinion_markdown: opinionMarkdown,
        personal_info_consent: true,
        unique_id_consent: true,
        square_bullet_font_size: squareBulletFontSize,
        triangle_bullet_font_size: triangleBulletFontSize
      });
      submissionDraftLatestSerializedRef.current = submissionDraftBaselineRef.current;
      setSubmissionDraftStatus("idle");
      setSignatureDataUrl("");
      setNotice("자문의견서와 개인정보 동의·서명이 최종 제출되었습니다.");
    } catch (error) {
      setNotice(getCommitteeVoteErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <main className="advisory-intake-loading">자문 제출 정보를 불러오는 중입니다...</main>;
  if (!context) return <main className="advisory-intake-loading"><p>{notice || "자문 제출 정보를 불러오지 못했습니다."}</p><button onClick={onLogout}>다시 로그인</button></main>;

  const documentCards: Array<{ type: AdvisoryDocumentType; title: string; description: string }> = [
    { type: "ID_COPY", title: "신분증 사본", description: "주민등록증·운전면허증 등 본인 확인용 사본" },
    { type: "BANK_COPY", title: "통장 사본", description: "전문가수당을 지급받을 본인 명의 계좌 사본" }
  ];
  const isComplete = Boolean(context.submission?.submitted_at);
  const submittedDate = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
  const expertName = context.member.name || "";
  const accountHolderMismatch = Boolean(
    resume.account_holder.trim()
    && normalizedPersonName(resume.account_holder) !== normalizedPersonName(expertName)
  );
  const idNameMismatch = context.documents.ID_COPY.name_matches_member === false;
  const bankNameMismatch = context.documents.BANK_COPY.name_matches_member === false;
  const nameMismatchReasons = [
    idNameMismatch ? "신분증 성명" : "",
    bankNameMismatch ? "통장사본 예금주" : "",
    accountHolderMismatch ? "이력서 예금주" : ""
  ].filter(Boolean);

  return (
    <main className="advisory-intake-page">
      <header className="advisory-intake-header">
        <div>
          <span>울산과학대학교 지역성장인재양성체계(앵커)사업단</span>
          <h1>{documentOnly ? "강사 장기보관 서류 제출" : context.meeting.title}</h1>
          <p>{context.member.name}{documentOnly ? " 강사" : " 위원"} · {[context.member.org, context.member.dept, context.member.rank].filter(Boolean).join(" · ")}</p>
        </div>
        <button type="button" onClick={onLogout}><LogOut size={16} /> 인증 해제</button>
      </header>

      <div className="advisory-intake-security">
        <ShieldCheck size={18} />
        <span>민감서류는 비공개 저장소에 보관되며, 이력서 개인정보는 암호화되어 저장됩니다. 인증 세션은 30분간 유지됩니다.</span>
      </div>

      {notice && <div className="advisory-intake-notice" role="status">{notice}</div>}
      {isComplete && (
        <div className="advisory-intake-complete"><CheckCircle2 size={20} /> 최종 제출 완료 · 수정 후 다시 제출하면 개정본으로 저장됩니다.</div>
      )}

      <nav className={`advisory-document-nav${documentOnly ? " is-document-only" : ""}`} aria-label="제출 문서 선택">
        {([
          ["OPINION", "자문의견서", FileText],
          ["CONSENT", "개인정보동의", ShieldCheck],
          ["IDENTITY_BANK", "신분증∙통장사본", CreditCard],
          ["RESUME", "이력서", Contact]
        ] as Array<[AdvisoryPage, string, React.ComponentType<{ size?: number }>]>)
          .filter(([page]) => !documentOnly || page === "IDENTITY_BANK" || page === "RESUME")
        .map(([page, label, Icon]) => (
          <button type="button" key={page} className={activePage === page ? "is-active" : ""} onClick={() => navigateToPage(page)}>
            <Icon size={18} /><span>{label}</span>
          </button>
        ))}
        {!documentOnly && (
          <button
            type="button"
            className="advisory-final-submit-nav"
            disabled={isSubmitting}
            onClick={() => void handleFinalSubmit()}
          >
            <Send size={18} />
            <span>{isSubmitting ? "제출 중..." : isComplete ? "수정본 다시 제출" : "입력 완료 및 제출"}</span>
            {!isSubmitting && submissionDraftStatus !== "idle" && (
              <small>{submissionDraftStatus === "error" ? "임시저장 실패" : submissionDraftStatus === "saved" ? "임시저장됨" : "임시저장 중"}</small>
            )}
          </button>
        )}
      </nav>

      {!documentOnly && activePage === "OPINION" && <section className="advisory-intake-section">
        <div className="advisory-intake-section-title"><FileText size={22} /><div><span>매 회의 제출</span><h2>전문가 자문 의견서</h2></div></div>
        <div className="advisory-opinion-grid">
          <div className="advisory-opinion-editor">
            <Field label="자문 제목"><input value={opinionTitle} maxLength={200} onChange={event => setOpinionTitle(event.target.value)} /></Field>
            <div className="advisory-font-size-controls" aria-label="자문의견서 글자크기 설정">
              <Field label="네모 불릿 글자크기">
                <select value={squareBulletFontSize} onChange={event => setSquareBulletFontSize(Number(event.target.value) as AdvisoryOpinionFontSize)}>
                  {ADVISORY_FONT_SIZES.map(size => <option key={size} value={size}>{size}pt</option>)}
                </select>
              </Field>
              <Field label="동그라미 불릿 글자크기">
                <select value={triangleBulletFontSize} onChange={event => setTriangleBulletFontSize(Number(event.target.value) as AdvisoryOpinionFontSize)}>
                  {ADVISORY_FONT_SIZES.map(size => <option key={size} value={size}>{size}pt</option>)}
                </select>
              </Field>
            </div>
            <div className={`advisory-opinion-section-editor ${selectedOpinionSections.includes("operation") ? "is-selected" : ""}`}>
              <label className="advisory-opinion-section-toggle"><input type="checkbox" checked={selectedOpinionSections.includes("operation")} onChange={() => toggleOpinionSection("operation")} /><strong>{ADVISORY_OPERATION_HEADING}</strong></label>
              <textarea value={operationOpinion} disabled={!selectedOpinionSections.includes("operation")} maxLength={10000} onChange={event => setOperationOpinion(event.target.value)} rows={9} placeholder="Markdown 문법으로 의견을 입력해 주세요." />
            </div>
            <div className={`advisory-opinion-section-editor ${selectedOpinionSections.includes("bestPractice") ? "is-selected" : ""}`}>
              <label className="advisory-opinion-section-toggle"><input type="checkbox" checked={selectedOpinionSections.includes("bestPractice")} onChange={() => toggleOpinionSection("bestPractice")} /><strong>{ADVISORY_BEST_PRACTICE_HEADING}</strong></label>
              <textarea value={bestPracticeOpinion} disabled={!selectedOpinionSections.includes("bestPractice")} maxLength={10000} onChange={event => setBestPracticeOpinion(event.target.value)} rows={9} placeholder="Markdown 문법으로 우수사례를 입력해 주세요." />
            </div>
            <div className={`advisory-opinion-section-editor ${selectedOpinionSections.includes("improvement") ? "is-selected" : ""}`}>
              <label className="advisory-opinion-section-toggle"><input type="checkbox" checked={selectedOpinionSections.includes("improvement")} onChange={() => toggleOpinionSection("improvement")} /><strong>{ADVISORY_IMPROVEMENT_HEADING}</strong></label>
              <textarea value={improvementOpinion} disabled={!selectedOpinionSections.includes("improvement")} maxLength={10000} onChange={event => setImprovementOpinion(event.target.value)} rows={9} placeholder="Markdown 문법으로 개선 의견을 입력해 주세요." />
            </div>
            <p className="advisory-markdown-help">3개 사안 중 2개 이상을 선택해 주세요. <code>- 내용</code>은 ○ 불릿, <code>-- 내용</code>은 하위 - 불릿으로 출력되며 표는 <code>| 항목 | 내용 |</code> 형식으로 입력할 수 있습니다.</p>
            <div className="advisory-attachment-panel">
              <div className="advisory-attachment-heading"><div><Paperclip size={18} /><strong>별첨</strong></div><span>이미지·PDF·HWP/HWPX·XLS/XLSX·DOC/DOCX·PPT/PPTX·TXT/CSV/ZIP · 개별 5MB 이하 · 최대 5개</span></div>
              <label className="advisory-upload-button"><Upload size={15} /> {isUploadingAttachments ? "업로드 중..." : "별첨 파일 선택"}
                <input type="file" multiple disabled={isUploadingAttachments} accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.hwp,.hwpx,.xls,.xlsx,.doc,.docx,.ppt,.pptx,.txt,.csv,.zip" onChange={event => { void handleAttachmentUpload(event.target.files); event.currentTarget.value = ""; }} />
              </label>
              {context.attachments.length > 0 ? <ul className="advisory-attachment-list">{context.attachments.map(attachment => <li key={attachment.id}>
                <a href={attachment.signed_url} target="_blank" rel="noreferrer"><Paperclip size={14} /><span>{attachment.original_name}</span><small>{(attachment.size_bytes / 1024 / 1024).toFixed(2)}MB</small></a>
                <button type="button" aria-label={`${attachment.original_name} 삭제`} disabled={deletingAttachmentId === attachment.id} onClick={() => void handleAttachmentDelete(attachment.id)}><Trash2 size={14} /></button>
              </li>)}</ul> : <p className="advisory-attachment-empty">등록된 별첨이 없습니다.</p>}
            </div>
            <AdvisorySignaturePad signatureUrl={signaturePreviewUrl} onChange={(dataUrl, fileName) => { setSignatureDataUrl(dataUrl); setSignatureFileName(fileName); setSignaturePreviewUrl(dataUrl || context.submission?.signature_url || ""); }} />
          </div>
          <div className="advisory-opinion-preview-shell">
            <AdvisoryOpinionPreview member={context.member} meeting={context.meeting} opinionTitle={opinionTitle} operationOpinion={operationOpinion} bestPracticeOpinion={bestPracticeOpinion} improvementOpinion={improvementOpinion} selectedSections={selectedOpinionSections} squareBulletFontSize={squareBulletFontSize} triangleBulletFontSize={triangleBulletFontSize} signatureUrl={signaturePreviewUrl} />
          </div>
        </div>
      </section>}

      {!documentOnly && activePage === "CONSENT" && <section className="advisory-intake-section">
        <div className="advisory-intake-section-title"><ShieldCheck size={22} /><div><span>매 회의 제출</span><h2>개인정보 수집 및 이용 동의</h2></div></div>
        <div className="advisory-split-document-grid">
          <div className="advisory-document-editor advisory-consent-editor">
            <div className="advisory-consent-copy">
              <p>울산과학대학교에서는 강연(자문)료 지급을 위하여 개인정보를 수집합니다. 개인정보보호법 제15조 내지 제22조에 따라 아래 내용을 읽고 동의 여부를 결정해 주세요.</p>
              <h3>1. 수집하는 개인정보의 항목</h3><p>이름·연락처·근무처·직위, 주소·주민등록번호, 계좌번호, 전공분야·학력·학위·경력사항을 수집합니다.</p>
              <h3>2. 개인정보의 수집 및 이용목적</h3><p>본인 식별, 원천징수 영수증 발송, 전문가수당 지급, 교육 참여자 대상 전문가 이력 소개에 사용합니다. 제3자에게 제공하지 않습니다.</p>
              <h3>3. 개인정보 보유 및 이용기간</h3><p>세무 신고 및 과세 자료는 5년, 전문가 이력 증빙자료는 3년 보관하며 목적 달성 후 파기합니다.</p>
              <h3>4. 개인정보의 파기절차 및 방법</h3><p>전자파일은 복구할 수 없는 방법으로 삭제하고, 서면자료는 파쇄합니다.</p>
              <h3>5. 개인정보 처리 위탁에 관한 안내</h3><p>이용자의 동의 없이 개인정보 처리를 타인에게 위탁하지 않습니다.</p>
              <small>동의서 버전: {CONSENT_VERSION} · 개인정보보호법 제15조·제22조, 국세기본법 제85조의3</small>
            </div>
            <label className="advisory-consent-check is-important"><input type="checkbox" checked={personalInfoConsent} onChange={event => setPersonalInfoConsent(event.target.checked)} /><span><strong>필수 확인</strong> 상기 내용을 숙지하였으며 개인정보 수집 및 이용에 동의합니다.</span></label>
            <label className="advisory-consent-check is-important"><input type="checkbox" checked={uniqueIdConsent} onChange={event => setUniqueIdConsent(event.target.checked)} /><span><strong>필수 확인</strong> 주민등록번호 등 고유식별정보 제공에 동의합니다.</span></label>
            <p className="advisory-markdown-help">체크 상태는 이 브라우저에 임시 저장되며, 서명 후 아래의 입력 완료 및 제출을 눌러야 최종 동의로 기록됩니다.</p>
            <div className="advisory-auto-fields"><span>제출일 <strong>{submittedDate}</strong></span><span>성명 <strong>{context.member.name}</strong> (서명)</span></div>
            <AdvisorySignaturePad signatureUrl={signaturePreviewUrl} onChange={(dataUrl, fileName) => { setSignatureDataUrl(dataUrl); setSignatureFileName(fileName); setSignaturePreviewUrl(dataUrl || context.submission?.signature_url || ""); }} />
          </div>
          <div className="advisory-opinion-preview-shell"><AdvisoryConsentPreview memberName={context.member.name} submittedDate={submittedDate} personalInfoConsent={personalInfoConsent} uniqueIdConsent={uniqueIdConsent} signatureUrl={signaturePreviewUrl} /></div>
        </div>
      </section>}

      {activePage === "IDENTITY_BANK" && <section className="advisory-intake-section">
        <div className="advisory-intake-section-title"><CreditCard size={22} /><div><span>최초 1회 또는 변경 시</span><h2>신분증∙통장사본</h2></div></div>
        {nameMismatchReasons.length > 0 && <div className="advisory-name-mismatch-alert" role="alert">
          <strong>⚠ 성명 불일치 경고</strong>
          <span>전문가 성명 ‘{expertName}’과 {nameMismatchReasons.join("·")}가 일치하지 않습니다. 올바른 본인 자료인지 반드시 확인해 주세요.</span>
        </div>}
        <div className="advisory-split-document-grid">
          <div className="advisory-document-editor"><div className="advisory-resume-ai-import">
            <div><Sparkles size={20} /><span><strong>기존 신분증·통장사본 자동 변환</strong><small>PDF 앞쪽 최대 5페이지·JPG·PNG, 최대 30MB · AI 문서영역 분리 · 원본 미보관</small></span></div>
            <label className="advisory-upload-button"><Upload size={15} /> {isRemakingIdentityBank ? "새 양식 변환 중..." : "기존 파일 선택"}
              <input type="file" accept="application/pdf,image/jpeg,image/png" disabled={isRemakingIdentityBank || Boolean(uploadingType)} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void handleIdentityBankRemake(file); }} />
            </label>
            {identityBankRemakeStatus && <div className={`advisory-remake-status is-${identityBankRemakeStatus.phase.toLowerCase()}`} role="status" aria-live="polite">
              {identityBankRemakeStatus.phase === "COMPLETED" ? <CheckCircle2 size={17} /> : <Sparkles size={17} />}
              <span><strong>{identityBankRemakeStatus.fileName}</strong><small>{identityBankRemakeStatus.message}</small></span>
            </div>}
            <p>신분증과 통장사본이 함께 배치된 기존 파일에서 두 문서 영역을 각각 찾아 현재 표준 A4 양식으로 다시 만듭니다. 두 영역이 모두 확인된 경우에만 저장 자료를 교체합니다.</p>
          </div><div className="advisory-image-guidance"><strong>신분증·통장사본은 최초 1회 저장 후 변경이 있을 때만 다시 제출하면 됩니다.</strong><br />회의별 개인정보 동의 여부와 관계없이 저장할 수 있으며 강사 서류함에서 재활용됩니다. 신분증은 카드 외곽, 통장은 계좌정보가 있는 한 면만 자동 크롭·기울기 보정합니다. 각 파일은 1MB 이하로 최적화되어 선택 즉시 DB에 저장됩니다.<br /><button type="button" className="advisory-document-extract-button" disabled={isRemakingIdentityBank || isExtractingDocumentInfo || Boolean(uploadingType) || (!context.documents.ID_COPY.exists && !context.documents.BANK_COPY.exists)} onClick={() => void handleDocumentInformationExtraction()}><Sparkles size={15} />{isExtractingDocumentInfo ? "정보 추출 중..." : "첨부 그림에서 정보 다시 추출"}</button></div><div className="advisory-document-grid">
          {documentCards.map(card => {
            const status = context.documents[card.type];
            return <article key={card.type} className={status.exists ? "is-stored" : ""}>
              <div><strong>{card.title}</strong><p>{card.description}</p></div>
              <span>{status.exists ? `저장됨 · ${status.original_name || "보안 문서"}` : "미제출"}</span>
              <label className="advisory-upload-button"><Upload size={15} />{uploadingType === card.type ? "업로드 중..." : status.exists ? "변경 파일 제출" : "파일 선택"}
                <input type="file" accept="application/pdf,image/jpeg,image/png" disabled={isRemakingIdentityBank || Boolean(uploadingType)} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void handleDocumentUpload(card.type, file); }} />
              </label>
            </article>;
          })}
          </div><button type="button" className="advisory-save-resume" disabled={isRemakingIdentityBank || savingGeneratedPdf === "IDENTITY_BANK_PDF" || !context.documents.ID_COPY.exists || !context.documents.BANK_COPY.exists} onClick={() => void savePreviewPdf("IDENTITY_BANK_PDF").catch(error => setNotice(getCommitteeVoteErrorMessage(error)))}><Save size={16} /> {savingGeneratedPdf === "IDENTITY_BANK_PDF" ? "PDF 저장 중..." : "신분증·통장사본 PDF 저장"}</button></div>
          <div ref={identityPreviewRef} className="advisory-opinion-preview-shell"><AdvisoryIdentityBankPreview memberName={resume.korean_name || context.member.name} residentNumber={resume.resident_number} address={resume.address} bankName={resume.bank_name} accountNumber={resume.account_number} accountHolder={resume.account_holder} idVerification={context.documents.ID_COPY} bankVerification={context.documents.BANK_COPY} idImage={idPreviewUrl} bankImage={bankPreviewUrl} /></div>
        </div>
      </section>}

      {activePage === "RESUME" && <section className="advisory-intake-section">
        <div className="advisory-intake-section-title"><FileText size={22} /><div><span>최초 1회 또는 변경 시</span><h2>이력서</h2></div></div>
        <div className="advisory-split-document-grid"><div className="advisory-document-editor">
        {context.documents.RESUME.exists && <div className="advisory-stored-banner"><CheckCircle2 size={17} /> 저장된 이력서가 있습니다. 변경사항이 있을 때만 수정·저장하세요.</div>}
        <p className="advisory-markdown-help" role="status" aria-live="polite">{
          resumeDraftStatus === "pending" ? "변경사항을 잠시 후 암호화 임시저장합니다..."
            : resumeDraftStatus === "saving" ? "이력서 입력 내용을 암호화 임시저장하는 중입니다..."
              : resumeDraftStatus === "saved" ? "이력서 입력 내용이 암호화 임시저장되었습니다. 정식 저장 전에도 다시 불러올 수 있습니다."
                : resumeDraftStatus === "error" ? "자동 임시저장에 실패했습니다. 잠시 후 내용을 수정하거나 이력서 저장을 눌러 다시 시도해 주세요."
                  : "이력서 입력과 AI 적용 결과는 변경 후 자동으로 암호화 임시저장됩니다."
        }</p>
        <div className="advisory-resume-ai-import">
          <div><Sparkles size={20} /><span><strong>기존 이력서 AI 자동입력</strong><small>PDF·DOCX·TXT·JPG·PNG, 최대 6MB · GPT-5.6 우선 / Gemini 자동 대체 · 원본 미보관</small></span></div>
          <label className="advisory-upload-button"><Upload size={15} /> {isAnalyzingResume ? "AI 분석 중..." : "기존 이력서 선택"}
            <input type="file" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/jpeg,image/png" disabled={isAnalyzingResume} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void handleResumeAiImport(file); }} />
          </label>
          <p>파일의 개인정보가 OpenAI 또는 Gemini API에서 일시 처리됩니다. 분석 결과는 자동 저장되지 않으므로 반드시 확인 후 저장하세요.</p>
        </div>
        {pendingAiResume && <section className="advisory-ai-career-selector" aria-labelledby="advisory-ai-career-heading">
          <div className="advisory-ai-career-selector__header">
            <div><strong id="advisory-ai-career-heading">교육 및 산업체 경력 선택</strong><span>AI가 {pendingAiResume.careers.length}개를 찾았습니다. 이력서에 반영할 경력을 최대 {MAX_CAREER_ROWS}개 선택해 주세요.</span></div>
            <b>{selectedAiCareerIndexes.length}/{MAX_CAREER_ROWS} 선택</b>
          </div>
          <div className="advisory-ai-career-candidates">
            {pendingAiResume.careers.map((career, index) => {
              const isSelected = selectedAiCareerIndexes.includes(index);
              const isDisabled = !isSelected && selectedAiCareerIndexes.length >= MAX_CAREER_ROWS;
              return <label key={`${career.employment_period}-${career.organization}-${index}`} className={isSelected ? "is-selected" : ""}>
                <input type="checkbox" checked={isSelected} disabled={isDisabled} onChange={() => toggleAiCareerSelection(index)} />
                <span><strong>{career.organization || "근무기관 미확인"}</strong><small>{[career.employment_period, career.position].filter(Boolean).join(" · ") || "기간·직위 미확인"}</small>{career.duties && <em>{career.duties}</em>}</span>
              </label>;
            })}
          </div>
          <div className="advisory-ai-career-actions">
            <button type="button" onClick={() => { setPendingAiResume(null); setSelectedAiCareerIndexes([]); setNotice("AI 경력 선택을 취소했습니다. 기존 이력서 입력 내용은 유지됩니다."); }}>취소</button>
            <button type="button" className="primary" disabled={selectedAiCareerIndexes.length === 0} onClick={applyAiCareerSelection}>선택한 경력 적용</button>
          </div>
        </section>}
        <div className="advisory-resume-grid">
          <Field label="성명(한글)"><input value={resume.korean_name} onChange={event => setResume({ ...resume, korean_name: event.target.value })} /></Field>
          <Field label="성명(한자)"><input value={resume.hanja_name} onChange={event => setResume({ ...resume, hanja_name: event.target.value })} /></Field>
          <Field label="성명(영문)"><input value={resume.english_name} onChange={event => setResume({ ...resume, english_name: event.target.value })} /></Field>
          <Field label="E-Mail"><input type="email" value={resume.email} onChange={event => setResume({ ...resume, email: event.target.value })} /></Field>
          <Field label="주민등록번호"><input value={resume.resident_number} autoComplete="off" placeholder="000000-0000000" onChange={event => setResume({ ...resume, resident_number: event.target.value })} /></Field>
          <Field label="주소"><input value={resume.address} onChange={event => setResume({ ...resume, address: event.target.value })} /></Field>
          <Field label="은행"><input value={resume.bank_name} placeholder="OO은행" onChange={event => setResume({
            ...resume,
            bank_name: event.target.value,
            account_number: formatBankAccountNumber(event.target.value, resume.account_number)
          })} /></Field>
          <Field label="계좌번호"><input className="advisory-account-number-input" value={resume.account_number} placeholder="숫자만 입력 (은행별 자동 서식)" onChange={event => setResume({
            ...resume,
            account_number: formatBankAccountNumber(resume.bank_name, event.target.value)
          })} /></Field>
          <Field label="예금주"><input value={resume.account_holder} placeholder="성명" onChange={event => setResume({ ...resume, account_holder: event.target.value })} /></Field>
          <Field label="전화(직장)"><input value={resume.phones.work} onChange={event => setResume({ ...resume, phones: { ...resume.phones, work: event.target.value } })} /></Field>
          <Field label="휴대전화"><input value={resume.phones.mobile} onChange={event => setResume({ ...resume, phones: { ...resume.phones, mobile: event.target.value } })} /></Field>
        </div>

        <div className="advisory-repeat-section"><div className="advisory-repeat-heading"><h3>학력 사항 <small>{resume.education.length}/{MAX_EDUCATION_ROWS}</small></h3><button type="button" disabled={resume.education.length >= MAX_EDUCATION_ROWS} onClick={() => setResume({ ...resume, education: [...resume.education, { period: "", school: "", department_major: "", degree_type: "" }] })}><Plus size={14} /> 추가</button></div>
          {resume.education.map((row, index) => <div className="advisory-repeat-row four" key={index}>
            <input placeholder="기간" value={row.period} onChange={event => { const rows = [...resume.education]; rows[index] = { ...row, period: event.target.value }; setResume({ ...resume, education: rows }); }} />
            <input placeholder="학교명" value={row.school} onChange={event => { const rows = [...resume.education]; rows[index] = { ...row, school: event.target.value }; setResume({ ...resume, education: rows }); }} />
            <input placeholder="학과명" value={row.department_major} onChange={event => { const rows = [...resume.education]; rows[index] = { ...row, department_major: event.target.value }; setResume({ ...resume, education: rows }); }} />
            <input placeholder="학위구분" value={row.degree_type} onChange={event => { const rows = [...resume.education]; rows[index] = { ...row, degree_type: event.target.value }; setResume({ ...resume, education: rows }); }} />
            <button type="button" aria-label="학력 행 삭제" onClick={() => setResume({ ...resume, education: resume.education.filter((_, rowIndex) => rowIndex !== index) })}><Trash2 size={15} /></button>
          </div>)}
        </div>

        <div className="advisory-repeat-section"><div className="advisory-repeat-heading"><h3>교육 및 산업체 경력 <small>{resume.careers.length}/{MAX_CAREER_ROWS}</small></h3><button type="button" disabled={resume.careers.length >= MAX_CAREER_ROWS} onClick={() => setResume({ ...resume, careers: [...resume.careers, { employment_period: "", organization: "", position: "", duties: "" }] })}><Plus size={14} /> 추가</button></div>
          {resume.careers.map((row, index) => <div className="advisory-repeat-row career" key={index}>
            <input placeholder="재직기간" value={row.employment_period} onChange={event => { const rows = [...resume.careers]; rows[index] = { ...row, employment_period: event.target.value }; setResume({ ...resume, careers: rows }); }} />
            <input placeholder="근무기관명" value={row.organization} onChange={event => { const rows = [...resume.careers]; rows[index] = { ...row, organization: event.target.value }; setResume({ ...resume, careers: rows }); }} />
            <input placeholder="직위" value={row.position} onChange={event => { const rows = [...resume.careers]; rows[index] = { ...row, position: event.target.value }; setResume({ ...resume, careers: rows }); }} />
            <input placeholder="담당직무" value={row.duties} onChange={event => { const rows = [...resume.careers]; rows[index] = { ...row, duties: event.target.value }; setResume({ ...resume, careers: rows }); }} />
            <div className="advisory-repeat-row-actions">
              <button type="button" aria-label={`${index + 1}번째 경력을 위로 이동`} title="위로 이동" disabled={index === 0} onClick={() => setResume({ ...resume, careers: moveAdvisoryCareerRow(resume.careers, index, index - 1) })}><ArrowUp size={15} /></button>
              <button type="button" aria-label={`${index + 1}번째 경력을 아래로 이동`} title="아래로 이동" disabled={index === resume.careers.length - 1} onClick={() => setResume({ ...resume, careers: moveAdvisoryCareerRow(resume.careers, index, index + 1) })}><ArrowDown size={15} /></button>
              <button type="button" aria-label="경력 행 삭제" title="삭제" onClick={() => setResume({ ...resume, careers: resume.careers.filter((_, rowIndex) => rowIndex !== index) })}><Trash2 size={15} /></button>
            </div>
          </div>)}
        </div>

        <div className="advisory-repeat-section advisory-optional-resume-section"><label><input type="checkbox" checked={resume.include_policy_research} onChange={event => setResume({ ...resume, include_policy_research: event.target.checked, policy_research: event.target.checked && resume.policy_research.length === 0 ? [{ year: "", title: "", role: "", client: "", notes: "" }] : resume.policy_research })} /><strong>(정책)연구경력 포함</strong></label>
          {resume.include_policy_research && <><div className="advisory-repeat-heading"><h3>(정책)연구경력 <small>{resume.policy_research.length}/{MAX_POLICY_RESEARCH_ROWS}</small></h3><button type="button" disabled={resume.policy_research.length >= MAX_POLICY_RESEARCH_ROWS} onClick={() => setResume({ ...resume, policy_research: [...resume.policy_research, { year: "", title: "", role: "", client: "", notes: "" }] })}><Plus size={14} /> 추가</button></div>
          {resume.policy_research.map((row, index) => <div className="advisory-repeat-row policy" key={index}>
            <input placeholder="연도" value={row.year} onChange={event => { const rows = [...resume.policy_research]; rows[index] = { ...row, year: event.target.value }; setResume({ ...resume, policy_research: rows }); }} />
            <textarea rows={2} placeholder="연구명(최대 2줄)" value={row.title} onChange={event => { const rows = [...resume.policy_research]; rows[index] = { ...row, title: event.target.value }; setResume({ ...resume, policy_research: rows }); }} />
            <select value={row.role} onChange={event => { const rows = [...resume.policy_research]; rows[index] = { ...row, role: event.target.value }; setResume({ ...resume, policy_research: rows }); }}><option value="">역할 선택</option><option value="연구책임">연구책임</option><option value="공동연구원">공동연구원</option></select>
            <input placeholder="발주처" value={row.client} onChange={event => { const rows = [...resume.policy_research]; rows[index] = { ...row, client: event.target.value }; setResume({ ...resume, policy_research: rows }); }} />
            <input placeholder="비고" value={row.notes} onChange={event => { const rows = [...resume.policy_research]; rows[index] = { ...row, notes: event.target.value }; setResume({ ...resume, policy_research: rows }); }} />
            <button type="button" aria-label="정책 연구경력 행 삭제" onClick={() => setResume({ ...resume, policy_research: resume.policy_research.filter((_, rowIndex) => rowIndex !== index) })}><Trash2 size={15} /></button>
          </div>)}</>}
        </div>

        <div className="advisory-repeat-section advisory-optional-resume-section"><label><input type="checkbox" checked={resume.include_licenses} onChange={event => setResume({ ...resume, include_licenses: event.target.checked, licenses: event.target.checked && resume.licenses.length === 0 ? [{ acquired_date: "", type: "", issuer: "" }] : resume.licenses })} /><strong>자격증·면허증 포함</strong></label>
          {resume.include_licenses && <><div className="advisory-repeat-heading"><h3>자격증·면허증 <small>{resume.licenses.length}/{MAX_LICENSE_ROWS}</small></h3><button type="button" disabled={resume.licenses.length >= MAX_LICENSE_ROWS} onClick={() => setResume({ ...resume, licenses: [...resume.licenses, { acquired_date: "", type: "", issuer: "" }] })}><Plus size={14} /> 추가</button></div>
          {resume.licenses.map((row, index) => <div className="advisory-repeat-row three" key={index}>
            <input placeholder="취득 연월일" value={row.acquired_date} onChange={event => { const rows = [...resume.licenses]; rows[index] = { ...row, acquired_date: event.target.value }; setResume({ ...resume, licenses: rows }); }} />
            <input placeholder="종류" value={row.type} onChange={event => { const rows = [...resume.licenses]; rows[index] = { ...row, type: event.target.value }; setResume({ ...resume, licenses: rows }); }} />
            <input placeholder="시행기관" value={row.issuer} onChange={event => { const rows = [...resume.licenses]; rows[index] = { ...row, issuer: event.target.value }; setResume({ ...resume, licenses: rows }); }} />
            <button type="button" aria-label="자격 행 삭제" onClick={() => setResume({ ...resume, licenses: resume.licenses.filter((_, rowIndex) => rowIndex !== index) })}><Trash2 size={15} /></button>
          </div>)}</>}
        </div>
        <button type="button" className="advisory-save-resume" disabled={isSavingResume || Boolean(pendingAiResume) || savingGeneratedPdf === "RESUME_PDF"} onClick={() => void handleResumeSave()}><Save size={16} /> {isSavingResume || savingGeneratedPdf === "RESUME_PDF" ? "암호화·PDF 저장 중..." : pendingAiResume ? "경력 선택 후 저장" : "이력서 저장"}</button>
        </div><AdvisoryA4PreviewShell hostRef={resumePreviewRef}><AdvisoryResumePreview resume={resume} /></AdvisoryA4PreviewShell></div>
      </section>}

      {!documentOnly && <section className="advisory-final-submit">
        <div><strong>최종 제출 전 확인</strong><span>자문의견서·동의서는 이번 회의 제출분으로, 나머지 자료는 위원별 보관자료로 기록됩니다.</span></div>
        <button type="button" disabled={isSubmitting} onClick={() => void handleFinalSubmit()}><Send size={18} /> {isSubmitting ? "제출 중..." : isComplete ? "수정본 다시 제출" : "입력 완료 및 제출"}</button>
      </section>}
    </main>
  );
}
