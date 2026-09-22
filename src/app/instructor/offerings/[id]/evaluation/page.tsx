import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { dateTime } from "@/lib/portal/data";
import type { ExamRoom } from "@/lib/portal/evaluation";
import { getAttendanceBook } from "@/lib/attendance/data";
import { attendanceIndex } from "@/lib/attendance/model";
import { PageIntro, Empty } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import { QuizEditor } from "@/components/portal/quiz-editor";
import {
  scheduleClass,
  cancelClass,
  recordAttendance,
} from "@/app/evaluation-actions";
export default async function TeachingEvaluation({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { book } = await getAttendanceBook(id, "instructor");
  if (!book) return <div className="page-shell"><Empty title="출결 정보를 불러오지 못했습니다" /></div>;
  const exams = await (await createServerSupabaseClient()).rpc("life_exam_room", { f: id });
  if (exams.error) return <div className="page-shell"><Empty title="시험 정보를 불러오지 못했습니다" /></div>;
  const o = book.offering, classes = book.sessions, members = book.members;
  const recorded = attendanceIndex(book.attendance);
  const room = exams.data as ExamRoom;
  return (
    <div className="page-shell">
      <PageIntro eyebrow="TEACHING EVALUATION" title="출결·시험 관리">
        {o.name} · 모든 수업을 등록한 뒤 종료된 수업의 인정 출석시간과 근거를
        기록하세요.
      </PageIntro>
      <div className="notice mb-6">
        입력한 출결은 운영진의 과정별 출석부와 결과보고서에 연결됩니다.{" "}
        <Link
          className="font-semibold text-teal-800 underline"
          href="/instructor/records"
        >
          실제 강의실적 제출 →
        </Link>
      </div>
      <Link className="btn-primary mb-6 mr-3" href={`/instructor/offerings/${id}/attendance`}>전체 출석부·일괄 기록 →</Link>
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <section className="space-y-5">
          <h2 className="section-title">수업 일정과 출결</h2>
          <details className="panel">
            <summary className="cursor-pointer font-semibold text-teal-800">
              수업·보강 등록
            </summary>
            <div className="mt-4">
              <ActionForm action={scheduleClass} label="수업 등록">
                <input type="hidden" name="offering" value={id} />
                <label className="field">
                  수업명
                  <input name="title" maxLength={200} required />
                </label>
                <label className="field">
                  시작 (한국시간)
                  <input type="datetime-local" name="starts_at" required />
                </label>
                <label className="field">
                  종료 (한국시간)
                  <input type="datetime-local" name="ends_at" required />
                </label>
                <label className="field">
                  보강 대상
                  <select name="replaces">
                    <option value="">정규 수업</option>
                    {classes
                      .filter(
                        (s) =>
                          s.status === "CANCELLED" &&
                          !classes.some((c) => c.replaces_id === s.id),
                      )
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                  </select>
                </label>
              </ActionForm>
            </div>
          </details>
          {!classes.length && <Empty title="등록된 수업이 없습니다" />}
          {classes.map((s) => {
            const minutes =
              (Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 60000;
            const ended = Date.now() >= Date.parse(s.ends_at);
            return (
              <details className="panel" key={s.id}>
                <summary className="cursor-pointer font-semibold">
                  {s.title} ·{" "}
                  {s.status === "CANCELLED" ? "휴강" : `${minutes}분`}
                </summary>
                <p className="my-4 text-sm">
                  {dateTime(s.starts_at)} ~ {dateTime(s.ends_at)}
                </p>
                {s.status === "CANCELLED" ? (
                  <p>{s.reason}</p>
                ) : (
                  <div className="space-y-5">
                    {!ended && (
                      <p className="notice">
                        수업 종료 후 출결을 기록할 수 있습니다.
                      </p>
                    )}
                    {members.map((m) => {
                      const a = recorded.get(`${s.id}:${m.person_id}`);
                      return (
                        <div key={m.person_id} className="border-t pt-4">
                          <h4 className="mb-3 font-semibold">
                            {m.name} ·{" "}
                            {a ? `${a.credited_minutes}분 인정` : "미기록"}
                          </h4>
                          <ActionForm
                            action={recordAttendance}
                            label={a ? "출결 정정" : "출결 저장"}
                            disabled={!ended || m.person_id === book.viewer_id}
                          >
                            <input type="hidden" name="session" value={s.id} />
                            <input
                              type="hidden"
                              name="person"
                              value={m.person_id}
                            />
                            <input
                              type="hidden"
                              name="revision"
                              value={a?.revision ?? 0}
                            />
                            <label className="field">
                              인정 출석시간 (분, 결석은 0)
                              <input
                                type="number"
                                name="minutes"
                                min={0}
                                max={minutes}
                                step="0.01"
                                defaultValue={a?.credited_minutes}
                                required
                              />
                            </label>
                            <label className="field">
                              확인 근거·정정 사유
                              <input name="reason" maxLength={1000} required />
                            </label>
                          </ActionForm>
                        </div>
                      );
                    })}
                    <details className="border-t pt-4">
                      <summary className="cursor-pointer">휴강 처리</summary>
                      <ActionForm action={cancelClass} label="휴강 기록">
                        <input type="hidden" name="session" value={s.id} />
                        <label className="field">
                          휴강 사유
                          <input name="reason" maxLength={1000} required />
                        </label>
                      </ActionForm>
                    </details>
                  </div>
                )}
              </details>
            );
          })}
        </section>
        <section className="space-y-5">
          <h2 className="section-title">시험과 응시 현황</h2>
          <details className="panel">
            <summary className="cursor-pointer font-semibold text-teal-800">
              객관식 시험 등록
            </summary>
            <div className="mt-4">
              <QuizEditor offering={id} />
            </div>
          </details>
          {room.quizzes.map((q) => (
            <article key={q.id} className="panel">
              <h3 className="font-semibold">{q.title}</h3>
              <p className="my-3 text-sm">
                마감 {dateTime(q.closes_at)} · 제한 {q.duration_minutes}분
              </p>
              <ul className="divide-y">
                {members.map((m) => {
                  const a = room.attempts.find(
                    (a) => a.quiz_id === q.id && a.person_id === m.person_id,
                  );
                  return (
                    <li key={m.person_id} className="py-2">
                      {m.name} ·{" "}
                      {!a
                        ? "미응시"
                        : a.status === "OPEN"
                          ? "응시 중"
                          : a.status === "EXPIRED"
                            ? "시간 종료"
                            : `제출 · ${a.score ?? "채점 확인"}점`}
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
