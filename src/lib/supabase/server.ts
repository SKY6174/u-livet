import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cache } from "react";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";
import { isReviewOnly } from "@/lib/deployment/review-mode";
// React cache is scoped to one server render; never share session cookies globally.
export const createServerSupabaseClient = cache(async () => {
  const config = getSupabaseConfig();
  if (!config) throw new Error("SUPABASE_NOT_CONFIGURED");
  const cookieStore = await cookies();
  const reviewOnly = isReviewOnly();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => reviewOnly ? [] : cookieStore.getAll(),
      setAll: (
        items: { name: string; value: string; options: CookieOptions }[],
      ) => {
        if (reviewOnly) return;
        try {
          items.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* Server Components cannot set cookies; middleware handles refresh. */
        }
      },
    },
  });
});
