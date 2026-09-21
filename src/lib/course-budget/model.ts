import type { CourseGuide } from "@/lib/course-guide/model";
import type { CourseWorkspace } from "@/lib/course-workspace/types";

export const BUDGET_FIELDS = {
  materials: "재료비", printing: "인쇄비", instructors: "강사료",
  operations: "운영비", support: "보조인력", scholarships: "장학금",
} as const;
export type BudgetKey = keyof typeof BUDGET_FIELDS;
export type BudgetAmounts = Record<BudgetKey, number | null>;
export type CourseBudget = BudgetAmounts & {
  program_id: string; revision: number; updated_at: string | null;
};
export type OperationCourse = CourseGuide & {
  budget: CourseBudget; source_id: string | null;
  teachers: string; assistants: string; support_staff: string;
  workspace: CourseWorkspace | null;
};
export type WorkbookSummary = {
  id: string; file_name: string; sheet_name: string; created_at: string;
  row_count: number; header_row: number;
};
export type WorkbookInput = {
  file_name: string; sheet_name: string; sha256: string;
  header_row: number; rows: string[][];
};
export type SavedWorkbook = WorkbookSummary & WorkbookInput;
export const BUDGET_KEYS = Object.keys(BUDGET_FIELDS) as BudgetKey[];
export const MAX_WORKBOOK_BYTES = 800_000;
export const budgetTotal = (budget: BudgetAmounts) => BUDGET_KEYS.reduce((total, key) => total + (budget[key] ?? 0), 0);
export const won = (value: number | null) => value === null ? "—" : value.toLocaleString("ko-KR");
export const canManageBudget = (roles: { role: string; org_id: string }[], org: string) => roles.some(r => r.org_id === org && ["COURSE_MANAGER", "SYSTEM_ADMIN"].includes(r.role));

export function budgetInput(form: FormData) {
  const program_id = String(form.get("program_id") ?? "").trim().toUpperCase();
  if (program_id && !/^[A-Z0-9]+(?:-[A-Z0-9]+){1,5}$/.test(program_id)) return null;
  if (program_id.length > 40) return null;
  const amounts = {} as BudgetAmounts;
  for (const key of BUDGET_KEYS) {
    const raw = String(form.get(key) ?? "").trim();
    if (raw && !/^\d{1,12}$/.test(raw)) return null;
    const value = raw === "" ? null : Number(raw);
    if (value !== null && (!Number.isSafeInteger(value) || value > 999_999_999_999)) return null;
    amounts[key] = value;
  }
  return { program_id, ...amounts };
}
export function validWorkbook(value: unknown): value is WorkbookInput {
  if (!value || typeof value !== "object") return false;
  const v = value as WorkbookInput;
  return typeof v.file_name === "string" && v.file_name.length > 0 && v.file_name.length <= 200 && /\.xlsx$/i.test(v.file_name)
    && typeof v.sheet_name === "string" && v.sheet_name.length > 0 && v.sheet_name.length <= 100
    && /^[a-f0-9]{64}$/.test(v.sha256) && Number.isInteger(v.header_row) && v.header_row >= 0 && v.header_row < 50
    && Array.isArray(v.rows) && v.rows.length > v.header_row + 1 && v.rows.length <= 2000
    && v.rows.every(row => Array.isArray(row) && row.length > 0 && row.length <= 40 && row.every(cell => typeof cell === "string" && cell.length <= 500 && !cell.includes("\0")))
    && new TextEncoder().encode(JSON.stringify(v.rows)).length <= MAX_WORKBOOK_BYTES;
}
export function normalizeSheet(rows: unknown[][]): string[][] {
  if (rows.length > 2000 || rows.some(row => row.length > 40)) throw new Error("최대 2,000행·40열까지 읽을 수 있습니다. 필요한 시트 범위를 줄여 주세요.");
  const result = rows.map(row => Array.from(row, value => value instanceof Date ? value.toISOString().slice(0, 10) : value == null ? "" : String(value)));
  if (result.some(row => row.some(cell => cell.length > 500 || cell.includes("\0"))) || new TextEncoder().encode(JSON.stringify(result)).length > MAX_WORKBOOK_BYTES) throw new Error("셀 내용 또는 시트 용량이 너무 큽니다. 필요한 내역만 남겨 주세요.");
  return result;
}
export function mergeOperationCourses(guides: Omit<OperationCourse, "workspace">[], workspaces: CourseWorkspace[]) {
  const indexed = new Map(workspaces.map(c => [c.id, c]));
  return guides.map(guide => ({ ...guide, workspace: guide.offering_id ? indexed.get(guide.offering_id) ?? null : null }));
}
