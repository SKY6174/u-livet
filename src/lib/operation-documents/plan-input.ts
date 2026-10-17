import type { Field } from "./schema";

export const PLAN_AUDIENCES = ["성인학습자", "지역주민"] as const;
export const PLAN_PURPOSES = ["자격증", "취창업", "취미·여가", "자기계발", "진로진학", "기타"] as const;
export function recruitmentRatio(count: string, capacity: string) {
  return count !== "" && Number(capacity) > 0 ? String(Math.round(Number(count) / Number(capacity) * 10000) / 100) : "";
}
export function validRecruitment(rows: Record<string, string>[], capacity: string) {
  if (capacity !== "" && !/^\d{1,6}$/.test(capacity)) return false;
  const counts = rows.map(row => row.count);
  if (counts.some(count => count !== "" && !/^\d{1,6}$/.test(count))) return false;
  return !counts.some(count => count !== "") || (Number(capacity) > 0 && counts.reduce((sum, count) => sum + Number(count || 0), 0) <= Number(capacity));
}
export function selectedAudiences(value: string) {
  return PLAN_AUDIENCES.filter((_, index) => value.includes(index === 0 ? "성인" : "주민"));
}

const TEMPLATE_KEYS = new Set(["startTime", "endTime", "topic", "instructor", "hours", "assistant", "assistantHours", "location", "mode"]);
export function scheduleDefaults(row: Record<string, string> = {}, columns: Field[]) {
  return Object.fromEntries(columns.filter(field => TEMPLATE_KEYS.has(field.key)).map(field => [field.key, row[field.key] ?? ""]));
}
export function scheduleRowFromDefaults(defaults: Record<string, string>, columns: Field[]) {
  return { ...Object.fromEntries(columns.map(field => [field.key, ""])), ...scheduleDefaults(defaults, columns) };
}

const ZERO = BigInt(0), ONE = BigInt(1), MAX_BUDGET = BigInt("999999999999");
type Fraction = { n: bigint; d: bigint };
const currencyScale: Record<string, bigint> = { 원: ONE, 천원: BigInt(1000), 만원: BigInt(10000), 억원: BigInt(100000000) };
function factor(text: string) {
  const match = text.match(/^((?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.[0-9]{1,3})?)(억원|만원|천원|원)?(시간|개월|학기|세트|명|회|개|일|장|부|건|주|식|kg|cm|ml|g|m|l|L)?$/);
  if (!match || (match[2] && match[3])) return null;
  const [integer, decimal = ""] = match[1].replaceAll(",", "").split(".");
  if (integer.length > 12) return null;
  const result = { n: BigInt(integer + decimal) * (currencyScale[match[2]] ?? ONE), d: BigInt(10 ** decimal.length), currency: !!match[2], quantity: !!match[3] };
  return result.n <= MAX_BUDGET * result.d ? result : null;
}
function expression(text: string): Fraction | null {
  let total: Fraction = { n: ZERO, d: ONE };
  for (const term of text.replace(/\s/g, "").split("+")) {
    const factors = term.split(/[*×xX]/).map(factor);
    if (!factors.length || factors.some(value => !value)) return null;
    const values = factors as NonNullable<ReturnType<typeof factor>>[];
    if (!values.some(value => value.currency) && values[0].quantity) return null;
    let product: Fraction = { n: ONE, d: ONE };
    for (const value of values) {
      product = { n: product.n * value.n, d: product.d * value.d };
      if (product.n > MAX_BUDGET * product.d) return null;
    }
    total = { n: total.n * product.d + product.n * total.d, d: total.d * product.d };
    if (total.n > MAX_BUDGET * total.d) return null;
  }
  return total;
}
function amountLine(line: string): Fraction | null {
  const sides = line.trim().replace(/^[0-9]+[.)]\s+/, "").split("=");
  if (sides.length > 2) return null;
  // Labels may contain numbers (강사1), 재료2:). They are not prices.
  const labeled = sides[0].replace(/^.*?[)）:]\s*(?=[0-9])/, "");
  const left = expression(labeled.replace(/^[^0-9+\-*=×xX]+/, ""));
  if (sides.length === 1) return left;
  const right = expression(sides[1]);
  if (!right || (left && left.n * right.d !== right.n * left.d)) return null;
  return right;
}

/** Only complete, bounded arithmetic is calculated; descriptions stay editable. */
export function budgetCalculation(value: string): number | null {
  if (!value.trim() || value.length > 1000) return null;
  let sum: Fraction = { n: ZERO, d: ONE };
  for (const line of value.split(/\r?\n/).filter(line => line.trim())) {
    const amount = amountLine(line);
    if (!amount) return null;
    sum = { n: sum.n * amount.d + amount.n * sum.d, d: sum.d * amount.d };
    if (sum.n > MAX_BUDGET * sum.d) return null;
  }
  return sum.n % sum.d === ZERO ? Number(sum.n / sum.d) : null;
}
