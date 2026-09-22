import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { renderCertificate } from "./pdf";
import type { CertificateJob } from "./types";
export async function generateApprovedCertificate(id: string) {
  const config = getSupabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const origin = process.env.CERTIFICATE_VERIFY_ORIGIN;
  if (!config || !key || !origin)
    throw new Error("CERTIFICATE_WORKER_NOT_CONFIGURED");
  const worker = createClient(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const claimed = await worker.rpc("life_claim_certificate", { i: id });
  if (claimed.error) throw new Error("CERTIFICATE_CLAIM_FAILED");
  if (!claimed.data) return;
  const job = claimed.data as CertificateJob;
  try {
    const pdf = await renderCertificate(job, origin);
    const result = await worker.rpc("life_finish_certificate", {
      i: id,
      nonce: job.nonce,
      pdf_base64: Buffer.from(pdf).toString("base64"),
    });
    if (result.error) throw new Error("CERTIFICATE_FINALIZE_FAILED");
  } catch {
    await worker.rpc("life_fail_certificate", { i: id, nonce: job.nonce });
    throw new Error("CERTIFICATE_GENERATION_FAILED");
  }
}
