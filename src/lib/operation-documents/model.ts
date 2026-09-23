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
  scholarships: ScholarshipDetail[];
};
export type ScholarshipDetail = {
  personId: string;
  name: string;
  category: string;
  rate: string;
  amount: string;
  bank: string;
  account: string;
  holder: string;
  paidOn: string;
  note: string;
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
  members: { person_id: string; name: string }[];
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
const pad = (value: string) => value.padStart(2, "0");
export function normalizeScheduleRow(
  row: Record<string, string>,
  kind: DocumentKind,
) {
  const raw = row.date ?? "";
  const dateMatch = raw.match(
    /(\d{4})[.\/-]\s*(\d{1,2})[.\/-]\s*(\d{1,2})/,
  );
  const timeMatch = raw.match(
    /(\d{1,2}):(\d{2})\s*[~～-]\s*(\d{1,2}):(\d{2})/,
  );
  const values: Record<string, string> = {
    ...row,
    date: dateMatch
      ? `${dateMatch[1]}-${pad(dateMatch[2])}-${pad(dateMatch[3])}`
      : raw,
    startTime:
      row.startTime ??
      (timeMatch ? `${pad(timeMatch[1])}:${timeMatch[2]}` : ""),
    endTime:
      row.endTime ??
      (timeMatch ? `${pad(timeMatch[3])}:${timeMatch[4]}` : ""),
  };
  const schedule = tables(kind).find((table) => table.key === "schedule")!;
  return Object.fromEntries(
    schedule.columns.map((column) => [column.key, values[column.key] ?? ""]),
  );
}
export function normalizeDocumentContent(
  content: Content,
  kind: DocumentKind,
): Content {
  return {
    ...content,
    tables: {
      ...content.tables,
      schedule: (content.tables.schedule ?? []).map((row) =>
        normalizeScheduleRow(row, kind),
      ),
    },
  };
}
function sessionDateTime(value: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}
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
    scholarships: [],
  };
}
export function normalizeBudget(value: Budget | (Omit<Budget, "scholarships"> & { scholarships?: ScholarshipDetail[] })): Budget {
  return {
    ...value,
    scholarships: Array.isArray(value.scholarships) ? value.scholarships : [],
  };
}
export function scholarshipSummary(budget: Budget) {
  if (!budget.scholarships.length)
    return {
      count: budget.scholarshipCount,
      amount: budget.scholarshipAmount,
    };
  return {
    count: String(new Set(budget.scholarships.map((row) => row.personId)).size),
    amount: String(
      budget.scholarships.reduce((total, row) => total + Number(row.amount || 0), 0),
    ),
  };
}
export function syncScholarshipSummary(budget: Budget): Budget {
  const summary = scholarshipSummary(budget);
  return {
    ...budget,
    scholarshipCount: summary.count,
    scholarshipAmount: summary.amount,
  };
}
export function mergeImportedPhotos(
  existing: Content["photos"],
  incoming: Content["photos"],
): Content["photos"] {
  let photos = existing.map((photo) => ({ ...photo }));
  for (const caption of PHOTO_CAPTIONS) {
    const source = incoming.find((photo) => photo.caption === caption && photo.image);
    if (!source) continue;
    photos = photos.filter(
      (photo) => photo.caption === caption || photo.image !== source.image,
    );
    const index = photos.findIndex((photo) => photo.caption === caption);
    const replacement = { ...source, caption };
    if (index >= 0) photos[index] = replacement;
    else photos.unshift(replacement);
  }
  const special = PHOTO_CAPTIONS.map(
    (caption) =>
      photos.find((photo) => photo.caption === caption) ?? {
        caption,
        date: "",
        image: "",
      },
  );
  const operations = photos.filter(
    (photo) =>
      !PHOTO_CAPTIONS.includes(photo.caption as (typeof PHOTO_CAPTIONS)[number]) &&
      (!!photo.image || !!photo.date),
  );
  for (const source of incoming.filter(
    (photo) => !PHOTO_CAPTIONS.includes(photo.caption as (typeof PHOTO_CAPTIONS)[number]),
  )) {
    if (!source.image || [...special, ...operations].some((photo) => photo.image === source.image))
      continue;
    if (operations.length >= MAX_OPERATION_PHOTOS) break;
    operations.push({ ...source });
  }
  return [
    ...special,
    ...operations.slice(0, MAX_OPERATION_PHOTOS).map((photo, index) => ({
      ...photo,
      caption: `운영사진${index + 1}`,
    })),
  ];
}
export function initialDocument(context: DocumentContext, kind: DocumentKind) {
  const saved = context.documents.find((d) => d.kind === kind);
  if (saved)
    return {
      ...saved,
      content: normalizeDocumentContent(saved.content, kind),
      budget: normalizeBudget(saved.budget),
    };
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
        normalizeScheduleRow(row, "result"),
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
    content.tables.schedule = context.sessions.map((s) => {
      const starts = sessionDateTime(s.starts_at),
        ends = sessionDateTime(s.ends_at);
      return {
        ...blankRow(tables(kind).find((t) => t.key === "schedule")!.columns),
        date: starts.date,
        startTime: starts.time,
        endTime: ends.time,
        topic: s.title,
        hours: String(
          Math.round(
            (Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 36000,
          ) / 100,
        ),
        instructor: content.fields.professor,
        location: c.location,
      };
    });
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
  if (f.type === "time") return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
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
    (rows.schedule as Record<string, string>[]).some(
      (row) => row.startTime && row.endTime && row.startTime >= row.endTime,
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
      "scholarships",
    ]) ||
    !Array.isArray(value.rows) ||
    value.rows.length < 1 ||
    value.rows.length > 30 ||
    !Array.isArray(value.scholarships) ||
    value.scholarships.length > 200
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
    ) &&
    value.scholarships.every(
      (r) =>
        record(r) &&
        exact(r, [
          "personId",
          "name",
          "category",
          "rate",
          "amount",
          "bank",
          "account",
          "holder",
          "paidOn",
          "note",
        ]) &&
        typeof r.personId === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(r.personId) &&
        ["name", "category", "bank", "account", "holder", "note"].every(
          (key) =>
            typeof r[key] === "string" &&
            (r[key] as string).length <= (key === "note" ? 1000 : 200),
        ) &&
        !!r.name &&
        !!r.category &&
        typeof r.rate === "string" &&
        /^\d{1,3}(\.\d{1,2})?$/.test(r.rate) &&
        Number(r.rate) <= 100 &&
        amount(r.amount) &&
        r.amount !== "" &&
        typeof r.paidOn === "string" &&
        (r.paidOn === "" ||
          (/^\d{4}-\d{2}-\d{2}$/.test(r.paidOn) &&
            Number.isFinite(Date.parse(r.paidOn)) &&
            new Date(r.paidOn).toISOString().slice(0, 10) === r.paidOn)),
    ) &&
    (value.scholarships.length === 0 ||
      (scholarshipSummary(value as unknown as Budget).count === value.scholarshipCount &&
        scholarshipSummary(value as unknown as Budget).amount === value.scholarshipAmount))
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
        !r.startTime?.trim() ||
        !r.endTime?.trim() ||
        !r.topic?.trim() ||
        !r.instructor?.trim() ||
        !r.hours ||
        !r.location?.trim(),
    )
  )
    missing.push("강의계획의 일자·시작·종료시간·주제·강사·시간·장소");
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
