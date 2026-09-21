import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/workspace-navigation";

export async function OfficeSection({ children, roles, returnTo }: {
  children: React.ReactNode; roles: string[]; returnTo: string;
}) {
  const me = await requireIdentity(returnTo);
  if (!hasRole(me, ...roles)) notFound();
  return <>{children}</>;
}

// Keeps the original COURSE_MANAGER gate on every course-management subtree.
export async function CourseManagerLayout({ children }: { children: React.ReactNode }) {
  return OfficeSection({ children, roles: ["COURSE_MANAGER"], returnTo: "/admin/courses" });
}
