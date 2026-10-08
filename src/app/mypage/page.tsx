import { redirect } from "next/navigation";
import Link from "next/link";
import { hasRole, memberLabel, workspaceKind } from "@/lib/auth/workspace-navigation";
import { requireIdentity } from "@/lib/auth/session";
import { PageIntro } from "@/components/portal/ui";
import { getStudentLearning } from "@/lib/student-learning/data";
import { StudentDashboard } from "@/components/student-learning/dashboard";
import { getAccountProfile } from "@/lib/account-profile/data";
import { AccountInfo } from "@/components/account-profile/account-info";
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
      <section className="panel mb-8 max-w-3xl" aria-label="내 계정 정보">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <span className="badge shrink-0">{memberLabel(me)}</span>
          <h2 className="shrink-0 text-xl font-bold">{me.name}</h2>
          <p className="min-w-0 truncate text-slate-600" title={`로그인 이메일 · ${me.email}`}>로그인 이메일 · {me.email}</p>
        </div>
        <AccountInfo profile={await getAccountProfile()} />
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
