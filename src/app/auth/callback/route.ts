import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { recoveryOrigin } from "@/lib/auth/recovery";
import { socialDestination } from "@/lib/auth/social";
import { isReviewOnly } from "@/lib/deployment/review-mode";

export async function GET(request: Request) {
  // Never trust Host / forwarded headers to select the authentication destination.
  const origin = recoveryOrigin();
  const params = new URL(request.url).searchParams;
  let destination = "/auth/login?social_error=callback";
  try {
    const code = params.get("code");
    if (params.get("error") === "access_denied") destination = "/auth/login?social_error=cancelled";
    else if (!isReviewOnly() && !params.has("error") && code && code.length <= 2048) {
      const client = await createServerSupabaseClient();
      const result = await client.auth.exchangeCodeForSession(code);
      if (!result.error && result.data.user) destination = await socialDestination(params.get("next"));
    }
  } catch { /* Sanitize provider errors: never display or log codes/tokens. */ }
  const response = NextResponse.redirect(new URL(destination, origin));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
