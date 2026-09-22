export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAVER_USERINFO_URL = "https://openapi.naver.com/v1/nid/me";
const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};

function reply(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: RESPONSE_HEADERS });
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Supabase calls this server-side with the token issued by NAVER for this login. */
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.length > 4096 || !/^Bearer [A-Za-z0-9._~+/-]+=*$/i.test(authorization)) {
    return reply({ error: "invalid_token" }, 401);
  }

  try {
    const upstream = await fetch(NAVER_USERINFO_URL, {
      headers: { Authorization: authorization, Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!upstream.ok) {
      return [401, 403].includes(upstream.status)
        ? reply({ error: "invalid_token" }, 401)
        : reply({ error: "provider_unavailable" }, 502);
    }
    const data: unknown = await upstream.json();
    if (!record(data) || data.resultcode !== "00" || !record(data.response)) {
      return reply({ error: "invalid_provider_response" }, 502);
    }
    const { id, email } = data.response;
    if (typeof id !== "string" || id.length < 1 || id.length > 255 || /[\s\u0000-\u001f]/.test(id)) {
      return reply({ error: "invalid_provider_response" }, 502);
    }
    if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply({ error: "email_required" }, 422);
    }
    // NAVER does not supply email_verified. Auth must verify it, never assume it.
    // Whitelist claims: do not forward profile pictures, names, birthdays or tokens.
    return reply({ sub: id, email, email_verified: false });
  } catch {
    // Do not expose or log upstream response bodies or bearer tokens.
    return reply({ error: "provider_unavailable" }, 502);
  }
}
