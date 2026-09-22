export const PDF_VERSION = "1.7" as const;

// Validate generated output; changing an arbitrary file's header is not conversion.
export function requirePdf17(value: ArrayBuffer | Uint8Array): Uint8Array {
  const bytes = new Uint8Array(value instanceof Uint8Array ? value : value.slice(0));
  const header = new TextDecoder().decode(bytes.subarray(0, 8));
  if (header !== `%PDF-${PDF_VERSION}` || ![10, 13].includes(bytes[8])) {
    throw new Error("PDF 1.7 형식으로 생성하지 못했습니다. 다시 시도해 주세요.");
  }
  return bytes;
}
