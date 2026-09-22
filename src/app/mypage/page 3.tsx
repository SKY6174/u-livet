import Link from "next/link";
import { hasRole, memberLabel, workspaceKind } from "@/lib/auth/workspace-navigation";
import { requireIdentity } from "@/lib/auth/session";
import { PageIntro } from "@/components/portal/ui";
import { AccountSecurity } from "@/components/auth/account-security";
import { getStudentLearning } from "@/lib/student-learning/data";
import { StudentDashboard } from "@/components/student-learning/dashboard";
export default async function MyPage() {
  const me = await requireIdentity();
  const kind = workspaceKind(me);
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
          <Link className="btn-secondary" href="/auth/security">계정 보안·추가 인증</Link>
        </div>
      </section>
      {kind === "office" && <AccountSecurity />}
      {kind === "office" && <Link className="btn-primary" href="/admin">사업단 관리로 이동 →</Link>}
      {hasRole(me, "INSTRUCTOR") && <section className="mt-8" aria-label="나의 강사 정보">
        <h2 className="section-title">나의 강사 정보</h2>
        <div className="flex flex-wrap gap-3">
          <Link className="btn-secondary" href="/mypage/instructor">강사 이력·등록 심사</Link>
          <Link className="btn-secondary" href="/instructor/records">강의실적·경력증명</Link>
          <Link className="btn-primary" href="/instructor">강사 공간으로 이동 →</Link>
        </div>
      </section>}
    </div>
  );
  return <StudentDashboard name={me.name} data={await getStudentLearning()} />;
}
