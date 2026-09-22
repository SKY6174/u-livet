export type SourceEvidence = { page: number; quote: string };

function normalize(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function verifySourceEvidence(source: string, candidate: unknown): SourceEvidence | null {
  if (!candidate || typeof candidate !== "object") return null;
  const record = candidate as Record<string, unknown>;
  const page = record.page;
  const quote = record.quote;
  if (!Number.isInteger(page) || Number(page) < 1 || Number(page) > 50 || typeof quote !== "string") return null;
  const normalizedQuote = normalize(quote);
  if (normalizedQuote.length < 8 || normalizedQuote.length > 160) return null;

  const markers = [...source.matchAll(/(?:^|\n)\[(\d+)쪽\]\s*/g)];
  const index = markers.findIndex((marker) => Number(marker[1]) === page);
  if (index < 0) return null;
  const start = markers[index].index + markers[index][0].length;
  const end = markers[index + 1]?.index ?? source.length;
  if (!normalize(source.slice(start, end)).includes(normalizedQuote)) return null;
  return { page: Number(page), quote: normalizedQuote };
}
