import { notFound } from "next/navigation";
import Link from "next/link";
import { requireIdentity } from "@/lib/auth/session";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireIdentity("/admin");
  if (!me.roles.some((r) => r.role === "COURSE_MANAGER")) notFound();
  return (
    <>
      <nav
        aria-label="사업단 관리 메뉴"
        className="no-print mx-auto flex max-w-7xl flex-wrap gap-3 px-5 pt-6"
      >
        <Link className="btn-secondary" href="/admin">과정 운영 관리</Link>
        <Link className="btn-secondary" href="/admin/course-plan">2026 과정 현황</Link>
        <Link className="btn-secondary" href="/admin/course-plan/opening">2026 개설 준비</Link>
        <Link className="btn-secondary" href="/admin/reports/preview">결과보고서 양식 검토</Link>
      </nav>
      {children}
    </>
  );
}
