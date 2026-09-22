import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/workspace-navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCourseWorkspaces } from "@/lib/course-workspace/data";
import { RESULT_STATUS_LABELS, STATUS_LABELS } from "@/lib/operation-documents/model";
import { ReportList } from "@/components/course-workspace/report-list";
import { Empty, PageIntro } from "@/components/portal/ui";

type Kind = "plan" | "result";
type Row = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  responsible: string | null;
  plan_status: keyof typeof STATUS_LABELS | null;
  result_status: keyof typeof STATUS_LABELS | null;
};

export async function DocumentList({ kind, view = "official" }: { kind: Kind; view?: "official" | "evidence" }) {
  const me = await requireIdentity(
    kind === "result" && view === "evidence"
      ? "/operation-documents/result?view=evidence"
      : `/operation-documents/${kind}`,
  );
  const manager = hasRole(me, "COURSE_MANAGER");
  const result = kind === "result";
  const evidence = result && view === "evidence";
  if (evidence && !manager) notFound();
  const documents = evidence ? null : await (await createServerSupabaseClient()).rpc("life_operation_list");
  const legacy = evidence ? await getCourseWorkspaces() : null;
  const courses = (documents?.data ?? []) as Row[];
  const label = result ? "결과보고서" : "운영계획서";

  return (
    <div className="page-shell space-y-8">
      <PageIntro eyebrow="COURSE DOCUMENTS" title={label}>
        {result
          ? "담당자가 예산을 입력·확정하면 책임강사가 운영 결과를 작성하고 서명하여 최종 제출합니다."
          : "책임강사가 운영 내용을 작성하고, 담당자가 예산을 완성해 최종 제출합니다."}
      </PageIntro>
      <nav className="flex flex-wrap gap-3" aria-label="과정 문서 종류">
        {(["plan", "result"] as const).map((entry) => (
          <Link
            key={entry}
            className={entry === kind ? "btn-primary" : "btn-secondary"}
            href={`/operation-documents/${entry}`}
            aria-current={entry === kind ? "page" : undefined}
          >
            {entry === "plan" ? "운영계획서" : "결과보고서"}
          </Link>
        ))}
      </nav>
      {result && manager && <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3" aria-label="결과보고서 자료">
        <Link className={!evidence ? "rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white" : "rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"} href="/operation-documents/result" aria-current={!evidence ? "page" : undefined}>공식 운영결과보고서</Link>
        <Link className={evidence ? "rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white" : "rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"} href="/operation-documents/result?view=evidence" aria-current={evidence ? "page" : undefined}>결과 보고 · 6종 증빙</Link>
      </nav>}
      {!evidence && <section aria-label={result ? "공식 운영결과보고서" : "운영계획서"}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{result ? "공식 운영결과보고서" : "과정별 운영계획서"}</h2>
            <p className="mt-1 text-sm text-slate-600">과정별 작성 상태를 확인하고 양식을 작성·검토합니다.</p>
          </div>
          <a className="btn-secondary" href={result ? "/forms/operation-result.pdf" : "/forms/operation-plan.pdf"} target="_blank" rel="noreferrer">
            원본 양식 보기
          </a>
        </div>
        {documents?.error ? (
          <Empty title="문서 현황을 불러오지 못했습니다">추가 인증 상태를 확인하고 다시 시도해 주세요.</Empty>
        ) : courses.length === 0 ? (
          <Empty title={manager ? "아직 등록된 과정이 없습니다" : "아직 책임 과정이 지정되지 않았습니다"}>
            {manager ? "과정을 등록하면 문서 작성 현황이 표시됩니다." : "운영 담당자가 책임강사를 지정하면 이곳에서 작성할 수 있습니다."}
          </Empty>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {courses.map((course) => {
              const status = course[`${kind}_status`];
              return <article className="panel" key={course.id}>
                <h3 className="text-lg font-bold">{course.name}</h3>
                <p className="mt-2 text-sm text-slate-500">
                  {course.starts_on} ~ {course.ends_on} · 책임강사 {course.responsible || "미지정"}
                </p>
                <Link className="mt-5 flex items-center justify-between rounded-xl border p-4 hover:border-teal-500 hover:bg-teal-50" href={`/operation-documents/${course.id}/${kind}`}>
                  <span className="font-semibold">{label} 작성·검토 →</span>
                  <span className="text-sm text-teal-800">{status ? (result ? RESULT_STATUS_LABELS : STATUS_LABELS)[status] : "작성 시작"}</span>
                </Link>
              </article>;
            })}
          </div>
        )}
      </section>}
      {evidence && <section aria-label="결과 보고 및 6종 증빙">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">결과 보고 · 6종 증빙</h2>
            <p className="mt-1 text-sm text-slate-600">기존 결과 보고의 운영 집계·지급자료·원본 PDF를 검토하고 출력합니다.</p>
          </div>
          <Link className="btn-secondary" href="/admin/reports/preview">6종 보고서 양식 검토</Link>
        </div>
        {legacy?.unavailable ? (
          <Empty title="증빙 현황을 불러오지 못했습니다">잠시 후 다시 확인해 주세요.</Empty>
        ) : (
          <ReportList courses={legacy?.courses ?? []} />
        )}
      </section>}
    </div>
  );
}
