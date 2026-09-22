import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { isReviewOnly, REVIEW_MESSAGE } from "@/lib/deployment/review-mode";
export async function middleware(request: NextRequest) {
  const reviewOnly = isReviewOnly();
  if (reviewOnly && !["GET", "HEAD"].includes(request.method))
    return NextResponse.json({ error: "PREVIEW_READ_ONLY", message: REVIEW_MESSAGE }, {
      status: 403,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" },
    });
  let response = NextResponse.next({ request });
  const config = getSupabaseConfig();
  if (!config) return response;
  if (!reviewOnly) {
    const client = createServerClient(config.url, config.key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(items: { name: string; value: string; options: CookieOptions }[]) {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });
    await client.auth.getUser();
  }
  if (reviewOnly) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set(
    "Referrer-Policy",
    [
      "/instructor-documents",
      "/verify",
      "/certificate",
      "/api/verify",
      "/api/certificates",
      "/badges",
      "/api/badges",
      "/auth",
    ].some(
      (path) =>
        request.nextUrl.pathname === path ||
        request.nextUrl.pathname.startsWith(`${path}/`),
    )
      ? "no-referrer"
      : "same-origin",
  );
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
