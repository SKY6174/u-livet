import { BUDGET_FIELDS, BUDGET_KEYS, type OperationCourse, type WorkbookInput } from './model';

export const COMPARISON_FIELDS = { ...BUDGET_FIELDS, banners: '현수막' } as const;
export const COMPARISON_KEYS = [...BUDGET_KEYS, 'banners'] as const;
export type ComparisonKey = typeof COMPARISON_KEYS[number];
export type ExecutionRow = { values: Record<ComparisonKey, number | null>; total: number | null; issue: string | null };
export type ExecutionComparison = { entries: Record<string, ExecutionRow>; notices: string[] };
const normalize = (value: string) => value.normalize('NFC').replace(/[\s·:：()（）「」“”"'\-]/g, '').toLowerCase();
const empty = (): ExecutionRow => ({ values: { materials: null, printing: null, instructors: null, operations: null, support: null, scholarships: null, banners: null }, total: null, issue: null });
function amount(value: string | undefined): number | null | 'invalid' {
  const raw = (value ?? '').trim().replace(/원$/, '').trim();
  if (!raw || raw === '-' || raw === '—') return null;
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(raw)) return 'invalid';
  const result = Number(raw.replace(/,/g, ''));
  return Number.isSafeInteger(result) && result <= 999_999_999_999 ? result : 'invalid';
}

export function compareExecution(courses: Pick<OperationCourse, 'id' | 'name' | 'budget'>[], workbook: WorkbookInput | null): ExecutionComparison {
  const result: ExecutionComparison = { entries: {}, notices: [] };
  if (!workbook) return result;
  const headers = (workbook.rows[workbook.header_row] ?? []).map(normalize);
  const column = (...names: string[]) => {
    const matches = headers.map((value, i) => names.map(normalize).includes(value) ? i : -1).filter(i => i >= 0);
    return matches.length === 1 ? matches[0] : -1;
  };
  const uniqueGroups = [...Object.values(COMPARISON_FIELDS).map(label => [label]), ['총액', '합계', '총계'], ['프로그램 ID', 'Program ID'], ['구분']];
  if (uniqueGroups.some(names => headers.filter(value => names.map(normalize).includes(value)).length > 1)) {
    return { entries: {}, notices: ['항목명 또는 구분 열이 중복되어 집행 금액을 연결하지 않았습니다. 제목 행을 확인해 주세요.'] };
  }
  const courseColumn = column('세부 프로그램', '과정명', '교육과정', '교육과정명');
  const idColumn = column('과정 ID', 'course_id', 'guide_id');
  const programColumn = column('프로그램 ID', 'Program ID');
  const kindColumn = column('구분');
  if (courseColumn < 0 && idColumn < 0) return { entries: {}, notices: ['과정명 또는 과정 ID 열을 확인해 주세요. 프로그램 ID만으로는 개별 과정을 구분할 수 없습니다.'] };
  const columns = Object.fromEntries(COMPARISON_KEYS.map(key => [key, column(COMPARISON_FIELDS[key])])) as Record<ComparisonKey, number>;
  const totalColumn = column('총액', '합계', '총계');
  if (Object.values(columns).every(i => i < 0)) return { entries: {}, notices: ['재료비·인쇄비·강사료·운영비·보조인력·장학금·현수막 열을 확인해 주세요.'] };
  let unmatched = 0;
  for (const row of workbook.rows.slice(workbook.header_row + 1)) {
    if (kindColumn >= 0 && !['집행', '집행액', '집행현황'].includes(normalize(row[kindColumn] ?? ''))) continue;
    const title = row[courseColumn] ?? '';
    const id = row[idColumn] ?? '';
    if ((!title && !id) || ['소계', '합계', '총계'].includes(normalize(title))) continue;
    const matches = courses.filter(c => (id ? c.id === id.trim() : normalize(c.name) === normalize(title)) && (programColumn < 0 || !row[programColumn]?.trim() || normalize(c.budget.program_id) === normalize(row[programColumn])));
    if (matches.length !== 1) { unmatched++; continue; }
    const course = matches[0];
    if (result.entries[course.id]) { result.entries[course.id] = { ...empty(), issue: '같은 과정의 집행 행이 여러 개입니다.' }; continue; }
    const entry = empty();
    for (const key of COMPARISON_KEYS) {
      const value = amount(row[columns[key]]);
      if (value === 'invalid') entry.issue = '금액 형식을 확인해 주세요.';
      else entry.values[key] = value;
    }
    const total = amount(row[totalColumn]);
    if (total === 'invalid') entry.issue = '총액 형식을 확인해 주세요.';
    else if (total !== null) entry.total = total;
    else if (Object.values(entry.values).some(v => v !== null)) entry.total = Object.values(entry.values).reduce<number>((sum, v) => sum + (v ?? 0), 0);
    if (entry.issue) result.entries[course.id] = { ...empty(), issue: entry.issue };
    else result.entries[course.id] = entry;
  }
  if (unmatched) result.notices.push(`과정명 또는 프로그램 ID가 일치하지 않는 ${unmatched}개 행은 비교 표에 연결하지 않았습니다.`);
  if (Object.values(result.entries).some(entry => entry.issue)) result.notices.push('중복 행 또는 금액 오류가 있는 과정의 집행내역을 확인해 주세요.');
  return result;
}
export function executionSum(courses: Pick<OperationCourse, 'id'>[], comparison: ExecutionComparison, key: ComparisonKey | 'total') {
  const values = courses.map(c => key === 'total' ? comparison.entries[c.id]?.total : comparison.entries[c.id]?.values[key]).filter((v): v is number => typeof v === 'number');
  return values.length ? values.reduce((sum, v) => sum + v, 0) : null;
}
