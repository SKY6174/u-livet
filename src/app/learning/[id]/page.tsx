import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOffering, dateTime } from "@/lib/portal/data";
import type { Lesson, Assignment, Submission, Grade } from "@/lib/portal/types";
import { ActionForm } from "@/components/portal/action-form";
import { readLesson, submitAssignment } from "@/app/actions";
import { Empty, PageIntro } from "@/components/portal/ui";
export default async function Classroom(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const me = await requireIdentity(`/learning/${params.id}`);
  const db = await createServerSupabaseClient();
  const o = await getOffering(params.id);
  if (!o) notFound();
  const enrollment = await db
    .from("life_enrollments")
    .select("id")
    .eq("offering_id", o.id)
    .eq("person_id", me.id)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (!enrollment.data) notFound();
  const [lessons, reads, assignments, submissions, grades] = await Promise.all([
    db
      .from("life_lessons")
      .select("*")
      .eq("offering_id", o.id)
      .eq("published", true)
      .order("position"),
    db.from("life_lesson_reads").select("lesson_id").eq("person_id", me.id),
    db
      .from("life_assignments")
      .select("*")
      .eq("offering_id", o.id)
      .eq("published", true)
      .order("due_at"),
    db.from("life_submissions").select("*").eq("person_id", me.id),
    db.from("life_submission_grades").select("*"),
  ]);
  if ([lessons, reads, assignments, submissions, grades].some((r) => r.error))
    return (
      <div className="page-shell">
        <Empty title="강의실을 불러오지 못했습니다">
          잠시 후 다시 시도해 주세요.
        </Empty>
      </div>
    );
  return (
    <div className="page-shell">
      <PageIntro eyebrow="MY CLASSROOM" title={o.name}>
        학습자료를 읽고 과제를 제출하세요. 자료 열람 표시는 출석 인정이나 수료
        확정과 별도로 관리됩니다.
      </PageIntro>
      <Link
        href={`/learning/${o.id}/evaluation`}
        className="btn-secondary mb-6"
      >
        출결·시험 {"확인"} →
      </Link>
      <Link className="btn-primary mb-6 mr-3" href={`/learning/${o.id}/attendance`}>나의 출석 확인 →</Link>
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <section>
          <h2 className="section-title">학습자료</h2>
          <div className="space-y-4">
            {!(lessons.data ?? []).length && (
              <Empty title="학습자료가 준비 중입니다" />
            )}
            {((lessons.data as Lesson[]) ?? []).map((l) => (
              <details key={l.id} className="panel" open>
                <summary className="cursor-pointer font-semibold">
                  {l.position}. {l.title}{" "}
                  {reads.data?.some((r) => r.lesson_id === l.id) && (
                    <span className="badge ml-2">읽음</span>
                  )}
                </summary>
                <p className="my-5 whitespace-pre-wrap">{l.content}</p>
                <ActionForm action={readLesson} label="읽음으로 표시">
                  <input type="hidden" name="lesson" value={l.id} />
                </ActionForm>
              </details>
            ))}
          </div>
        </section>
        <section>
          <h2 className="section-title">과제와 피드백</h2>
          <div className="space-y-4">
            {!(assignments.data ?? []).length && (
              <Empty title="등록된 과제가 없습니다" />
            )}
            {((assignments.data as Assignment[]) ?? []).map((a) => {
              const s = ((submissions.data as Submission[]) ?? []).find(
                (s) => s.assignment_id === a.id,
              );
              const g = ((grades.data as Grade[]) ?? []).find(
                (g) => g.submission_id === s?.id,
              );
              const closed = Date.now() > Date.parse(a.due_at);
              return (
                <article key={a.id} className="panel">
                  <h3 className="text-lg font-semibold">{a.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    제출 기한 {dateTime(a.due_at)}
                  </p>
                  <p className="my-5 whitespace-pre-wrap">{a.instructions}</p>
                  {s && (
                    <p className="mb-4 text-sm text-teal-800">
                      제출 완료 · {dateTime(s.submitted_at)} · 버전 {s.revision}
                    </p>
                  )}
                  {g && (
                    <div className="notice mb-4">
                      <strong>{g.score}점</strong>
                      <p className="whitespace-pre-wrap">{g.feedback}</p>
                    </div>
                  )}
                  <ActionForm
                    action={submitAssignment}
                    label={s ? "과제 수정 제출" : "과제 제출"}
                    disabled={closed}
                  >
                    <input type="hidden" name="assignment" value={a.id} />
                    <label className="field">
                      제출 내용
                      <textarea
                        name="body"
                        rows={6}
                        defaultValue={s?.body ?? ""}
                        maxLength={20000}
                        required
                        disabled={closed}
                      />
                    </label>
                    {closed && (
                      <p className="text-sm">제출 기한이 지났습니다.</p>
                    )}
                  </ActionForm>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
