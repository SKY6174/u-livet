// Adapted from uc-anchor expert intake; only instructor-document actions are exposed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";



const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const ADVISORY_PII_KEY = Deno.env.get("ADVISORY_PII_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_DOCUMENT_MODEL = "gemini-3.1-pro-preview";
const ALLOWED_ORIGINS = (Deno.env.get("INSTRUCTOR_DOCUMENT_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);





const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

type ErrorCode =
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

class VoteFunctionError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  constructor(code: ErrorCode, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.length === 0
    ? origin
    : (ALLOWED_ORIGINS.includes(origin) ? origin : "");
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

function respond(request: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
  });
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string | Uint8Array): Promise<string> {
  const input = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", input)));
}





function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function canonicalPersonName(value: unknown): string {
  return String(value ?? "").trim().split(/[\s(]/, 1)[0];
}

function normalizedPersonName(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function mapDatabaseError(error: { message?: string } | null): VoteFunctionError {
  const message = error?.message ?? "SERVER_ERROR";
  if (message.includes("TARGET_REQUIRED") || message.includes("TARGET_MEETING_MISMATCH") || message.includes("TARGET_NOT_ALLOWED")) {
    return new VoteFunctionError("INCOMPLETE_AGENDAS", "INCOMPLETE_AGENDAS", 400);
  }
  const codes: ErrorCode[] = [
    "INVALID_CREDENTIALS", "LOCKED", "MEETING_CLOSED", "INCOMPLETE_AGENDAS", "SCORE_OUT_OF_RANGE", "CONFLICT", "FORBIDDEN"
  ];
  const code = codes.find(candidate => message.includes(candidate)) ?? "SERVER_ERROR";
  const status = code === "FORBIDDEN" ? 403 : code === "LOCKED" ? 429 : code === "SERVER_ERROR" ? 500 : 400;
  return new VoteFunctionError(code, code, status);
}

function mapStorageError(error: { message?: string; statusCode?: string | number } | null): VoteFunctionError {
  const message = (error?.message ?? "").toLowerCase();
  const statusCode = String(error?.statusCode ?? "");

  if (message.includes("bucket") && (message.includes("not found") || statusCode === "404")) {
    return new VoteFunctionError("STORAGE_NOT_CONFIGURED", "STORAGE_NOT_CONFIGURED", 503);
  }
  if (
    statusCode === "413"
    || message.includes("maximum allowed size")
    || message.includes("payload too large")
    || message.includes("entity too large")
  ) {
    return new VoteFunctionError("DOCUMENT_TOO_LARGE", "DOCUMENT_TOO_LARGE", 413);
  }
  if (message.includes("mime type") || message.includes("invalid mime")) {
    return new VoteFunctionError("INVALID_DOCUMENT", "INVALID_DOCUMENT", 400);
  }
  return new VoteFunctionError("STORAGE_UPLOAD_FAILED", "STORAGE_UPLOAD_FAILED", 503);
}



function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.slice(index, index + 8192));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

let advisoryEncryptionKey: Promise<CryptoKey> | null = null;

function getAdvisoryEncryptionKey(): Promise<CryptoKey> {
  if (!advisoryEncryptionKey) {
    advisoryEncryptionKey = importAdvisoryEncryptionKey().catch(error => { advisoryEncryptionKey = null; throw error; });
  }
  return advisoryEncryptionKey;
}

async function importAdvisoryEncryptionKey(): Promise<CryptoKey> {
  let keyBytes: Uint8Array<ArrayBuffer>;
  try {
    keyBytes = base64ToBytes(ADVISORY_PII_KEY);
  } catch {
    throw new VoteFunctionError("SERVER_ERROR", "ADVISORY_PII_KEY_INVALID", 500);
  }
  if (keyBytes.length !== 32) {
    throw new VoteFunctionError("SERVER_ERROR", "ADVISORY_PII_KEY_INVALID", 500);
  }
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptAdvisoryResume(value: unknown): Promise<{ ciphertext: string; iv: string }> {
  const key = await getAdvisoryEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return { ciphertext: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv) };
}

async function decryptAdvisoryResume(ciphertext: string, iv: string): Promise<unknown> {
  const key = await getAdvisoryEncryptionKey();
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(iv) },
      key,
      base64ToBytes(ciphertext)
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch {
    throw new VoteFunctionError("SERVER_ERROR", "ADVISORY_PROFILE_DECRYPT_FAILED", 500);
  }
}

function cleanText(value: unknown, maxLength: number, required = false): string {
  const text = String(value ?? "").trim();
  if ((required && !text) || text.length > maxLength) {
    throw new VoteFunctionError("CONFLICT", "INVALID_ADVISORY_PROFILE");
  }
  return text;
}

function cleanResumeRows(
  value: unknown,
  fields: Array<[string, number]>,
  maxRows = 20
): Array<Record<string, string>> {
  if (!Array.isArray(value) || value.length > maxRows) {
    throw new VoteFunctionError("CONFLICT", "INVALID_ADVISORY_PROFILE");
  }
  return value.map(row => {
    if (!row || typeof row !== "object") {
      throw new VoteFunctionError("CONFLICT", "INVALID_ADVISORY_PROFILE");
    }
    return Object.fromEntries(fields.map(([field, maxLength]) => [
      field,
      cleanText((row as Record<string, unknown>)[field], maxLength)
    ]));
  }).filter(row => Object.values(row).some(Boolean));
}

function validateAdvisoryResume(rawValue: unknown, requireCore = true, maxCareerRows = 5): Record<string, unknown> {
  const raw = rawValue && typeof rawValue === "object"
    ? rawValue as Record<string, unknown>
    : {};
  const phones = raw.phones && typeof raw.phones === "object"
    ? raw.phones as Record<string, unknown>
    : {};
  return {
    korean_name: cleanText(raw.korean_name, 100, requireCore),
    hanja_name: cleanText(raw.hanja_name, 100),
    english_name: cleanText(raw.english_name, 150),
    email: cleanText(raw.email, 254, requireCore),
    resident_number: cleanText(raw.resident_number, 20, requireCore),
    address: cleanText(raw.address, 300, requireCore),
    bank_name: cleanText(raw.bank_name, 100),
    account_number: cleanText(raw.account_number, 100),
    account_holder: cleanText(raw.account_holder, 100),
    phones: {
      home: cleanText(phones.home, 30),
      work: cleanText(phones.work, 30),
      mobile: cleanText(phones.mobile, 30, requireCore)
    },
    education: cleanResumeRows(raw.education, [
      ["period", 100], ["school", 200], ["department_major", 200], ["degree_type", 100]
    ], 3),
    careers: cleanResumeRows(raw.careers, [
      ["employment_period", 100], ["organization", 200], ["position", 100],
      ["duties", 300]
    ], maxCareerRows),
    include_policy_research: raw.include_policy_research === true,
    policy_research: cleanResumeRows(raw.policy_research ?? [], [
      ["year", 20], ["title", 500], ["role", 100], ["client", 200], ["notes", 200]
    ], 3),
    include_licenses: raw.include_licenses === true,
    licenses: cleanResumeRows(raw.licenses, [
      ["acquired_date", 50], ["type", 150], ["issuer", 200]
    ], 6)
  };
}

const ADVISORY_RESUME_AI_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png"
};

function decodeAdvisoryResumeAiFile(fileName: string, contentType: string, dataUrl: string) {
  const safeName = fileName.trim().replace(/[\\/]/g, "_").slice(0, 160);
  const extension = safeName.split(".").pop()?.toLowerCase() ?? "";
  const expectedType = ADVISORY_RESUME_AI_MIME_BY_EXTENSION[extension];
  if (!safeName || !expectedType || ![expectedType, "", "application/octet-stream"].includes(contentType)) {
    throw new VoteFunctionError("INVALID_DOCUMENT", "INVALID_RESUME_AI_DOCUMENT");
  }
  const match = /^data:([^;,]*);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match || ![expectedType, "", "application/octet-stream"].includes(match[1])) {
    throw new VoteFunctionError("INVALID_DOCUMENT", "INVALID_RESUME_AI_DOCUMENT");
  }
  const bytes = base64ToBytes(match[2]);
  if (bytes.length === 0 || bytes.length > 6 * 1024 * 1024) {
    throw new VoteFunctionError("DOCUMENT_TOO_LARGE", "DOCUMENT_TOO_LARGE", 413);
  }
  const startsWith = (signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  const valid = extension === "pdf"
    ? new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-"
    : extension === "docx"
      ? startsWith([0x50, 0x4b])
      : extension === "txt"
        ? !bytes.slice(0, 4096).includes(0)
        : ["jpg", "jpeg"].includes(extension)
          ? startsWith([0xff, 0xd8, 0xff])
          : startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!valid) throw new VoteFunctionError("INVALID_DOCUMENT", "INVALID_RESUME_AI_DOCUMENT");
  return { safeName, contentType: expectedType, dataUrl: `data:${expectedType};base64,${match[2]}` };
}

const ADVISORY_RESUME_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["resume", "warnings"],
  properties: {
    resume: {
      type: "object",
      additionalProperties: false,
      required: [
        "korean_name", "hanja_name", "english_name", "email", "resident_number", "address",
        "bank_name", "account_number", "account_holder", "phones", "education", "careers",
        "include_policy_research", "policy_research", "include_licenses", "licenses"
      ],
      properties: {
        korean_name: { type: "string" }, hanja_name: { type: "string" }, english_name: { type: "string" },
        email: { type: "string" }, resident_number: { type: "string" }, address: { type: "string" },
        bank_name: { type: "string" }, account_number: { type: "string" }, account_holder: { type: "string" },
        phones: {
          type: "object", additionalProperties: false, required: ["home", "work", "mobile"],
          properties: { home: { type: "string" }, work: { type: "string" }, mobile: { type: "string" } }
        },
        education: {
          type: "array", maxItems: 3, items: {
            type: "object", additionalProperties: false,
            required: ["period", "school", "department_major", "degree_type"],
            properties: { period: { type: "string" }, school: { type: "string" }, department_major: { type: "string" }, degree_type: { type: "string" } }
          }
        },
        careers: {
          type: "array", maxItems: 20, items: {
            type: "object", additionalProperties: false,
            required: ["employment_period", "organization", "position", "duties"],
            properties: { employment_period: { type: "string" }, organization: { type: "string" }, position: { type: "string" }, duties: { type: "string" } }
          }
        },
        include_policy_research: { type: "boolean" },
        policy_research: {
          type: "array", maxItems: 3, items: {
            type: "object", additionalProperties: false,
            required: ["year", "title", "role", "client", "notes"],
            properties: { year: { type: "string" }, title: { type: "string" }, role: { type: "string" }, client: { type: "string" }, notes: { type: "string" } }
          }
        },
        include_licenses: { type: "boolean" },
        licenses: {
          type: "array", maxItems: 6, items: {
            type: "object", additionalProperties: false,
            required: ["acquired_date", "type", "issuer"],
            properties: { acquired_date: { type: "string" }, type: { type: "string" }, issuer: { type: "string" } }
          }
        }
      }
    },
    warnings: { type: "array", items: { type: "string" }, maxItems: 20 }
  }
};

function extractResponseOutputText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as unknown[]
      : [];
    for (const part of content) {
      if (part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string") {
        return String((part as Record<string, unknown>).text);
      }
    }
  }
  return "";
}

const ADVISORY_RESUME_AI_INSTRUCTIONS = "한국어 이력서에서 확인 가능한 정보만 정확히 추출한다. 추측하지 말고 없는 값은 빈 문자열 또는 빈 배열로 둔다. 주민등록번호와 계좌번호의 구분기호는 원문을 유지한다. 교육 및 산업체 경력에서 근무년월 필드는 만들지 않는다. 정책 연구경력의 역할은 가능하면 연구책임 또는 공동연구원으로 정규화한다. 불명확하거나 누락된 내용은 warnings에 한국어로 적는다.";
const ADVISORY_RESUME_AI_PROMPT = "첨부된 기존 이력서를 현재 앵커사업 자문위원 이력서 양식에 맞게 구조화해 주세요.";

async function analyzeAdvisoryResumeWithOpenAi(file: {
  safeName: string;
  contentType: string;
  dataUrl: string;
}): Promise<Record<string, unknown>> {
  const fileContent = file.contentType.startsWith("image/")
    ? { type: "input_image", image_url: file.dataUrl, detail: "high" }
    : { type: "input_file", filename: file.safeName, file_data: file.dataUrl };
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        store: false,
        reasoning: { effort: "medium" },
        instructions: ADVISORY_RESUME_AI_INSTRUCTIONS,
        input: [{ role: "user", content: [
          { type: "input_text", text: ADVISORY_RESUME_AI_PROMPT },
          fileContent
        ] }],
        text: { format: { type: "json_schema", name: "advisory_resume", strict: true, schema: ADVISORY_RESUME_JSON_SCHEMA } }
      })
    });
  } catch {
    throw new VoteFunctionError("AI_ANALYSIS_FAILED", "AI_ANALYSIS_FAILED", 502);
  }
  if (!response.ok) throw mapAiProviderResponseError("openai", response.status);
  try {
    const payload = await response.json() as Record<string, unknown>;
    return JSON.parse(extractResponseOutputText(payload)) as Record<string, unknown>;
  } catch {
    console.error("advisory-resume-ai", "openai-response-parse-failed");
    throw new VoteFunctionError("AI_ANALYSIS_FAILED", "AI_ANALYSIS_FAILED", 502);
  }
}

async function analyzeAdvisoryResumeWithGemini(file: {
  safeName: string;
  contentType: string;
  dataUrl: string;
}): Promise<Record<string, unknown>> {
  const base64 = file.dataUrl.split(",", 2)[1] || "";
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_DOCUMENT_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [
            { text: `${ADVISORY_RESUME_AI_INSTRUCTIONS}\n\n${ADVISORY_RESUME_AI_PROMPT}\n파일명: ${file.safeName}` },
            { inlineData: { mimeType: file.contentType, data: base64 } }
          ] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: ADVISORY_RESUME_JSON_SCHEMA,
            temperature: 0
          }
        })
      }
    );
  } catch {
    throw new VoteFunctionError("AI_ANALYSIS_FAILED", "AI_ANALYSIS_FAILED", 502);
  }
  if (!response.ok) throw mapAiProviderResponseError("gemini", response.status);
  try {
    const payload = await response.json() as Record<string, unknown>;
    return JSON.parse(extractGeminiOutputText(payload)) as Record<string, unknown>;
  } catch {
    console.error("advisory-resume-ai", "gemini-response-parse-failed");
    throw new VoteFunctionError("AI_ANALYSIS_FAILED", "AI_ANALYSIS_FAILED", 502);
  }
}

async function analyzeAdvisoryResume(
  token: string,
  fileName: string,
  contentType: string,
  dataUrl: string
) {
  const { member } = await getAdvisorySession(token);
  if (!OPENAI_API_KEY && !GEMINI_API_KEY) {
    throw new VoteFunctionError("AI_NOT_CONFIGURED", "AI_NOT_CONFIGURED", 503);
  }
  const file = decodeAdvisoryResumeAiFile(fileName, contentType, dataUrl);
  const failures: VoteFunctionError[] = [];
  let parsed: Record<string, unknown> | null = null;
  let model = "";
  if (OPENAI_API_KEY) {
    try {
      parsed = await analyzeAdvisoryResumeWithOpenAi(file);
      model = "gpt-5.6-luna";
    } catch (error) {
      const failure = error instanceof VoteFunctionError
        ? error
        : new VoteFunctionError("AI_ANALYSIS_FAILED", "AI_ANALYSIS_FAILED", 502);
      failures.push(failure);
      console.error("advisory-resume-ai", "openai-fallback", failure.code);
    }
  }
  if (!parsed && GEMINI_API_KEY) {
    try {
      parsed = await analyzeAdvisoryResumeWithGemini(file);
      model = GEMINI_DOCUMENT_MODEL;
    } catch (error) {
      const failure = error instanceof VoteFunctionError
        ? error
        : new VoteFunctionError("AI_ANALYSIS_FAILED", "AI_ANALYSIS_FAILED", 502);
      failures.push(failure);
      console.error("advisory-resume-ai", "gemini-failed", failure.code);
    }
  }
  if (!parsed) {
    const hasAnalysisFailure = failures.some(failure => failure.code === "AI_ANALYSIS_FAILED");
    const code = hasAnalysisFailure ? "AI_ANALYSIS_FAILED" : "AI_NOT_CONFIGURED";
    throw new VoteFunctionError(code, code, code === "AI_NOT_CONFIGURED" ? 503 : 502);
  }
  try {
    const resume = validateAdvisoryResume(parsed.resume, false, 20);
    if (!resume.korean_name) resume.korean_name = cleanText(member.name, 100, true);
    if (!resume.account_holder) resume.account_holder = resume.korean_name;
    const warnings = Array.isArray(parsed.warnings)
      ? parsed.warnings.slice(0, 20).map(value => cleanText(value, 300)).filter(Boolean)
      : [];
    return { resume, warnings, model };
  } catch (error) {
    if (error instanceof VoteFunctionError) throw error;
    throw new VoteFunctionError("AI_ANALYSIS_FAILED", "AI_ANALYSIS_FAILED", 502);
  }
}

type AdvisoryNameVerificationStatus = "MATCH" | "MISMATCH" | "UNVERIFIED" | "FAILED";

type AdvisoryDocumentExtraction = {
  bank_name: string;
  account_number: string;
  account_holder: string;
  resident_number: string;
  address: string;
};

type AdvisoryDocumentVerification = {
  status: AdvisoryNameVerificationStatus;
  matches: boolean | null;
  verifiedAt: string | null;
  extraction: AdvisoryDocumentExtraction | null;
};

function mergeAdvisoryDocumentExtraction(
  previous: AdvisoryDocumentExtraction | null,
  current: AdvisoryDocumentExtraction | null
): AdvisoryDocumentExtraction | null {
  const merged = {
    bank_name: current?.bank_name || previous?.bank_name || "",
    account_number: current?.account_number || previous?.account_number || "",
    account_holder: current?.account_holder || previous?.account_holder || "",
    resident_number: current?.resident_number || previous?.resident_number || "",
    address: current?.address || previous?.address || ""
  };
  return Object.values(merged).some(Boolean) ? merged : null;
}

function isAdvisoryDocumentExtractionComplete(
  documentType: string,
  extraction: AdvisoryDocumentExtraction | null
): boolean {
  if (!extraction) return false;
  return documentType === "ID_COPY"
    ? Boolean(extraction.resident_number && extraction.address)
    : Boolean(extraction.bank_name && extraction.account_number && extraction.account_holder);
}

const ADVISORY_DOCUMENT_LAYOUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "readable", "confidence", "rotation_degrees", "top_left_x", "top_left_y", "top_right_x", "top_right_y",
    "bottom_right_x", "bottom_right_y", "bottom_left_x", "bottom_left_y"
  ],
  properties: {
    readable: { type: "boolean" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    rotation_degrees: { type: "integer", enum: [0, 90, 180, 270] },
    top_left_x: { type: "number", minimum: 0, maximum: 1 },
    top_left_y: { type: "number", minimum: 0, maximum: 1 },
    top_right_x: { type: "number", minimum: 0, maximum: 1 },
    top_right_y: { type: "number", minimum: 0, maximum: 1 },
    bottom_right_x: { type: "number", minimum: 0, maximum: 1 },
    bottom_right_y: { type: "number", minimum: 0, maximum: 1 },
    bottom_left_x: { type: "number", minimum: 0, maximum: 1 },
    bottom_left_y: { type: "number", minimum: 0, maximum: 1 }
  }
};

const ADVISORY_IDENTITY_BANK_LAYOUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["identity", "bank"],
  properties: {
    identity: ADVISORY_DOCUMENT_LAYOUT_SCHEMA,
    bank: ADVISORY_DOCUMENT_LAYOUT_SCHEMA
  }
};

function normalizeAdvisoryDocumentLayout(parsed: Record<string, unknown>) {
  const coordinate = (key: string) => Math.min(1, Math.max(0, Number(parsed[key]) || 0));
  const rotation = Number(parsed.rotation_degrees);
  return {
    readable: parsed.readable === true,
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
    rotation_degrees: rotation === 90 || rotation === 180 || rotation === 270 ? rotation : 0,
    top_left_x: coordinate("top_left_x"), top_left_y: coordinate("top_left_y"),
    top_right_x: coordinate("top_right_x"), top_right_y: coordinate("top_right_y"),
    bottom_right_x: coordinate("bottom_right_x"), bottom_right_y: coordinate("bottom_right_y"),
    bottom_left_x: coordinate("bottom_left_x"), bottom_left_y: coordinate("bottom_left_y")
  };
}

const ADVISORY_DOCUMENT_LAYOUT_INSTRUCTIONS = "문서 사진의 원근 보정용 경계와 OCR 정방향을 판독한다. 먼저 문서의 한글·숫자 줄을 OCR로 읽어 글자가 똑바로 서는 방향을 판단한다. 좌표는 전체 원본 이미지 기준 0~1 정규화 값이며, 네 점은 회전 전 화면에서 선택 영역의 기하학적 좌상, 우상, 우하, 좌하 순서다. rotation_degrees는 선택 영역을 크롭한 뒤 글자가 정방향이 되도록 시계방향으로 회전할 각도이며 0, 90, 180, 270 중 하나다. 반시계방향 90도 보정은 270으로 반환한다. 목표 문서 외의 배경과 다른 페이지는 포함하지 않는다. 확정할 수 없으면 readable=false로 둔다.";

async function analyzeAdvisoryDocumentLayoutWithOpenAi(
  bytes: Uint8Array,
  contentType: string,
  prompt: string,
  schema: Record<string, unknown> = ADVISORY_DOCUMENT_LAYOUT_SCHEMA,
  schemaName = "advisory_document_layout"
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        store: false,
        reasoning: { effort: "low" },
        instructions: ADVISORY_DOCUMENT_LAYOUT_INSTRUCTIONS,
        input: [{ role: "user", content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: `data:${contentType};base64,${bytesToBase64(bytes)}`, detail: "high" }
        ] }],
        text: { format: { type: "json_schema", name: schemaName, strict: true, schema } }
      })
    });
  } catch {
    throw new VoteFunctionError("AI_ANALYSIS_FAILED", "AI_ANALYSIS_FAILED", 502);
  }
  if (!response.ok) throw mapAiProviderResponseError("openai", response.status);
  try {
    const payload = await response.json() as Record<string, unknown>;
    return JSON.parse(extractResponseOutputText(payload)) as Record<string, unknown>;
  } catch {
    console.error("advisory-document-layout", { provider: "openai", stage: "parse", status: "invalid-response" });
    throw new VoteFunctionError("AI_RESPONSE_INVALID", "AI_RESPONSE_INVALID", 502);
  }
}

async function analyzeAdvisoryDocumentLayoutWithGemini(
  bytes: Uint8Array,
  contentType: string,
  prompt: string,
  schema: Record<string, unknown> = ADVISORY_DOCUMENT_LAYOUT_SCHEMA
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_DOCUMENT_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [
            { text: `${ADVISORY_DOCUMENT_LAYOUT_INSTRUCTIONS}\n\n${prompt}` },
            { inlineData: { mimeType: contentType, data: bytesToBase64(bytes) } }
          ] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: schema,
            temperature: 0
          }
        })
      }
    );
  } catch {
    throw new VoteFunctionError("AI_ANALYSIS_FAILED", "AI_ANALYSIS_FAILED", 502);
  }
  if (!response.ok) throw mapAiProviderResponseError("gemini", response.status);
  try {
    const payload = await response.json() as Record<string, unknown>;
    return JSON.parse(extractGeminiOutputText(payload)) as Record<string, unknown>;
  } catch {
    console.error("advisory-document-layout", { provider: "gemini", stage: "parse", status: "invalid-response" });
    throw new VoteFunctionError("AI_RESPONSE_INVALID", "AI_RESPONSE_INVALID", 502);
  }
}

async function analyzeAdvisoryDocumentLayout(
  token: string,
  rawDocumentType: unknown,
  rawFileName: unknown,
  rawDataUrl: unknown
) {
  await getAdvisorySession(token);
  if (!OPENAI_API_KEY && !GEMINI_API_KEY) {
    throw new VoteFunctionError("AI_NOT_CONFIGURED", "AI_NOT_CONFIGURED", 503);
  }
  const documentType = String(rawDocumentType ?? "");
  if (!new Set(["ID_COPY", "BANK_COPY", "IDENTITY_BANK"]).has(documentType)) {
    throw new VoteFunctionError("INVALID_DOCUMENT", "INVALID_DOCUMENT");
  }
  const fileName = cleanText(rawFileName, 160, true).replace(/[\\/]/g, "_");
  const dataUrl = String(rawDataUrl ?? "");
  const decoded = decodeAdvisoryDocument(dataUrl, 1024 * 1024);
  if (!decoded.contentType.startsWith("image/")) throw new VoteFunctionError("INVALID_DOCUMENT", "INVALID_DOCUMENT");
  const targetInstruction = documentType === "ID_COPY"
    ? "사진 속 신분증 카드 한 장의 외곽 네 모서리를 찾으세요. 배경, 손, 책상은 제외하세요."
    : documentType === "BANK_COPY"
      ? "사진 속 통장의 은행명, 예금주, 계좌번호를 OCR로 확인하세요. 펼친 2면이면 계좌정보가 실제로 인쇄된 한쪽 면의 화면상 외곽만 선택하고 약관·안내·표지·반대쪽 면과 가운데 접힘선은 제외하세요. 글자가 정방향이 되는 rotation_degrees도 반환하세요."
      : "사진에서 신분증 카드와 통장 계좌정보 면을 각각 찾으세요. identity에는 신분증 한 장의 화면상 외곽과 OCR 정방향 회전각을 반환하세요. bank에는 은행명·예금주·계좌번호를 OCR로 확인한 뒤, 펼친 2면 중 계좌정보가 있는 한쪽 면의 화면상 외곽과 정방향 회전각만 반환하세요. 약관·안내 면과 가운데 접힘선은 제외하고 보이지 않는 문서는 readable=false로 반환하세요.";
  const prompt = `${targetInstruction} 파일명: ${fileName}`;
  const combined = documentType === "IDENTITY_BANK";
  const normalizeResult = (parsed: Record<string, unknown>) => combined
    ? {
        identity: normalizeAdvisoryDocumentLayout((parsed.identity ?? {}) as Record<string, unknown>),
        bank: normalizeAdvisoryDocumentLayout((parsed.bank ?? {}) as Record<string, unknown>)
      }
    : normalizeAdvisoryDocumentLayout(parsed);
  const hasDetectedDocument = (result: ReturnType<typeof normalizeResult>) => combined
      ? (result as { identity: { readable: boolean }; bank: { readable: boolean } }).identity.readable
        || (result as { identity: { readable: boolean }; bank: { readable: boolean } }).bank.readable
      : (result as { readable: boolean }).readable;
  const schema = combined ? ADVISORY_IDENTITY_BANK_LAYOUT_SCHEMA : ADVISORY_DOCUMENT_LAYOUT_SCHEMA;
  const failures: VoteFunctionError[] = [];
  let lastUndetectedResult: ReturnType<typeof normalizeResult> | null = null;
  if (OPENAI_API_KEY) {
    try {
      const result = normalizeResult(await analyzeAdvisoryDocumentLayoutWithOpenAi(
        decoded.bytes,
        decoded.contentType,
        prompt,
        schema,
        combined ? "advisory_identity_bank_layout" : "advisory_document_layout"
      ));
      if (hasDetectedDocument(result)) return result;
      lastUndetectedResult = result;
      failures.push(new VoteFunctionError("DOCUMENT_NOT_DETECTED", "DOCUMENT_NOT_DETECTED", 422));
      console.error("advisory-document-layout", { provider: "openai", stage: "detect", status: "not-detected" });
    } catch (error) {
      const failure = error instanceof VoteFunctionError
        ? error
        : new VoteFunctionError("AI_ANALYSIS_FAILED", "AI_ANALYSIS_FAILED", 502);
      failures.push(failure);
      console.error("advisory-document-layout", { provider: "openai", stage: "request", status: failure.code });
    }
  }
  if (GEMINI_API_KEY) {
    try {
      const result = normalizeResult(await analyzeAdvisoryDocumentLayoutWithGemini(
        decoded.bytes,
        decoded.contentType,
        prompt,
        schema
      ));
      if (hasDetectedDocument(result)) return result;
      lastUndetectedResult = result;
      failures.push(new VoteFunctionError("DOCUMENT_NOT_DETECTED", "DOCUMENT_NOT_DETECTED", 422));
      console.error("advisory-document-layout", { provider: "gemini", stage: "detect", status: "not-detected" });
    } catch (error) {
      const failure = error instanceof VoteFunctionError
        ? error
        : new VoteFunctionError("AI_ANALYSIS_FAILED", "AI_ANALYSIS_FAILED", 502);
      failures.push(failure);
      console.error("advisory-document-layout", { provider: "gemini", stage: "request", status: failure.code });
    }
  }
  if (lastUndetectedResult) return lastUndetectedResult;
  const code = failures.some(failure => failure.code === "AI_RATE_LIMITED")
    ? "AI_RATE_LIMITED"
    : failures.some(failure => failure.code === "AI_RESPONSE_INVALID")
      ? "AI_RESPONSE_INVALID"
      : failures.some(failure => failure.code === "AI_ANALYSIS_FAILED")
        ? "AI_ANALYSIS_FAILED"
        : failures.some(failure => failure.code === "DOCUMENT_NOT_DETECTED")
          ? "DOCUMENT_NOT_DETECTED"
        : failures.some(failure => failure.code === "AI_AUTH_FAILED")
          ? "AI_AUTH_FAILED"
          : "AI_NOT_CONFIGURED";
  throw new VoteFunctionError(
    code,
    code,
    code === "AI_NOT_CONFIGURED" || code === "AI_AUTH_FAILED"
      ? 503
      : code === "AI_RATE_LIMITED"
        ? 429
        : code === "DOCUMENT_NOT_DETECTED"
          ? 422
          : 502
  );
}

const ADVISORY_DOCUMENT_EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["detected_name", "resident_number", "address", "bank_name", "account_number", "visible_lines", "readable"],
  properties: {
    detected_name: { type: "string" },
    resident_number: { type: "string" },
    address: { type: "string" },
    bank_name: { type: "string" },
    account_number: { type: "string" },
    visible_lines: { type: "array", items: { type: "string" }, maxItems: 8 },
    readable: { type: "boolean" }
  }
};

const ADVISORY_DOCUMENT_EXTRACTION_INSTRUCTIONS = "본인 확인과 전문가 수당 지급을 위해 제출자가 직접 제공한 한국어 증빙 문서를 정확히 전사한다. 신분증의 인적사항 블록은 위에서부터 1번째 줄 성명, 2번째 줄 주민등록번호, 그 다음 줄부터 주소로 판독한다. 주민등록번호가 공백·가운뎃점·하이픈으로 나뉘어도 보이는 숫자 13자리를 모두 반환한다. 주소는 도로명·건물번호·동호수에 이어지는 법정동과 아파트명 괄호 표기까지 순서대로 합친다. 예를 들어 `(무거동, 무거위브자이)`는 주소의 일부이므로 반드시 포함한다. 운전조건·면허조건·적성검사·발급 정보라고 명시된 괄호 줄만 주소에서 제외한다. 통장사본의 계좌정보 블록은 위에서부터 1번째 줄 예금주 또는 계좌주, 2번째 줄 상품명, 3번째 줄 계좌번호로 판독하며 은행명은 로고와 문서 머리글에서 확인한다. 은행명, 기관명, 서명, 발급기관명은 사람 성명으로 판단하지 않는다. visible_lines에는 해당 인적사항 또는 계좌정보 블록의 실제 인쇄 줄을 주소 괄호 줄까지 위에서 아래 순서로 반환한다. 확인할 수 없는 값만 빈 문자열로 두며 추측하거나 임의 마스킹하지 않는다.";

function advisoryDocumentExtractionPrompt(documentType: string, expectedName: string): string {
  return documentType === "ID_COPY"
    ? `제출자 성명은 ${expectedName}입니다. 비교용 성명을 참고하되 신분증 인적사항의 1줄 성명, 2줄 주민등록번호, 이후 주소 줄과 법정동·아파트명 괄호 줄까지 실제 인쇄 순서대로 판독해 주세요.`
    : `제출자 성명은 ${expectedName}입니다. 비교용 성명을 참고하되 통장 계좌정보의 1줄 예금주, 2줄 상품명, 3줄 계좌번호와 문서의 은행명을 판독해 주세요.`;
}

function extractGeminiOutputText(payload: Record<string, unknown>): string {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const firstCandidate = candidates[0];
  if (!firstCandidate || typeof firstCandidate !== "object") return "";
  const content = (firstCandidate as Record<string, unknown>).content;
  if (!content || typeof content !== "object") return "";
  const parts = Array.isArray((content as Record<string, unknown>).parts)
    ? (content as Record<string, unknown>).parts as unknown[]
    : [];
  return parts
    .filter(part => part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string")
    .map(part => String((part as Record<string, unknown>).text))
    .join("");
}

function mapAiProviderResponseError(provider: "openai" | "gemini", status: number): VoteFunctionError {
  console.error("advisory-document-ai", { provider, stage: "response", status });
  const code = status === 401 || status === 403
    ? "AI_AUTH_FAILED"
    : status === 429
      ? "AI_RATE_LIMITED"
      : "AI_ANALYSIS_FAILED";
  return new VoteFunctionError(code, code, code === "AI_AUTH_FAILED" ? 503 : code === "AI_RATE_LIMITED" ? 429 : 502);
}

async function extractAdvisoryDocumentWithOpenAi(
  bytes: Uint8Array,
  contentType: string,
  fileName: string,
  prompt: string
): Promise<Record<string, unknown>> {
  const dataUrl = `data:${contentType};base64,${bytesToBase64(bytes)}`;
  const fileContent = contentType.startsWith("image/")
    ? { type: "input_image", image_url: dataUrl, detail: "high" }
    : { type: "input_file", filename: fileName, file_data: dataUrl };
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        store: false,
        reasoning: { effort: "medium" },
        instructions: ADVISORY_DOCUMENT_EXTRACTION_INSTRUCTIONS,
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }, fileContent] }],
        text: { format: { type: "json_schema", name: "advisory_document_extraction", strict: true, schema: ADVISORY_DOCUMENT_EXTRACTION_SCHEMA } }
      })
    });
  } catch {
    throw new VoteFunctionError("AI_ANALYSIS_FAILED", "AI_ANALYSIS_FAILED", 502);
  }
  if (!response.ok) throw mapAiProviderResponseError("openai", response.status);
  try {
    const payload = await response.json() as Record<string, unknown>;
    return JSON.parse(extractResponseOutputText(payload)) as Record<string, unknown>;
  } catch {
    console.error("advisory-document-ai", "openai-response-parse-failed");
    throw new VoteFunctionError("AI_ANALYSIS_FAILED", "AI_ANALYSIS_FAILED", 502);
  }
}

async function extractAdvisoryDocumentWithGemini(
  bytes: Uint8Array,
  contentType: string,
  fileName: string,
  prompt: string
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_DOCUMENT_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [
            { text: `${ADVISORY_DOCUMENT_EXTRACTION_INSTRUCTIONS}\n\n${prompt}\n파일명: ${fileName}` },
            { inlineData: { mimeType: contentType, data: bytesToBase64(bytes) } }
          ] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: ADVISORY_DOCUMENT_EXTRACTION_SCHEMA,
            temperature: 0
          }
        })
      }
    );
  } catch {
    throw new VoteFunctionError("AI_ANALYSIS_FAILED", "AI_ANALYSIS_FAILED", 502);
  }
  if (!response.ok) throw mapAiProviderResponseError("gemini", response.status);
  try {
    const payload = await response.json() as Record<string, unknown>;
    return JSON.parse(extractGeminiOutputText(payload)) as Record<string, unknown>;
  } catch {
    console.error("advisory-document-ai", "gemini-response-parse-failed");
    throw new VoteFunctionError("AI_ANALYSIS_FAILED", "AI_ANALYSIS_FAILED", 502);
  }
}

async function verifyAdvisoryDocumentName(
  bytes: Uint8Array,
  contentType: string,
  fileName: string,
  documentType: string,
  expectedName: string
): Promise<AdvisoryDocumentVerification> {
  if (!OPENAI_API_KEY && !GEMINI_API_KEY) {
    throw new VoteFunctionError("AI_NOT_CONFIGURED", "AI_NOT_CONFIGURED", 503);
  }
  const prompt = advisoryDocumentExtractionPrompt(documentType, expectedName);
  const providerFailures: VoteFunctionError[] = [];
  let parsed: Record<string, unknown> | null = null;

  if (OPENAI_API_KEY) {
    try {
      parsed = await extractAdvisoryDocumentWithOpenAi(bytes, contentType, fileName, prompt);
    } catch (error) {
      const failure = error instanceof VoteFunctionError
        ? error
        : new VoteFunctionError("AI_ANALYSIS_FAILED", "AI_ANALYSIS_FAILED", 502);
      providerFailures.push(failure);
      console.error("advisory-document-ai", "openai-fallback", failure.code);
    }
  }
  if (!parsed && GEMINI_API_KEY) {
    try {
      parsed = await extractAdvisoryDocumentWithGemini(bytes, contentType, fileName, prompt);
    } catch (error) {
      const failure = error instanceof VoteFunctionError
        ? error
        : new VoteFunctionError("AI_ANALYSIS_FAILED", "AI_ANALYSIS_FAILED", 502);
      providerFailures.push(failure);
      console.error("advisory-document-ai", "gemini-failed", failure.code);
    }
  }
  if (!parsed) {
    const hasAnalysisFailure = providerFailures.some(failure => failure.code === "AI_ANALYSIS_FAILED");
    const code = hasAnalysisFailure ? "AI_ANALYSIS_FAILED" : "AI_NOT_CONFIGURED";
    throw new VoteFunctionError(code, code, code === "AI_NOT_CONFIGURED" ? 503 : 502);
  }

  try {
    const visibleLines = Array.isArray(parsed.visible_lines)
      ? parsed.visible_lines.map(line => cleanText(line, 300)).filter(Boolean)
      : [];
    const detectedNameSource = cleanText(parsed.detected_name, 100) || visibleLines[0] || "";
    const detectedName = detectedNameSource
      .replace(/^(?:예금주|계좌주|성명)\s*[:：]?\s*/u, "")
      .replace(/\s*님\s*$/u, "")
      .trim();
    const bankName = documentType === "BANK_COPY" ? cleanText(parsed.bank_name, 100) : "";
    const fallbackAccountNumber = visibleLines.find(line => line.replace(/\D/g, "").length >= 8) || "";
    const accountNumber = documentType === "BANK_COPY"
      ? (cleanText(parsed.account_number, 100) || fallbackAccountNumber)
        .replace(/^(?:계좌번호)\s*[:：]?\s*/u, "")
        .replace(/\s+/g, "")
      : "";
    const residentNumberDigits = documentType === "ID_COPY"
      ? (cleanText(parsed.resident_number, 30) || visibleLines[1] || "").replace(/\D/g, "")
      : "";
    const residentNumber = /^\d{13}$/.test(residentNumberDigits)
      ? residentNumberDigits.replace(/^(\d{6})(\d{7})$/, "$1-$2")
      : "";
    const excludedAddressLine = /(?:운전조건|면허조건|적성검사|발급정보|발급기관)/u;
    const addressLines = documentType === "ID_COPY"
      ? visibleLines.slice(2, 5).filter(line => !excludedAddressLine.test(line))
      : [];
    const addressParenthetical = addressLines.find(line => /^\s*\([^)]*\)\s*$/u.test(line)
      && !excludedAddressLine.test(line)) || "";
    const parsedAddress = documentType === "ID_COPY" ? cleanText(parsed.address, 300) : "";
    const addressSource = parsedAddress || addressLines.join(" ");
    const address = documentType === "ID_COPY"
      ? `${addressSource}${addressParenthetical && !addressSource.includes(addressParenthetical) ? ` ${addressParenthetical}` : ""}`
        .replace(/\s+/g, " ")
        .replace(/\s*\((?:운전조건|면허조건|적성검사|발급정보|발급기관)[^)]*\)\s*$/u, "")
        .trim()
      : "";
    const extraction = bankName || accountNumber || residentNumber || address || detectedName
      ? {
          bank_name: bankName,
          account_number: accountNumber,
          account_holder: documentType === "BANK_COPY" ? detectedName : "",
          resident_number: residentNumber,
          address
        }
      : null;
    if (parsed.readable !== true || !detectedName) {
      return { status: "FAILED", matches: null, verifiedAt: new Date().toISOString(), extraction };
    }
    const matches = normalizedPersonName(detectedName) === normalizedPersonName(expectedName);
    return { status: matches ? "MATCH" : "MISMATCH", matches, verifiedAt: new Date().toISOString(), extraction };
  } catch (error) {
    if (error instanceof VoteFunctionError) throw error;
    console.error("advisory-document-ai", "response-parse-failed");
    return { status: "FAILED", matches: null, verifiedAt: new Date().toISOString(), extraction: null };
  }
}

async function readAdvisoryDocumentExtraction(document: {
  document_type: string;
  encrypted_extracted_data?: string | null;
  extracted_data_iv?: string | null;
}): Promise<AdvisoryDocumentExtraction | null> {
  if (!document.encrypted_extracted_data
      || !document.extracted_data_iv) return null;
  try {
    const raw = await decryptAdvisoryResume(document.encrypted_extracted_data, document.extracted_data_iv);
    const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    return {
      bank_name: cleanText(value.bank_name, 100),
      account_number: cleanText(value.account_number, 100),
      account_holder: cleanText(value.account_holder, 100),
      resident_number: cleanText(value.resident_number, 20),
      address: cleanText(value.address, 300)
    };
  } catch {
    return null;
  }
}

function decodeAdvisoryDocument(dataUrl: string, maxBytes = 1024 * 1024): { bytes: Uint8Array; contentType: string; extension: string } {
  const match = /^data:(application\/pdf|image\/jpeg|image\/png);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new VoteFunctionError("INVALID_DOCUMENT", "INVALID_DOCUMENT");
  const bytes = base64ToBytes(match[2]);
  if (bytes.length === 0 || bytes.length > maxBytes) {
    throw new VoteFunctionError("DOCUMENT_TOO_LARGE", "DOCUMENT_TOO_LARGE", 413);
  }
  const contentType = match[1];
  const isPdf = contentType === "application/pdf"
    && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  const isJpeg = contentType === "image/jpeg"
    && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const isPng = contentType === "image/png"
    && pngMagic.every((byte, index) => bytes[index] === byte);
  if (!isPdf && !isJpeg && !isPng) {
    throw new VoteFunctionError("INVALID_DOCUMENT", "INVALID_DOCUMENT");
  }
  return { bytes, contentType, extension: isPdf ? "pdf" : isJpeg ? "jpg" : "png" };
}




const MAX_EXPERT_GENERATED_PDF_BYTES = 10 * 1024 * 1024;

function decodeExpertGeneratedPdf(dataUrl: string) {
  const match = /^data:application\/pdf(?:;[^,]*)?;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new VoteFunctionError("INVALID_DOCUMENT", "INVALID_PDF_DOCUMENT");
  const bytes = base64ToBytes(match[1]);
  if (bytes.length === 0 || bytes.length > MAX_EXPERT_GENERATED_PDF_BYTES) {
    throw new VoteFunctionError("DOCUMENT_TOO_LARGE", "DOCUMENT_TOO_LARGE", 413);
  }
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw new VoteFunctionError("INVALID_DOCUMENT", "INVALID_PDF_DOCUMENT");
  }
  return bytes;
}




async function advisoryIntakeContext(token: string) {
  const { session, meeting, member, ownerKind = "expert" } = await getAdvisorySession(token);
  if (ownerKind === "expert") {
    const [profileResult, draftResult, documentResult] = await Promise.all([
      service.from("life_instructor_private_profiles")
        .select("encrypted_resume, resume_iv, resume_completed_at, updated_at")
        .eq("person_id", session.member_id).maybeSingle(),
      service.from("life_instructor_private_profile_drafts")
        .select("encrypted_resume, resume_iv, updated_at")
        .eq("person_id", session.member_id).maybeSingle(),
      service.from("life_instructor_private_documents")
        .select("document_type, object_path, original_name, content_type, submitted_at, updated_at, name_verification_status, name_matches_member, name_verified_at, encrypted_extracted_data, extracted_data_iv, extracted_at")
        .eq("person_id", session.member_id)
    ]);
    const firstError = profileResult.error || draftResult.error || documentResult.error;
    if (firstError) throw mapDatabaseError(firstError);
    const documents: Record<string, Record<string, unknown>> = {};
    for (const document of documentResult.data ?? []) {
      const extraction = await readAdvisoryDocumentExtraction(document);
      const { data: signed, error: signedError } = await service.storage
        .from("instructor-private-documents").createSignedUrl(document.object_path, 300);
      if (signedError) throw mapStorageError(signedError);
      documents[document.document_type] = {
        exists: true,
        original_name: document.original_name,
        content_type: document.content_type,
        updated_at: document.updated_at,
        name_verification_status: document.name_verification_status,
        name_matches_member: document.name_matches_member,
        name_verified_at: document.name_verified_at,
        extracted_bank_name: extraction?.bank_name ?? "",
        extracted_account_number: extraction?.account_number ?? "",
        extracted_account_holder: extraction?.account_holder ?? "",
        extracted_resident_number: extraction?.resident_number ?? "",
        extracted_address: extraction?.address ?? "",
        extracted_at: document.extracted_at,
        signed_url: signed.signedUrl
      };
    }
    return {
      meeting,
      member,
      submission: null,
      resume: (draftResult.data ?? profileResult.data)
        ? await decryptAdvisoryResume(
          (draftResult.data ?? profileResult.data)!.encrypted_resume,
          (draftResult.data ?? profileResult.data)!.resume_iv
        )
        : null,
      documents: {
        ID_COPY: documents.ID_COPY ?? { exists: false },
        BANK_COPY: documents.BANK_COPY ?? { exists: false },
        RESUME: draftResult.data || profileResult.data
          ? { exists: Boolean(profileResult.data), is_draft: Boolean(draftResult.data), updated_at: (draftResult.data ?? profileResult.data)!.updated_at }
          : { exists: false, is_draft: false }
      },
      attachments: []
    };
  }
}

async function saveAdvisoryProfile(token: string, rawResume: unknown, isDraft = false) {
  const { session, member, ownerKind = "expert" } = await getAdvisorySession(token);
  const resume = validateAdvisoryResume(rawResume, !isDraft);
  if (!resume.korean_name) resume.korean_name = cleanText(member.name, 100, true);
  if (canonicalPersonName(resume.korean_name) !== canonicalPersonName(member.name)) {
    throw new VoteFunctionError("CONFLICT", "ADVISORY_PROFILE_NAME_MISMATCH");
  }
  const encrypted = await encryptAdvisoryResume(resume);
  const now = new Date().toISOString();
  const table = isDraft ? "life_instructor_private_profile_drafts" : "life_instructor_private_profiles";
  const ownerColumn = "person_id";
  const { error } = await service.from(table).upsert({
    [ownerColumn]: session.member_id,
    encrypted_resume: encrypted.ciphertext,
    resume_iv: encrypted.iv,
    resume_version: 1,
    ...(isDraft ? {} : { resume_completed_at: now }),
    updated_at: now
  }, { onConflict: ownerColumn });
  if (error) throw mapDatabaseError(error);

  if (!isDraft) {
    const draftTable = "life_instructor_private_profile_drafts";
    const { error: draftDeleteError } = await service.from(draftTable)
      .delete().eq(ownerColumn, session.member_id);
    if (draftDeleteError) throw mapDatabaseError(draftDeleteError);

  }
  return { saved: true, is_draft: isDraft, updated_at: now };
}

async function hasDocumentReferences(queries: Array<PromiseLike<{
  count: number | null;
  error: { message?: string } | null;
}>>) {
  const results = await Promise.all(queries);
  for (const result of results) {
    if (result.error) throw mapDatabaseError(result.error);
    if (result.count === null || !Number.isSafeInteger(result.count) || result.count < 0) {
      throw new VoteFunctionError("SERVER_ERROR", "DOCUMENT_REFERENCE_CHECK_FAILED", 500);
    }
  }
  return results.some(result => (result.count ?? 0) > 0);
}

async function cleanupAdvisoryObject(objectPath: string): Promise<boolean> {
  try {
    const references = [
      ["life_instructor_private_documents", "object_path"],
      ["life_instructor_generated_documents", "object_path"]
    ];
    if (await hasDocumentReferences(references.map(([table, column]) => service.from(table)
      .select("id", { count: "exact", head: true }).eq(column, objectPath)))) return false;
    const { error } = await service.storage.from("instructor-private-documents").remove([objectPath]);
    if (error) throw mapStorageError(error);
    return true;
  } catch {
    // No paths, original filenames, tokens, or provider error bodies in logs.
    console.error("advisory-storage-cleanup-deferred");
    return false;
  }
}

async function uploadAdvisoryDocument(
  token: string,
  rawDocumentType: unknown,
  rawFileName: unknown,
  rawDataUrl: unknown
) {
  const { session, member, ownerKind = "expert" } = await getAdvisorySession(token);
  const documentType = String(rawDocumentType ?? "");
  if (!new Set(["ID_COPY", "BANK_COPY"]).has(documentType)) {
    throw new VoteFunctionError("INVALID_DOCUMENT", "INVALID_DOCUMENT");
  }
  const originalName = cleanText(rawFileName, 200, true);
  const { bytes, contentType, extension } = decodeAdvisoryDocument(String(rawDataUrl ?? ""));
  const table = "life_instructor_private_documents";
  const ownerColumn = "person_id";
  const objectPath = `${ownerKind}/${session.member_id}/${documentType.toLowerCase()}/${crypto.randomUUID()}.${extension}`;
  const { data: previousDocument, error: previousError } = await service
    .from(table)
    .select("object_path")
    .eq(ownerColumn, session.member_id)
    .eq("document_type", documentType)
    .maybeSingle();
  if (previousError) throw mapDatabaseError(previousError);

  const { error: uploadError } = await service.storage
    .from("instructor-private-documents")
    .upload(objectPath, bytes, { contentType, upsert: false });
  if (uploadError) throw mapStorageError(uploadError);

  const now = new Date().toISOString();
  const { error: metadataError } = await service.from(table).upsert({
    [ownerColumn]: session.member_id,
    document_type: documentType,
    object_path: objectPath,
    original_name: originalName,
    content_type: contentType,
    sha256: await sha256(bytes),
    size_bytes: bytes.length,
    name_verification_status: "UNVERIFIED",
    name_matches_member: null,
    name_verified_at: null,
    encrypted_extracted_data: null,
    extracted_data_iv: null,
    extracted_at: null,
    submitted_at: now,
    updated_at: now
  }, { onConflict: `${ownerColumn},document_type` });
  if (metadataError) {
    await cleanupAdvisoryObject(objectPath);
    throw mapDatabaseError(metadataError);
  }

  if (previousDocument?.object_path && previousDocument.object_path !== objectPath) {
    await cleanupAdvisoryObject(previousDocument.object_path);
  }
  return {
    saved: true,
    document_type: documentType,
    original_name: originalName,
    updated_at: now,
    name_verification_status: "UNVERIFIED",
    name_matches_member: null,
    name_verified_at: null
  };
}

async function verifyStoredAdvisoryDocumentNames(token: string, force = false) {
  const { session, member, ownerKind = "expert" } = await getAdvisorySession(token);
  const table = "life_instructor_private_documents";
  const ownerColumn = "person_id";
  const { data: documents, error } = await service.from(table)
    .select("id, document_type, object_path, original_name, content_type, name_verification_status, name_matches_member, name_verified_at, encrypted_extracted_data, extracted_data_iv, extracted_at")
    .eq(ownerColumn, session.member_id);
  if (error) throw mapDatabaseError(error);

  const results: Array<Record<string, unknown>> = [];
  for (const document of documents ?? []) {
    const previousExtraction = await readAdvisoryDocumentExtraction(document);
    const needsVerification = force || ["UNVERIFIED", "FAILED"].includes(document.name_verification_status)
      || !isAdvisoryDocumentExtractionComplete(document.document_type, previousExtraction);
    if (!needsVerification) {
      results.push({
        document_type: document.document_type,
        name_verification_status: document.name_verification_status,
        name_matches_member: document.name_matches_member,
        name_verified_at: document.name_verified_at,
        extracted_bank_name: previousExtraction?.bank_name ?? "",
        extracted_account_number: previousExtraction?.account_number ?? "",
        extracted_account_holder: previousExtraction?.account_holder ?? "",
        extracted_resident_number: previousExtraction?.resident_number ?? "",
        extracted_address: previousExtraction?.address ?? ""
      });
      continue;
    }
    if (!OPENAI_API_KEY && !GEMINI_API_KEY) {
      throw new VoteFunctionError("AI_NOT_CONFIGURED", "AI_NOT_CONFIGURED", 503);
    }
    const { data: storedFile, error: downloadError } = await service.storage
      .from("instructor-private-documents")
      .download(document.object_path);
    if (downloadError || !storedFile) {
      results.push({ document_type: document.document_type, name_verification_status: "FAILED", name_matches_member: null });
      continue;
    }
    const verification = await verifyAdvisoryDocumentName(
      new Uint8Array(await storedFile.arrayBuffer()),
      document.content_type,
      document.original_name,
      document.document_type,
      member.name
    );
    const mergedExtraction = mergeAdvisoryDocumentExtraction(previousExtraction, verification.extraction);
    const encryptedExtraction = mergedExtraction
      ? await encryptAdvisoryResume(mergedExtraction)
      : null;
    const preservePreviousNameResult = verification.status === "FAILED"
      && ["MATCH", "MISMATCH"].includes(document.name_verification_status);
    const nextStatus = preservePreviousNameResult ? document.name_verification_status : verification.status;
    const nextMatches = preservePreviousNameResult ? document.name_matches_member : verification.matches;
    const nextVerifiedAt = preservePreviousNameResult ? document.name_verified_at : verification.verifiedAt;
    const { error: updateError } = await service.from(table).update({
      name_verification_status: nextStatus,
      name_matches_member: nextMatches,
      name_verified_at: nextVerifiedAt,
      encrypted_extracted_data: encryptedExtraction?.ciphertext ?? null,
      extracted_data_iv: encryptedExtraction?.iv ?? null,
      extracted_at: encryptedExtraction
        ? (verification.verifiedAt || document.extracted_at || new Date().toISOString())
        : null
    }).eq("id", document.id);
    if (updateError) throw mapDatabaseError(updateError);

    results.push({
      document_type: document.document_type,
      name_verification_status: nextStatus,
      name_matches_member: nextMatches,
      name_verified_at: nextVerifiedAt,
      extracted_bank_name: mergedExtraction?.bank_name ?? "",
      extracted_account_number: mergedExtraction?.account_number ?? "",
      extracted_account_holder: mergedExtraction?.account_holder ?? "",
      extracted_resident_number: mergedExtraction?.resident_number ?? "",
      extracted_address: mergedExtraction?.address ?? ""
    });
  }
  return { documents: results };
}

async function saveExpertGeneratedDocument(token: string, documentType: string, fileName: string, dataUrl: string) {
  if (!["IDENTITY_BANK_PDF", "RESUME_PDF"].includes(documentType)) {
    throw new VoteFunctionError("INVALID_DOCUMENT", "INVALID_DOCUMENT_TYPE");
  }
  const { member } = await getAdvisorySession(token);
  const instructorId = String(member.person_id ?? member.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(instructorId)) throw new VoteFunctionError("FORBIDDEN", "EXPERT_LINK_REQUIRED", 403);
  const bytes = decodeExpertGeneratedPdf(dataUrl);
  const originalName = `${fileName.trim().replace(/[\\/]/g, "_").replace(/\.pdf$/i, "").slice(0, 140) || "전문가-문서"}.pdf`;
  const objectPath = `expert/${instructorId}/generated/${documentType.toLowerCase()}/${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await service.storage.from("instructor-private-documents")
    .upload(objectPath, bytes, { contentType: "application/pdf", upsert: false });
  if (uploadError) throw mapStorageError(uploadError);

  const { data: previous, error: previousError } = await service.from("life_instructor_generated_documents")
    .select("object_path").eq("person_id", instructorId).eq("document_type", documentType).maybeSingle();
  if (previousError) {
    await cleanupAdvisoryObject(objectPath);
    throw mapDatabaseError(previousError);
  }
  const updatedAt = new Date().toISOString();
  const { error: saveError } = await service.from("life_instructor_generated_documents").upsert({
    person_id: instructorId,
    document_type: documentType,
    object_path: objectPath,
    original_name: originalName,
    content_type: "application/pdf",
    sha256: await sha256(bytes),
    size_bytes: bytes.length,
    updated_at: updatedAt
  }, { onConflict: "person_id,document_type" });
  if (saveError) {
    await cleanupAdvisoryObject(objectPath);
    throw mapDatabaseError(saveError);
  }
  if (previous?.object_path && previous.object_path !== objectPath) {
    await cleanupAdvisoryObject(previous.object_path);
  }
  return { saved: true, document_type: documentType, original_name: originalName, updated_at: updatedAt };
}

async function sessionRecord(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new VoteFunctionError("FORBIDDEN", "FORBIDDEN", 403);
  const {data, error} = await service.from("life_instructor_document_sessions")
    .select("*").eq("token_hash", await sha256(token)).maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!data || data.revoked_at || Date.parse(data.expires_at) <= Date.now()) {
    throw new VoteFunctionError("FORBIDDEN", "DOCUMENT_SESSION_EXPIRED", 403);
  }
  return data;
}

async function getAdvisorySession(token: string) {
  const record = await sessionRecord(token);
  const {data: person, error} = await service.from("life_people").select("id,name,active").eq("id",record.person_id).single();
  if (error || !person?.active) throw new VoteFunctionError("FORBIDDEN", "DOCUMENT_PERSON_UNAVAILABLE", 403);
  return {
    session: {...record, member_id: person.id, meeting_id: `instructor-${person.id}`},
    member: {id: person.id, person_id: person.id, name: person.name, org:"울산과학대학교", dept:"", rank:""},
    meeting: {id:`instructor-${person.id}`, title:"강사 장기보관 서류 제출", committee_id:"instructor-documents", meeting_date:null, meeting_end_date:null, submission_deadline:record.expires_at, closes_at:record.expires_at, status:"ACTIVE"},
    ownerKind: "expert" as string,
  };
}

const DOCUMENT_ACTIONS = new Set([
  "session", "logout", "downloads", "advisory-intake-context", "advisory-intake-save-profile",
  "advisory-intake-save-profile-draft", "advisory-intake-analyze-resume",
  "advisory-intake-analyze-document-layout", "advisory-intake-upload",
  "advisory-intake-verify-document-names", "expert-document-save-generated",
]);

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null,{status:204,headers:corsHeaders(request)});
  if (request.method !== "POST") return respond(request,405,{ok:false,error:{code:"NOT_FOUND"}});
  try {
    const origin = request.headers.get("origin") ?? "";
    if (origin && !ALLOWED_ORIGINS.includes(origin)) throw new VoteFunctionError("FORBIDDEN","FORBIDDEN",403);
    const authorization = request.headers.get("authorization") ?? "";
    const jwt = authorization.replace(/^Bearer\s+/i, "");
    const {data: authData, error: authError} = await service.auth.getUser(jwt);
    if (authError || !authData.user) throw new VoteFunctionError("FORBIDDEN","FORBIDDEN",403);
    if (Number(request.headers.get("content-length")) > 15 * 1024 * 1024) throw new VoteFunctionError("DOCUMENT_TOO_LARGE","DOCUMENT_TOO_LARGE",413);
    const raw = await request.text();
    if (raw.length > 15 * 1024 * 1024) throw new VoteFunctionError("DOCUMENT_TOO_LARGE","DOCUMENT_TOO_LARGE",413);
    let body: Record<string,unknown>;
    try { body=JSON.parse(raw); } catch { throw new VoteFunctionError("INVALID_DOCUMENT","INVALID_DOCUMENT"); }
    if (!body || typeof body!=="object" || Array.isArray(body)) throw new VoteFunctionError("INVALID_DOCUMENT","INVALID_DOCUMENT");
    const action = String(body.action ?? "");
    if (!DOCUMENT_ACTIONS.has(action)) throw new VoteFunctionError("NOT_FOUND","NOT_FOUND",404);
    const token = String(body.voter_token ?? "");
    const session = action === "session" ? null : await sessionRecord(token);
    if (session && session.actor_user_id !== authData.user.id) throw new VoteFunctionError("FORBIDDEN","FORBIDDEN",403);
    const caller = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false},
    });
    const {data: access,error: accessError} = await caller.rpc("life_instructor_document_access",{
      p_person:session?.person_id ?? body.person_id ?? null,
      p_org:session?.org_id ?? body.org_id ?? null,
    });
    if (accessError || !access || access.actor_user_id !== authData.user.id) throw new VoteFunctionError("FORBIDDEN","DOCUMENT_ACCESS_DENIED",403);
    let data: unknown;
    if (action === "session") {
      // Expired sessions contain hashes only; prune for this actor on entry.
      const {error: pruneError} = await service.from("life_instructor_document_sessions").delete().eq("actor_user_id",authData.user.id).lt("expires_at",new Date().toISOString());
      if (pruneError) throw mapDatabaseError(pruneError);
      const sessionToken = randomToken(), expiresAt = new Date(Date.now()+30*60*1000).toISOString();
      const {error} = await service.from("life_instructor_document_sessions").insert({person_id:access.id,org_id:access.org_id,actor_user_id:authData.user.id,token_hash:await sha256(sessionToken),expires_at:expiresAt});
      if (error) throw mapDatabaseError(error);
      data={token:sessionToken,member:access,expires_at:expiresAt};
    } else if (action === "logout") {
      const {error}=await service.from("life_instructor_document_sessions").update({revoked_at:new Date().toISOString()}).eq("id",session!.id);
      if(error) throw mapDatabaseError(error);
      data={revoked:true};
    } else if (action === "downloads") {
      const {data:documents,error}=await service.from("life_instructor_generated_documents").select("document_type,object_path,original_name,updated_at").eq("person_id",session!.person_id);
      if(error) throw mapDatabaseError(error);
      data=await Promise.all((documents??[]).map(async document=>{
        const {data:signed,error}=await service.storage.from("instructor-private-documents").createSignedUrl(document.object_path,300,{download:document.original_name});
        if(error) throw mapStorageError(error);
        return {document_type:document.document_type,original_name:document.original_name,updated_at:document.updated_at,signed_url:signed!.signedUrl};
      }));
    } else if (action === "advisory-intake-context") data=await advisoryIntakeContext(token);
    else if (action === "advisory-intake-save-profile") data=await saveAdvisoryProfile(token,body.resume);
    else if (action === "advisory-intake-save-profile-draft") data=await saveAdvisoryProfile(token,body.resume,true);
    else if (action === "advisory-intake-analyze-resume") data=await analyzeAdvisoryResume(token,String(body.file_name??""),String(body.content_type??""),String(body.data_url??""));
    else if (action === "advisory-intake-analyze-document-layout") data=await analyzeAdvisoryDocumentLayout(token,body.document_type,body.file_name,body.data_url);
    else if (action === "advisory-intake-upload") data=await uploadAdvisoryDocument(token,body.document_type,body.file_name,body.data_url);
    else if (action === "advisory-intake-verify-document-names") data=await verifyStoredAdvisoryDocumentNames(token,body.force===true);
    else if (action === "expert-document-save-generated") data=await saveExpertGeneratedDocument(token,String(body.document_type??""),String(body.file_name??""),String(body.data_url??""));
    return respond(request,200,{ok:true,data});
  } catch (error) {
    const known=error instanceof VoteFunctionError?error:new VoteFunctionError("SERVER_ERROR","SERVER_ERROR",500);
    console.error("instructor-documents",known.code);
    return respond(request,known.status,{ok:false,error:{code:known.code,message:known.message}});
  }
});
