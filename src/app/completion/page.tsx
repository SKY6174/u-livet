import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpenCheck, DatabaseZap } from "lucide-react";
import { PageIntro } from "@/components/portal/ui";
import { requireIdentity } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/workspace-navigation";
import { mergeCompletionOfferings, type CompletionCourse } from "@/lib/completion/offerings";
import { getWorkspaceOfferings, statusLabel } from "@/lib/portal/data";

export default async function CompletionIndex() {
  const me = await requireIdentity("/completion");
  const orgs = me.roles
    .filter((role) => ["COURSE_MANAGER", "CERTIFIER"].includes(role.role))
    .map((role) => role.org_id);
  if (!orgs.length) notFound();
  const manager = hasRole(me, "COURSE_MANAGER");
  const { offerings, unavailable } = await getWorkspaceOfferings("org_id", orgs);
  const courses = mergeCompletionOfferings(unavailable ? [] : offerings);
  const registeredCount = courses.filter((course) => course.registered).length;
  const registrationNeeded = courses.length - registeredCount;

  return (
    <div className="page-shell">
      <PageIntro eyebrow="COMPLETION REVIEW" title="수료 검토·승인">
        운영 대상 과정을 모두 확인하고, 과정담당이 자료를 마감한 과정의 출결·평가 근거와 수료 후보를 검토합니다.
      </PageIntro>

      {unavailable && (
        <p role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          현재 DB 등록 상태를 불러오지 못해 2026 운영계획 기준 목록을 표시합니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.
        </p>
      )}

      <section className="mb-8 grid gap-3 sm:grid-cols-3" aria-label="운영 과정 요약">
        {[
          { label: "전체 운영 대상", value: courses.length, icon: BookOpenCheck },
          { label: "수료 검토 가능", value: registeredCount, icon: BookOpenCheck },
          { label: "과정 등록 필요", value: registrationNeeded, icon: DatabaseZap },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="panel flex items-center justify-between gap-4">
            <div><p className="text-sm text-slate-600">{label}</p><p className="mt-1 text-3xl font-bold tabular-nums">{value.toLocaleString("ko-KR")}<span className="ml-1 text-sm font-medium text-slate-500">개</span></p></div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-800"><Icon aria-hidden="true" className="h-5 w-5" /></span>
          </div>
        ))}
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        {courses.map((course) => course.registered ? (
          <Link key={course.id} className="panel group hover:border-teal-700 hover:shadow-md" href={`/completion/${course.id}`}>
            <CourseCard course={course} />
            <p className="mt-4 text-sm font-semibold text-teal-800">기준·출결·평가 검토 →</p>
          </Link>
        ) : (
          <article key={course.id} className="panel border-dashed bg-slate-50/70">
            <CourseCard course={course} />
            {manager && course.sourceId ? (
              <Link className="mt-4 inline-flex text-sm font-semibold text-teal-800" href={`/admin/courses?plan=${course.sourceId}#new-course`}>
                과정 등록 후 수료 검토 시작 →
              </Link>
            ) : (
              <p className="mt-4 text-sm text-slate-500">과정담당이 DB에 등록하면 수료 검토를 시작할 수 있습니다.</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function CourseCard({ course }: { course: CompletionCourse }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="eyebrow">{course.yearLabel}</span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${course.registered ? "bg-teal-50 text-teal-800" : "bg-slate-200 text-slate-600"}`}>
          {course.registered ? statusLabel[course.status ?? ""] ?? "등록 완료" : "과정 등록 필요"}
        </span>
      </div>
      <h2 className="mt-3 text-lg font-semibold text-slate-900">{course.name}</h2>
      <p className="mt-2 text-sm text-slate-500">{course.academy} · {course.startsOn} ~ {course.endsOn} · 정원 {course.capacity ?? "미정"}명</p>
    </>
  );
}
