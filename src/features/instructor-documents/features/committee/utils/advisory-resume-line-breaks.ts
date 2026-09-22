export function normalizeAdvisoryResumeLineBreaks(value: string): string {
  return value.replace(/\\n/g, "\n");
}
