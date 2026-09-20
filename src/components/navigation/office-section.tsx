import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/workspace-navigation";
import { OfficeNav } from "./office-nav";

export async function OfficeSection({ children, roles, returnTo, navigation = true }: {
  children: React.ReactNode; roles: string[]; returnTo: string; navigation?: boolean;
}) {
  const me = await requireIdentity(returnTo);
  if (!hasRole(me, ...roles)) notFound();
  return <>{navigation && <OfficeNav />}{children}</>;
}

// Keeps the original COURSE_MANAGER gate on every course-management subtree.
export async function CourseManagerLayout({ children }: { children: React.ReactNode }) {
  return OfficeSection({ children, roles: ["COURSE_MANAGER"], returnTo: "/admin/courses", navigation: false });
}
