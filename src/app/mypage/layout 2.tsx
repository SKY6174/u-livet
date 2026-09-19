import { requireIdentity } from "@/lib/auth/session";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireIdentity("/mypage");
  return children;
}
