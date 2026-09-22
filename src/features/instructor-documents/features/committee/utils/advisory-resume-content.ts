export const hasAdvisoryResumeRowContent = (row: object): boolean =>
  Object.values(row as Record<string, unknown>)
    .some(value => String(value ?? "").trim().length > 0);

export const compactAdvisoryResumeRows = <T extends object>(rows: readonly T[]): T[] =>
  rows.filter(hasAdvisoryResumeRowContent);
