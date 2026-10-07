import { headers } from "next/headers";
import { requireIdentity, safeReturnTo } from "@/lib/auth/session";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const documentAddress = (await headers()).get("x-u-live-document-return-to");
  await requireIdentity(documentAddress ? safeReturnTo(documentAddress) : "/mypage");
  return children;
}
