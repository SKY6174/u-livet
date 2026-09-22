import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { getSupabaseConfig } from "@/lib/supabase/config";
export const runtime = "nodejs";
const buckets = new Map<string, { start: number; count: number }>();
const headers = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
};
export async function POST(request: Request) {
  const key = createHash("sha256")
    .update(
      process.env.TRUST_PROXY_IP === "true"
        ? (request.headers.get("x-forwarded-for")?.split(",")[0] ?? "shared")
        : "shared",
    )
    .digest("hex");
  const now = Date.now();
  for (const [k, v] of Array.from(buckets)) if (now - v.start > 60000) buckets.delete(k);
  const bucket = buckets.get(key) ?? { start: now, count: 0 };
  bucket.count++;
  buckets.set(key, bucket);
  if (bucket.count > 60)
    return Response.json({ state: "RATE_LIMITED" }, { status: 429, headers });
  if (Number(request.headers.get("content-length")) > 1024)
    return Response.json({ state: "NOT_FOUND" }, { status: 413, headers });
  try {
    const reader = request.body?.getReader();
    if (!reader)
      return Response.json({ state: "NOT_FOUND" }, { status: 400, headers });
    let size = 0;
    const parts: Uint8Array[] = [];
    try {
      while (true) {
        const r = await reader.read();
        if (r.done) break;
        size += r.value.byteLength;
        if (size > 1024) {
          await reader.cancel();
          return Response.json(
            { state: "NOT_FOUND" },
            { status: 413, headers },
          );
        }
        parts.push(r.value);
      }
    } finally {
      reader.releaseLock();
    }
    const input = JSON.parse(Buffer.concat(parts).toString("utf8"));
    const token = input?.token;
    if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token))
      return Response.json({ state: "NOT_FOUND" }, { headers });
    const config = getSupabaseConfig();
    if (!config)
      return Response.json({ state: "UNAVAILABLE" }, { status: 503, headers });
    const db = createClient(config.url, config.key, {
      auth: { persistSession: false },
    });
    const r = await db.rpc("life_verify_badge", { token });
    if (r.error)
      return Response.json({ state: "UNAVAILABLE" }, { status: 503, headers });
    return Response.json(r.data, {
      status: r.data?.state === "RATE_LIMITED" ? 429 : 200,
      headers,
    });
  } catch {
    return Response.json({ state: "NOT_FOUND" }, { status: 400, headers });
  }
}
