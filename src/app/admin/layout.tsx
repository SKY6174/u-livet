import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { isOfficeMember } from "@/lib/auth/workspace-navigation";
import { OfficeNav } from "@/components/navigation/office-nav";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const me = await requireIdentity("/admin");
  if (!isOfficeMember(me)) notFound();
  return <><OfficeNav />{children}</>;
}
