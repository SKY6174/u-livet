// Synthetic-only fixture executed in a hardened Supabase user worker.
import { renderConsentPdf } from "../_shared/instructor-consent.ts";
import { emptyConsent, isConsentType } from "../_shared/instructor-consent-model.ts";
import { loadConsentAssets } from "../instructor-documents/consent-assets.ts";

Deno.serve(async request => {
  const { type, originalFonts } = await request.json();
  if (!isConsentType(type)) return new Response("Unknown document", { status: 400 });
  const form = {
    ...emptyConsent(), name: "가상 홍길동 갃힣", date: "2026-11-02", phone: "010-0000-0000",
    resident_number: "000000-0000000", affiliation: "가상 기관", program: "가상 한글 PDF 검증",
    period_start: "2026-09-01", period_end: "2026-12-31",
    privacy_consent: "YES", unique_id_consent: "YES", criminal_consent: true,
    integrity_confirm: true, relations: ["NO", "NO", "NO"],
    signature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAADElEQVR4nGNgGAUAAADIAAGpfRGwAAAAAElFTkSuQmCC",
  };
  let assets = loadConsentAssets();
  if (originalFonts) assets = {
    regular: Uint8Array.from(atob(originalFonts.regular), c => c.charCodeAt(0)),
    bold: Uint8Array.from(atob(originalFonts.bold), c => c.charCodeAt(0)),
    criminal: assets.criminal,
  };
  const started = performance.now();
  const bytes = await renderConsentPdf(type, form, assets, false);
  return new Response(bytes, { headers: {
    "content-type": "application/pdf", "x-render-ms": String(Math.round(performance.now() - started)),
  } });
});
