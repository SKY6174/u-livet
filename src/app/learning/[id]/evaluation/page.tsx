import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { dateTime } from "@/lib/portal/data";
import type { ExamRoom } from "@/lib/portal/evaluation";
import { getAttendanceBook } from "@/lib/attendance/data";
import { attendanceIndex, attendanceState } from "@/lib/attendance/model";
import { PageIntro, Empty } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import { startQuiz, answerQuiz } from "@/app/evaluation-actions";
export default async function Evaluation({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { book } = await getAttendanceBook(id, "learner");
  if (!book) return <div className="page-shell"><Empty title="학습 현황을 불러오지 못했습니다" /></div>;
  const exams = await (await createServerSupabaseClient()).rpc("life_exam_room", { f: id });
  if (exams.error) return <div className="page-shell"><Empty title="시험 정보를 불러오지 못했습니다" /></div>;
  const recorded = attendanceIndex(book.attendance);
  const room = exams.data as ExamRoom;
  return (
    <div className="page-shell">
      <PageIntro eyebrow="ATTENDANCE & EXAMS" title="출결·시험">
        공식 출결은 강사가 확인한 출석시간으로 기록됩니다. 시험 중에는 임시저장
        후 다시 접속할 수 있습니다.
      </PageIntro>
      <Link className="btn-primary mb-6 mr-3" href={`/learning/${id}/attendance`}>나의 출석 요약·상세 →</Link>
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <section>
          <h2 className="section-title">나의 출결</h2>
          <div className="space-y-4">
            {!book.sessions.length && (
              <Empty title="수업 일정이 준비 중입니다" />
            )}
            {book.sessions.map((s) => {
              const a = recorded.get(`${s.id}:${book.viewer_id}`);
              const minutes = Math.round(
                (Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 60000,
              );
              return (
                <article className="panel" key={s.id}>
                  <h3 className="font-semibold">
                    {s.title}{" "}
                    {s.replaces_id && <span className="badge">보강</span>}
                  </h3>
                  <p className="my-2 text-sm text-slate-500">
                    {dateTime(s.starts_at)} · {minutes}분
                  </p>
                  {s.status === "CANCELLED" ? (
                    <p>휴강 · {s.reason}</p>
                  ) : a ? (
                    <p className="text-teal-800">
                      출석 인정 {a.credited_minutes} / {minutes}분 · {a.reason}
                    </p>
                  ) : (
                    <p>{attendanceState(s, a, Date.parse(book.generated_at))}</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
        <section>
          <h2 className="section-title">시험</h2>
          <div className="space-y-4">
            {!room.quizzes.length && <Empty title="등록된 시험이 없습니다" />}
            {room.quizzes.map((q) => {
              const a = room.attempts.find((a) => a.quiz_id === q.id);
              const active =
                Date.now() >= Date.parse(q.opens_at) &&
                Date.now() < Date.parse(q.closes_at);
              return (
                <article key={q.id} className="panel">
                  <h3 className="text-lg font-semibold">{q.title}</h3>
                  <p className="my-3 text-sm text-slate-500">
                    {dateTime(q.opens_at)} ~ {dateTime(q.closes_at)}
                    <br />
                    제한 {q.duration_minutes}분 · 1회 응시 · 문항별 동일 배점
                  </p>
                  {!a ? (
                    <ActionForm
                      action={startQuiz}
                      label="시험 시작"
                      disabled={!active}
                    >
                      <input type="hidden" name="quiz" value={q.id} />
                      <p className="text-sm">
                        시작하면 제한시간이 흐르며 응시 마감시각에 함께
                        종료됩니다.
                      </p>
                    </ActionForm>
                  ) : a.status === "OPEN" ? (
                    <ActionForm action={answerQuiz} label="답안 저장">
                      <input type="hidden" name="attempt" value={a.id} />
                      <input
                        type="hidden"
                        name="count"
                        value={a.questions.length}
                      />
                      <p className="notice">
                        제출 종료: {dateTime(a.expires_at)}. 시간이 지나면 추가
                        답안은 저장되지 않습니다.
                      </p>
                      {a.questions.map((question, i) => (
                        <fieldset
                          key={i}
                          className="space-y-3 rounded-xl border p-4"
                        >
                          <legend className="px-2 font-semibold">
                            {i + 1}. {question.text}
                          </legend>
                          {question.options.map((option, j) => (
                            <label key={j} className="flex items-start gap-3">
                              <input
                                className="mt-1"
                                type="radio"
                                name={`answer${i}`}
                                value={j}
                                defaultChecked={a.answers[i] === j}
                              />
                              <span>{option}</span>
                            </label>
                          ))}
                        </fieldset>
                      ))}
                      <label className="field">
                        저장 방식
                        <select name="finalize" defaultValue="false">
                          <option value="false">임시저장 (계속 응시)</option>
                          <option value="true">최종 제출 (수정 불가)</option>
                        </select>
                      </label>
                    </ActionForm>
                  ) : (
                    <div className="notice">
                      <strong>
                        {a.status === "EXPIRED"
                          ? "응시시간 종료 · 사업단 검토 필요"
                          : "제출 완료"}
                      </strong>
                      <p>
                        {a.score === null
                          ? "점수는 시험 응시기간 종료 후 공개됩니다."
                          : `${a.score}점`}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
