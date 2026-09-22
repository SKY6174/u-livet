import type { Budget } from "./model";

export type FinanceEvidence = { page: number; quote: string };
export type FinanceProposal = {
  rows: (Budget["rows"][number] & { evidence: FinanceEvidence })[];
  scholarship: {
    count: string;
    amount: string;
    evidence: FinanceEvidence;
  } | null;
};

const MONEY = "(\\d{1,3}(?:,\\d{3})*|\\d{1,12})";
const BUDGET_ROW = new RegExp(`(운영비|인쇄비|재료비|강사료|보조인력|홍보비|시설비)\\s+${MONEY}\\s+${MONEY}(?=\\s|$)`, "g");
const SCHOLARSHIP_ROW = new RegExp(`학습활동\\s*우수장학\\s+(\\d{1,5})\\s+${MONEY}(?=\\s|$)`);

function amount(value: string) {
  const plain = value.replaceAll(",", "");
  return /^\d{1,12}$/.test(plain) ? plain : null;
}

export function extractPdfFinance(text: string): FinanceProposal {
  const result: FinanceProposal = { rows: [], scholarship: null };
  const pages = Array.from(text.matchAll(/\[(\d+)쪽\]\s*([\s\S]*?)(?=\[\d+쪽\]|$)/g));
  for (const page of pages) {
    const number = Number(page[1]);
    const body = page[2].replace(/\s+/g, " ").trim();
    const budgetStart = body.search(/5\s*\.?\s*예산집행현황/);
    if (budgetStart >= 0) {
      const rest = body.slice(budgetStart);
      const budgetEnd = rest.search(/\b6\s*\.?\s*프로그램/);
      const section = (budgetEnd < 0 ? rest : rest.slice(0, budgetEnd)).split(/\s+합계\s+/)[0];
      for (const match of Array.from(section.matchAll(BUDGET_ROW))) {
        const planned = amount(match[2]), spent = amount(match[3]);
        if (!planned || !spent || result.rows.some((row) => row.category === match[1])) continue;
        result.rows.push({
          category: match[1], calculation: "", planned, spent, note: "",
          evidence: { page: number, quote: match[0] },
        });
      }
    }
    if (!result.scholarship && /8\s*\.?\s*장학금\s*지원/.test(body)) {
      const match = body.match(SCHOLARSHIP_ROW);
      if (match) {
        const count = amount(match[1]), value = amount(match[2]);
        if (count && value) result.scholarship = {
          count, amount: value, evidence: { page: number, quote: match[0] },
        };
      }
    }
  }
  return result;
}
