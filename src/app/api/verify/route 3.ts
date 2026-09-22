import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createHash } from "node:crypto";
export const runtime = "nodejs";
const requests = new Map<string, { start: number; count: number }>();
const MAX_BODY_BYTES = 1024;

async function readBoundedBody(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES)
    throw new Error("Request body too large");
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("Request body too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function POST(request: Request) {
  const headers = {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
  };
  // Forwarded IP is used only after deployment explicitly trusts its proxy; otherwise shared throttling.
  const ip =
    process.env.TRUST_PROXY_IP === "true"
      ? (request.headers.get("x-forwarded-for")?.split(",")[0] ?? "shared")
      : "shared";
  const key = createHash("sha256").update(ip).digest("hex");
  const now = Date.now();
  for (const [k, v] of Array.from(requests))
    if (now - v.start > 60000) requests.delete(k);
  const bucket = requests.get(key) ?? { start: now, count: 0 };
  bucket.count++;
  requests.set(key, bucket);
  if (bucket.count > 60)
    return Response.json({ state: "RATE_LIMITED" }, { status: 429, headers });
  try {
    const raw = await readBoundedBody(request);
    const { token } = JSON.parse(raw);
    if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token))
      return Response.json({ state: "NOT_FOUND" }, { headers });
    const config = getSupabaseConfig();
    if (!config)
      return Response.json({ state: "UNAVAILABLE" }, { status: 503, headers });
    const db = createClient(config.url, config.key, {
      auth: { persistSession: false },
    });
    const result = await db.rpc("life_verify_certificate", { token });
    if (result.error)
      return Response.json({ state: "UNAVAILABLE" }, { status: 503, headers });
    return Response.json(result.data, { headers });
  } catch {
    return Response.json({ state: "NOT_FOUND" }, { status: 400, headers });
  }
}
