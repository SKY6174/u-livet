export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    application: "uc-life",
    revision: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    environment: process.env.VERCEL_ENV ?? "development",
    authProfile: process.env.AUTH_PROFILE ?? null,
    reviewOnly: process.env.PREVIEW_REVIEW_ONLY === "true",
  }, { headers: { "Cache-Control": "no-store" } });
}
