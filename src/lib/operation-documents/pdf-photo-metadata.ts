export type PdfPhotoMetadata = { caption: string; date: string };

const pad = (value: string) => value.padStart(2, "0");

export function extractPhotoMetadata(text: string): PdfPhotoMetadata[] {
  const rows: PdfPhotoMetadata[] = [];
  const pattern =
    /(개강식|수료식|운영사진\s*\d+)\s*[\(（]\s*(\d{4})[.\/-]\s*(\d{1,2})[.\/-]\s*(\d{1,2})\.?\s*[\)）]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const date = `${match[2]}-${pad(match[3])}-${pad(match[4])}`;
    if (
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      continue;
    rows.push({ caption: match[1].replace(/\s/g, ""), date });
  }
  return rows;
}
