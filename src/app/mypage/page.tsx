import { redirect } from "next/navigation";
import Link from "next/link";
import { hasRole, memberLabel, workspaceKind } from "@/lib/auth/workspace-navigation";
import { requireIdentity } from "@/lib/auth/session";
import { PageIntro } from "@/components/portal/ui";
import { getStudentLearning } from "@/lib/student-learning/data";
import { StudentDashboard } from "@/components/student-learning/dashboard";
export default async function MyPage() {
  const me = await requireIdentity();
  const kind = workspaceKind(me);

  // 강사 계정은 통합된 'My Room'(/instructor)으로 안내합니다.
  if (hasRole(me, "INSTRUCTOR")) {
    redirect("/instructor");
  }

  if (kind !== "learner") return (
    <div className="page-shell">
      <PageIntro eyebrow="MY ACCOUNT" title={`${me.name} 님의 내 정보`}>
        본인 정보와 계정 보안을 관리합니다.
      </PageIntro>
      <section className="panel mb-8 max-w-2xl" aria-label="내 계정 정보">
        <span className="badge">{memberLabel(me)}</span>
        <h2 className="mt-4 text-xl font-bold">{me.name}</h2>
        <p className="mt-2 break-all text-slate-600">{me.email}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="btn-secondary" href="/mypage/notifications">연락처·수신 설정</Link>
        </div>
      </section>
      {kind === "office" && <Link className="btn-primary" href="/admin">사업단 관리로 이동 →</Link>}
      {hasRole(me, "INSTRUCTOR") && <section className="mt-8" aria-label="나의 강사 정보">
        <h2 className="section-title">통합 My Room 바로가기</h2>
        <div className="flex flex-wrap gap-3">
          <Link className="btn-primary" href="/instructor">My Room으로 이동 →</Link>
        </div>
      </section>}
    </div>
  );
  return <StudentDashboard name={me.name} data={await getStudentLearning()} />;
}
