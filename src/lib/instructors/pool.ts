export const KIND_LABELS: Record<string, string> = {
  ALL: "전체",
  INTERNAL: "교내",
  EXTERNAL: "교외",
  UNSPECIFIED: "구분 확인",
};
export const ACTIVITY_LABELS: Record<string, string> = {
  TEACHING: "강의",
  DEVELOPMENT: "교재·과정 개발",
  REVIEW: "심사·자문",
  OTHER: "기타 활동",
};
export const PAYMENT_LABELS: Record<string, string> = {
  PLANNED: "지급 대기",
  PAID: "지급 완료",
  CANCELLED: "기록 취소",
};
export type PoolDocuments = {
  id: boolean;
  bank: boolean;
  resume: boolean;
  identity_pdf: boolean;
  resume_pdf: boolean;
};
export type PoolPerson = {
  id: string;
  name: string;
  kind: string;
  affiliation: string;
  department: string;
  position: string;
  specialty: string;
  phone: string;
  email: string;
  notes: string;
  status: string;
  documents_required: boolean;
  document_access: boolean;
  registered: boolean;
  removed?: boolean;
  revision: number;
  documents: PoolDocuments;
  courses: number;
  paid: number;
  pending: number;
};
export type PoolInput = Pick<
  PoolPerson,
  | "name"
  | "kind"
  | "affiliation"
  | "department"
  | "position"
  | "specialty"
  | "phone"
  | "email"
  | "notes"
  | "documents_required"
  | "status"
>;
export type Allowance = {
  id: string;
  person_id: string;
  name: string;
  person_kind: string;
  offering_id: string | null;
  offering_name: string | null;
  instructor_snapshot: {
    kind: string;
    affiliation: string;
    department: string;
    position: string;
  };
  title: string;
  activity_kind: string;
  activity_on: string;
  minutes: number;
  rate: number;
  gross: number;
  withholding: number;
  net: number;
  evidence: string;
  status: string;
  paid_on: string | null;
  reference: string;
  cancel_reason: string;
  revision: number;
};
export type PoolBoard = {
  items: PoolPerson[];
  total: number;
  page: number;
  page_size: number;
  counts: {
    total: number;
    internal: number;
    external: number;
    unclassified: number;
    ready: number;
    paid: number;
    pending: number;
  };
  profile_history: {
    id: number;
    snapshot: {
      kind: string;
      affiliation: string;
      department: string;
      position: string;
      status: string;
      revision: number;
    };
    changed_at: string;
  }[];
  selected: PoolPerson | null;
  selected_allowance?: Allowance;
  allowances: Allowance[];
  allowance_total: number;
  activity_page: number;
  offerings: { id: string; name: string; starts_on: string; ends_on: string }[];
  teaching: {
    id: string;
    name: string;
    starts_on: string;
    ends_on: string;
    sessions: number;
    confirmed_minutes: number;
  }[];
};
export const money = (value: number) =>
  `${Number(value).toLocaleString("ko-KR")}원`;
export const documentReady = (person: PoolPerson) =>
  !person.documents_required ||
  (person.documents.id && person.documents.bank && person.documents.resume);
export const pageNumber = (value?: string) =>
  value && /^[1-9]\d{0,4}$/.test(value) ? Number(value) : 1;
export const POOL_COLUMNS = [
  "성명",
  "구분",
  "소속기관",
  "소속부서",
  "직위",
  "전문분야",
  "연락처",
  "이메일",
  "비고",
];
export function validatePoolInput(input: unknown): PoolInput {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("강사 정보를 확인해 주세요.");
  const row = input as Record<string, unknown>;
  const limits = {
    name: 100,
    kind: 20,
    affiliation: 150,
    department: 100,
    position: 100,
    specialty: 300,
    phone: 20,
    email: 254,
    notes: 2000,
    status: 10,
  };
  const values: Record<string, string> = {};
  for (const [key, limit] of Object.entries(limits)) {
    if (
      typeof row[key] !== "string" ||
      (row[key] as string).trim().length > limit
    )
      throw new Error("입력 항목의 형식과 길이를 확인해 주세요.");
    values[key] = (row[key] as string).trim();
  }
  values.phone = values.phone.replace(/[\s()-]/g, "");
  if (
    !values.name ||
    !["INTERNAL", "EXTERNAL"].includes(values.kind) ||
    !["ACTIVE", "INACTIVE"].includes(values.status) ||
    typeof row.documents_required !== "boolean"
  )
    throw new Error("성명과 교내·교외 구분을 입력해 주세요.");
  if (values.phone && !/^0\d{8,10}$/.test(values.phone))
    throw new Error("연락처 형식을 확인해 주세요.");
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
    throw new Error("이메일 형식을 확인해 주세요.");
  return { ...values, documents_required: row.documents_required } as PoolInput;
}
export function parsePoolWorkbook(rows: unknown[][]): PoolInput[] {
  if (
    rows.length < 2 ||
    rows.length > 201 ||
    rows.some((row) => row.length > 9)
  )
    throw new Error("서식에 맞는 1~200명의 강사를 입력해 주세요.");
  if (POOL_COLUMNS.some((name, i) => rows[0][i] !== name))
    throw new Error("강사 등록 엑셀 서식의 열 이름과 순서를 유지해 주세요.");
  const seen = new Set<string>();
  return rows.slice(1).map((row, index) => {
    const values = row.map((value) =>
      value == null ? "" : String(value).trim(),
    );
    const [
      name,
      kind,
      affiliation = "",
      department = "",
      position = "",
      specialty = "",
      phone = "",
      email = "",
      notes = "",
    ] = values;
    if (!["교내", "교외"].includes(kind))
      throw new Error(`${index + 2}행: 구분은 교내 또는 교외로 입력해 주세요.`);
    const key = `${name}\n${kind}\n${affiliation}`;
    if (seen.has(key))
      throw new Error(`${index + 2}행: 같은 성명·구분·소속이 중복되었습니다.`);
    seen.add(key);
    try {
      return validatePoolInput({
        name,
        kind: kind === "교내" ? "INTERNAL" : "EXTERNAL",
        affiliation,
        department,
        position,
        specialty,
        phone,
        email,
        notes,
        documents_required: kind === "교외",
        status: "ACTIVE",
      });
    } catch (error) {
      throw new Error(
        `${index + 2}행: ${error instanceof Error ? error.message : "입력값을 확인해 주세요."}`,
      );
    }
  });
}
