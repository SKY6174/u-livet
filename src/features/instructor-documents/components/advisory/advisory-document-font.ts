export const ADVISORY_DOCUMENT_FONT_STACK = '"KoPub_Pro Dotum", "KoPubDotum_Pro", "KoPub Dotum", sans-serif';

const KOPUB_FONT_SAMPLE = "가나다라마바사아자차카타파하 ABC 123";
const KOPUB_FONT_FACES = [
  '400 11pt "KoPub_Pro Dotum"',
  '700 11pt "KoPub_Pro Dotum"'
] as const;

export async function waitForAdvisoryDocumentFonts(targetDocument: Document): Promise<void> {
  if (!targetDocument.fonts) return;
  await Promise.all(KOPUB_FONT_FACES.map(font => targetDocument.fonts.load(font, KOPUB_FONT_SAMPLE)));
  await targetDocument.fonts.ready;
}
