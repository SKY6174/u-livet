import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { recoveryOrigin } from "@/lib/auth/recovery";
import { socialDestination } from "@/lib/auth/social";
import { socialLoginRetry } from "@/lib/auth/registration";
import { isReviewOnly } from "@/lib/deployment/review-mode";

export async function GET(request: Request) {
  // Never trust Host / forwarded headers to select the authentication destination.
  const origin = recoveryOrigin();
  const params = new URL(request.url).searchParams;
  const retry = (error: string) => socialLoginRetry(params.get("next"), error, params.get("audience"));
  let destination = retry("callback");
  try {
    const code = params.get("code");
    if (params.has("error") && params.get("error_code") === "provider_email_needs_verification") {
      destination = retry("email-verification");
    } else if (params.get("error") === "access_denied") destination = retry("cancelled");
    else if (!isReviewOnly() && !params.has("error") && code && code.length <= 2048) {
      const client = await createServerSupabaseClient();
      const result = await client.auth.exchangeCodeForSession(code);
      if (!result.error && result.data.user) {
        const user = result.data.user;
        const hasGoogle = user.identities?.some(identity => identity.provider === "google");
        // Narrower OAuth scopes do not remove metadata from earlier logins.
        if (hasGoogle && (user.user_metadata.picture != null || user.user_metadata.avatar_url != null)) {
          try {
            const cleaned = await client.auth.updateUser({ data: { picture: null, avatar_url: null } });
            if (cleaned.error || !cleaned.data.user || cleaned.data.user.user_metadata.picture != null || cleaned.data.user.user_metadata.avatar_url != null) {
              throw new Error("PROFILE_CLEANUP_FAILED");
            }
            const refreshed = await client.auth.refreshSession();
            if (refreshed.error || !refreshed.data.session) throw new Error("SESSION_REFRESH_FAILED");
          } catch {
            await client.auth.signOut({ scope: "local" });
            throw new Error("PROFILE_CLEANUP_FAILED");
          }
        }
        destination = await socialDestination(params.get("next"));
      }
    }
  } catch { /* Sanitize provider errors: never display or log codes/tokens. */ }
  const response = NextResponse.redirect(new URL(destination, origin));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
