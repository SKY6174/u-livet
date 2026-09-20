import { OPENING_SOURCE } from "./working-copy";

export type OpeningCopySummary = { source_id: string; revision: number; updated_at: string };
export type OpeningCopyOverview = { items: OpeningCopySummary[]; unavailable: boolean };

export function validOpeningCopySummaries(value: unknown): value is OpeningCopySummary[] {
  if (!Array.isArray(value) || value.length > 16) return false;
  const seen = new Set<string>();
  return value.every(row => {
    if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).sort().join(",") !== "revision,source_id,updated_at") return false;
    if (typeof row.source_id !== "string" || !OPENING_SOURCE.test(row.source_id) || seen.has(row.source_id)) return false;
    if (!Number.isInteger(row.revision) || row.revision < 1 || row.revision > 2147483647 || typeof row.updated_at !== "string" || !Number.isFinite(Date.parse(row.updated_at))) return false;
    seen.add(row.source_id);
    return true;
  });
}
