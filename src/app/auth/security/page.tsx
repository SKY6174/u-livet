import { redirect } from "next/navigation";
import { getSessionIdentity, safeReturnTo } from "@/lib/auth/session";

export const metadata = {
  title: "계정 안내 · U-LiVE",
  robots: { index: false, follow: false },
};

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeReturnTo((await searchParams).next);
  if (await getSessionIdentity()) redirect(next.startsWith("/auth") ? "/mypage" : next);
  redirect("/auth/login?audience=office");
}
