import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireIdentity("/admin");
  if (!me.roles.some((r) => r.role === "COURSE_MANAGER")) notFound();
  return children;
}
