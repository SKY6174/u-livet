import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Identity } from "@/lib/portal/types";
import { getSecurityContext } from "@/lib/auth/mfa";
import { isReviewOnly } from "@/lib/deployment/review-mode";
export const getSessionIdentity = cache(async () => {
  if (isReviewOnly()) return null;
  try {
    const client = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user) return null;
    const { data, error: identityError } = await client.rpc("life_identity");
    if (identityError || !data) return null;
    return { ...(data as Identity), email: user.email ?? "" };
  } catch {
    return null;
  }
});
export async function requireIdentity(returnTo = "/mypage") {
  const identity = await getSessionIdentity();
  if (!identity) {
    const security = await getSecurityContext();
    if (
      security?.status.mfa_required &&
      !security.status.mfa_verified &&
      !security.status.needs_reset
    )
      redirect(
        `/auth/security?next=${encodeURIComponent(safeReturnTo(returnTo))}`,
      );
    redirect(`/auth/login?next=${encodeURIComponent(returnTo)}`);
  }
  return identity;
}
export function safeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\/(?!\/)[a-zA-Z0-9/_?=&%.-]*$/.test(value)
  )
    return "/mypage";
  return value;
}
