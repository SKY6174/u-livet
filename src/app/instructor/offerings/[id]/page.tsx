import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOffering, dateTime } from "@/lib/portal/data";
import { createContent, gradeSubmission } from "@/app/actions";
import { ActionForm } from "@/components/portal/action-form";
import { PageIntro, Empty } from "@/components/portal/ui";
import type {
  RosterRow,
  Assignment,
  Submission,
  Grade,
} from "@/lib/portal/types";
export default async function Teaching(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const me = await requireIdentity("/instructor");
  const o = await getOffering(params.id);
  if (!o) notFound();
  const db = await createServerSupabaseClient();
  const assigned = await db
    .from("life_offering_instructors")
    .select("*")
    .eq("offering_id", o.id)
    .eq("person_id", me.id)
    .maybeSingle();
  if (
    !assigned.data ||
    (assigned.data.valid_until &&
      Date.parse(assigned.data.valid_until) <= Date.now())
  )
    notFound();
  const [roster, assignments, lessons, submissions, grades] = await Promise.all(
    [
      db.rpc("life_roster", { f: o.id }),
      db.from("life_assignments").select("*").eq("offering_id", o.id),
      db
        .from("life_lessons")
        .select("*")
        .eq("offering_id", o.id)
        .order("position"),
      db.from("life_submissions").select("*"),
      db.from("life_submission_grades").select("*"),
    ],
  );
  if ([roster, assignments, lessons, submissions, grades].some((r) => r.error))
    return (
      <div className="page-shell">
        <Empty title="강의 운영 정보를 불러오지 못했습니다" />
      </div>
    );
  const members = (roster.data ?? []) as RosterRow[];
  const tasks = (assignments.data ?? []) as Assignment[];
  return (
    <div className="page-shell">
      <Link className="text-sm text-teal-800" href="/instructor">← My Room</Link>
      <PageIntro eyebrow="TEACHING ROOM" title={o.name}>
        배정된 수강생의 학습과 과제를 확인하세요.
      </PageIntro>
      <Link
        href={`/instructor/offerings/${o.id}/evaluation`}
        className="btn-secondary mb-6"
      >
        출결·시험 {"관리"} →
      </Link>
      <Link className="btn-primary mb-6 mr-3" href={`/instructor/offerings/${o.id}/attendance`}>출석부 생성·관리 →</Link>
      <Link className="btn-secondary mb-6 mr-3" href={`/instructor/offerings/${o.id}/completion`}>이수 확인 →</Link>
      <Link className="btn-secondary mb-6" href={`/quality/${o.id}`}>만족도 조사 →</Link>
      <p className="notice mb-6">교내·외 강사는 수업 일정·학습자료·평가를 준비하고 사업단(센터)과 함께 홍보합니다. 수강 확정 인원을 확인한 뒤 최종 개설 여부를 사업단에 확인해 주세요.</p>
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <section className="space-y-6">
          <div className="panel">
            <h2 className="section-title">
              수강 확정 명단 · {members.length}명
            </h2>
            {members.length ? (
              <ul className="divide-y">
                {members.map((m) => (
                  <li key={m.person_id} className="py-3">
                    {m.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p>수강 확정된 학습자가 없습니다.</p>
            )}
          </div>
          <div className="panel">
            <h2 className="section-title">
              학습자료 · {lessons.data?.length ?? 0}개
            </h2>
            {lessons.data?.map((l) => (
              <p key={l.id} className="py-2">
                {l.position}. {l.title}
              </p>
            ))}
            <details className="mt-4">
              <summary className="cursor-pointer font-semibold text-teal-800">
                학습자료 추가
              </summary>
              <div className="mt-4">
                <ActionForm action={createContent} label="자료 공개">
                  <input type="hidden" name="offering" value={o.id} />
                  <input type="hidden" name="kind" value="LESSON" />
                  <label className="field">
                    차시 순서
                    <input type="number" name="position" min={1} required />
                  </label>
                  <label className="field">
                    제목
                    <input name="title" maxLength={200} required />
                  </label>
                  <label className="field">
                    학습자료 본문
                    <textarea name="body" rows={7} maxLength={30000} required />
                  </label>
                </ActionForm>
              </div>
            </details>
          </div>
          <div className="panel">
            <details>
              <summary className="cursor-pointer font-semibold text-teal-800">
                새 과제 등록
              </summary>
              <div className="mt-4">
                <ActionForm action={createContent} label="과제 공개">
                  <input type="hidden" name="offering" value={o.id} />
                  <input type="hidden" name="kind" value="ASSIGNMENT" />
                  <label className="field">
                    제목
                    <input name="title" maxLength={200} required />
                  </label>
                  <label className="field">
                    과제 안내
                    <textarea name="body" rows={5} maxLength={20000} required />
                  </label>
                  <label className="field">
                    제출 기한 (한국시간)
                    <input type="datetime-local" name="due_at" required />
                  </label>
                </ActionForm>
              </div>
            </details>
          </div>
        </section>
        <section>
          <h2 className="section-title">과제별 제출·채점</h2>
          {!tasks.length && <Empty title="등록된 과제가 없습니다" />}
          <div className="space-y-5">
            {tasks.map((a) => (
              <article key={a.id} className="panel">
                <h3 className="text-lg font-bold">{a.title}</h3>
                <p className="mb-4 text-sm text-slate-500">
                  마감 {dateTime(a.due_at)}
                </p>
                {!(submissions.data as Submission[]).some(
                  (s) => s.assignment_id === a.id,
                ) && <p className="notice">아직 제출물이 없습니다.</p>}
                {(submissions.data as Submission[])
                  .filter((s) => s.assignment_id === a.id)
                  .map((s) => {
                    const g = (grades.data as Grade[]).find(
                      (g) => g.submission_id === s.id,
                    );
                    return (
                      <div
                        key={`${s.id}-${s.revision}`}
                        className="mt-5 border-t pt-5"
                      >
                        <p className="font-semibold">
                          {members.find((m) => m.person_id === s.person_id)
                            ?.name ?? "학습자"}{" "}
                          · 제출 버전 {s.revision}
                        </p>
                        <p className="my-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-4">
                          {s.body}
                        </p>
                        <ActionForm
                          action={gradeSubmission}
                          label="점수·피드백 저장"
                        >
                          <input type="hidden" name="submission" value={s.id} />
                          <input
                            type="hidden"
                            name="revision"
                            value={s.revision}
                          />
                          <label className="field">
                            점수 (100점 만점)
                            <input
                              name="score"
                              type="number"
                              min={0}
                              max={100}
                              step="0.01"
                              required
                              defaultValue={g?.score ?? ""}
                            />
                          </label>
                          <label className="field">
                            피드백
                            <textarea
                              name="feedback"
                              rows={3}
                              maxLength={5000}
                              defaultValue={g?.feedback ?? ""}
                            />
                          </label>
                        </ActionForm>
                      </div>
                    );
                  })}
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
