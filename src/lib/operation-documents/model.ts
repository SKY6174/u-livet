import {
  BUDGET_CATEGORIES,
  PHOTO_CAPTIONS,
  MAX_OPERATION_PHOTOS,
  RECRUITMENT,
  fields,
  tables,
  type DocumentKind,
  type Field,
} from "./schema";
export type Content = {
  fields: Record<string, string>;
  tables: Record<string, Record<string, string>[]>;
  photos: { caption: string; date: string; image: string }[];
  signature: string;
  sourceSignature?: { image: string; page: number; fileId: string };
};
export type Budget = {
  rows: {
    category: string;
    calculation: string;
    planned: string;
    spent: string;
    note: string;
  }[];
  scholarshipCount: string;
  scholarshipAmount: string;
  scholarshipNote: string;
};
export type OperationDocument = {
  kind: DocumentKind;
  content: Content;
  budget: Budget;
  status: "DRAFT" | "REVIEW" | "SUBMITTED";
  revision: number;
  updated_at: string;
  reviewed_at: string | null;
  submitted_at: string | null;
  return_note: string;
};
export type CourseInfo = {
  id: string;
  name: string;
  academy: string;
  starts_on: string;
  ends_on: string;
  capacity: number;
  summary: string;
  curriculum: string;
  location: string;
  status: string;
  org_id: string;
};
export type DocumentContext = {
  course: CourseInfo;
  manager: boolean;
  responsible: { person_id: string; name: string; revision: number } | null;
  candidates: { id: string; name: string }[];
  documents: OperationDocument[];
  legacy: Record<string, unknown> | null;
  sessions: { title: string; starts_at: string; ends_at: string }[];
  submissions: {
    id: string;
    kind: DocumentKind;
    revision: number;
    submitted_at: string;
    name: string;
  }[];
};
export const STATUS_LABELS = {
  DRAFT: "작성 중",
  REVIEW: "담당자 검토 중",
  SUBMITTED: "최종 제출 완료",
};
export const RESULT_STATUS_LABELS: typeof STATUS_LABELS = {
  DRAFT: "담당자 예산 입력 중",
  REVIEW: "책임강사 작성 중",
  SUBMITTED: "서명·최종 제출 완료",
};
export const blankRow = (columns: Field[]) =>
  Object.fromEntries(columns.map((c) => [c.key, ""]));
export function emptyContent(kind: DocumentKind): Content {
  return {
    fields: Object.fromEntries(fields(kind).map((f) => [f.key, ""])),
    tables: Object.fromEntries(tables(kind).map((t) => [t.key, []])),
    photos:
      kind === "result"
        ? PHOTO_CAPTIONS.map((caption) => ({ caption, date: "", image: "" }))
        : [],
    signature: "",
  };
}
export function emptyBudget(kind: DocumentKind): Budget {
  return {
    rows: BUDGET_CATEGORIES[kind].map((category) => ({
      category,
      calculation: "",
      planned: "",
      spent: "",
      note: "",
    })),
    scholarshipCount: "",
    scholarshipAmount: "",
    scholarshipNote: "",
  };
}
export function initialDocument(context: DocumentContext, kind: DocumentKind) {
  const saved = context.documents.find((d) => d.kind === kind);
  if (saved) return saved;
  const content = emptyContent(kind),
    budget = emptyBudget(kind),
    c = context.course;
  const plan = context.documents.find((d) => d.kind === "plan");
  const old = context.legacy ?? {},
    source = (old.sourceReport ?? {}) as Record<string, unknown>;
  Object.assign(content.fields, {
    title: c.name,
    year: c.starts_on.slice(0, 4),
    academy: c.academy,
    program: c.academy,
    professor: context.responsible?.name ?? String(old.professor ?? ""),
    startsOn: c.starts_on,
    endsOn: c.ends_on,
    capacity: String(c.capacity),
    content: c.summary,
    method: "집합 교육",
  });
  if (kind === "plan") {
    content.fields.audience = "성인학습자";
    content.tables.recruitment = RECRUITMENT.map((category) => ({
      category,
      count: "",
      ratio: "",
    }));
  } else {
    if (plan) {
      for (const key of Object.keys(content.fields))
        if (plan.content.fields[key] !== undefined)
          content.fields[key] = plan.content.fields[key];
      content.tables.schedule = plan.content.tables.schedule.map((row) =>
        Object.fromEntries(
          tables("result")[0].columns.map((f) => [f.key, row[f.key] ?? ""]),
        ),
      );
    }
    for (const key of [
      "content",
      "method",
      "education",
      "promotion",
      "other",
      "strengths",
      "improvements",
      "followUp",
      "certificates",
      "employed",
      "surveyResponses",
      "satisfaction",
    ])
      if (old[key] !== null && old[key] !== undefined)
        content.fields[key] = String(old[key]);
    for (const key of ["enrolled", "completed"])
      if (source[key] !== undefined) content.fields[key] = String(source[key]);
    if (Array.isArray(old.budgets) && old.budgets.length)
      budget.rows = old.budgets.map((r: Record<string, unknown>) => ({
        category: String(r.category ?? ""),
        calculation: "",
        planned: String(r.planned ?? ""),
        spent: String(r.spent ?? ""),
        note: String(r.note ?? ""),
      }));
    else if (plan)
      budget.rows = BUDGET_CATEGORIES.result.map((category) => ({
        category,
        calculation: "",
        planned: String(
          plan.budget.rows
            .filter((r) =>
              category === "강사료"
                ? ["내부강사", "외부강사", "보조강사"].includes(r.category)
                : r.category === category,
            )
            .reduce((n, r) => n + Number(r.planned || 0), 0),
        ),
        spent: "",
        note: "",
      }));
    budget.scholarshipCount =
      source.scholarshipRecipients === undefined
        ? ""
        : String(source.scholarshipRecipients);
    budget.scholarshipAmount =
      source.scholarshipAmount === undefined
        ? ""
        : String(source.scholarshipAmount);
  }
  if (!content.tables.schedule.length)
    content.tables.schedule = context.sessions.map((s) => ({
      ...blankRow(tables(kind).find((t) => t.key === "schedule")!.columns),
      date: new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(s.starts_at)),
      topic: s.title,
      hours: String(
        Math.round((Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 36000) /
          100,
      ),
      instructor: content.fields.professor,
      location: c.location,
    }));
  return {
    kind,
    content,
    budget,
    status: "DRAFT" as const,
    revision: 0,
    updated_at: "",
    reviewed_at: null,
    submitted_at: null,
    return_note: "",
  };
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).length === keys.length && keys.every((k) => k in v);
export function validField(value: unknown, f: Field) {
  if (typeof value !== "string" || value.length > f.max || value.includes("\0"))
    return false;
  if (!value) return true;
  if (f.type === "number")
    return (
      /^\d{1,9}(\.\d{1,2})?$/.test(value) &&
      (!(f.key === "ratio" || f.key === "satisfaction") || Number(value) <= 100)
    );
  if (f.type === "date")
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value
    );
  return true;
}
export function validImage(value: unknown, limit = 400_000): value is string {
  return (
    typeof value === "string" &&
    (value === "" ||
      (value.length <= limit &&
        /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)))
  );
}
export function validContent(
  value: unknown,
  kind: DocumentKind,
): value is Content {
  if (
    !record(value) ||
    !(exact(value, ["fields", "tables", "photos", "signature"]) ||
      (kind === "result" && exact(value, ["fields", "tables", "photos", "signature", "sourceSignature"]))) ||
    !record(value.fields) ||
    !record(value.tables)
  )
    return false;
  const ff = fields(kind),
    tt = tables(kind),
    vals = value.fields,
    rows = value.tables;
  if (
    !exact(
      vals,
      ff.map((f) => f.key),
    ) ||
    ff.some((f) => !validField(vals[f.key], f)) ||
    !exact(
      rows,
      tt.map((t) => t.key),
    )
  )
    return false;
  if (
    tt.some(
      (t) =>
        !Array.isArray(rows[t.key]) ||
        (rows[t.key] as unknown[]).length > t.max ||
        (rows[t.key] as unknown[]).some(
          (r) =>
            !record(r) ||
            !exact(
              r,
              t.columns.map((f) => f.key),
            ) ||
            t.columns.some((f) => !validField(r[f.key], f)),
        ),
    )
  )
    return false;
  if (
    !Array.isArray(value.photos) ||
    (kind === "result"
      ? value.photos.length < PHOTO_CAPTIONS.length ||
        value.photos.length > PHOTO_CAPTIONS.length + MAX_OPERATION_PHOTOS
      : value.photos.length !== 0) ||
    value.photos.some(
      (p) =>
        !record(p) ||
        !exact(p, ["caption", "date", "image"]) ||
        typeof p.caption !== "string" ||
        p.caption.length > 100 ||
        !validField(p.date, {
          key: "date",
          label: "",
          type: "date",
          max: 10,
        }) ||
        !validImage(p.image),
    )
  )
    return false;
  return (
    validImage(value.signature, 200_000) &&
    (value.sourceSignature === undefined ||
      (record(value.sourceSignature) &&
        exact(value.sourceSignature, ["image", "page", "fileId"]) &&
        validImage(value.sourceSignature.image, 200_000) &&
        value.sourceSignature.image !== "" &&
        Number.isInteger(value.sourceSignature.page) &&
        (value.sourceSignature.page as number) >= 1 &&
        (value.sourceSignature.page as number) <= 50 &&
        typeof value.sourceSignature.fileId === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.sourceSignature.fileId))) &&
    JSON.stringify(value).length <= 3_000_000 &&
    (!vals.startsOn ||
      !vals.endsOn ||
      String(vals.startsOn) <= String(vals.endsOn))
  );
}
export function validBudget(value: unknown): value is Budget {
  if (
    !record(value) ||
    !exact(value, [
      "rows",
      "scholarshipCount",
      "scholarshipAmount",
      "scholarshipNote",
    ]) ||
    !Array.isArray(value.rows) ||
    value.rows.length < 1 ||
    value.rows.length > 30
  )
    return false;
  const amount = (v: unknown) =>
    typeof v === "string" && /^(|\d{1,12})$/.test(v);
  return (
    amount(value.scholarshipCount) &&
    amount(value.scholarshipAmount) &&
    typeof value.scholarshipNote === "string" &&
    value.scholarshipNote.length <= 1000 &&
    value.rows.every(
      (r) =>
        record(r) &&
        exact(r, ["category", "calculation", "planned", "spent", "note"]) &&
        ["category", "calculation", "note"].every(
          (k) => typeof r[k] === "string" && (r[k] as string).length <= 1000,
        ) &&
        !!r.category &&
        amount(r.planned) &&
        amount(r.spent),
    )
  );
}
export function missingContent(content: Content, kind: DocumentKind) {
  const missing = fields(kind)
    .filter((f) => f.required && !content.fields[f.key]?.trim())
    .map((f) => f.label);
  for (const table of tables(kind))
    if (table.min && content.tables[table.key].length < table.min)
      missing.push(table.label);
  if (
    content.tables.schedule.some(
      (r) =>
        !r.date?.trim() ||
        !r.topic?.trim() ||
        !r.instructor?.trim() ||
        !r.hours ||
        !r.location?.trim(),
    )
  )
    missing.push("강의계획의 일시·주제·강사·시간·장소");
  if (
    kind === "plan" &&
    content.tables.instructors.some((r) => !r.name?.trim())
  )
    missing.push("강사현황 성명");
  return missing;
}
export const money = (value: string | number) =>
  value === "" ? "" : Number(value).toLocaleString("ko-KR");
export const percentage = (numerator: string, denominator: string) =>
  numerator !== "" && Number(denominator) > 0
    ? `${((Number(numerator) / Number(denominator)) * 100).toFixed(1)}%`
    : "—";
