import { ActionForm } from "@/components/portal/action-form";
import { askClassQuestion, answerClassQuestion } from "@/app/class-questions-actions";
import { dateTime } from "@/lib/portal/data";
import type { ClassQuestion } from "@/lib/classroom-questions/types";

export function ClassQuestions({
  offeringId,
  audience,
  questions,
}: {
  offeringId: string;
  audience: "learner" | "instructor";
  questions: ClassQuestion[] | null;
}) {
  const isInstructor = audience === "instructor";
  return (
    <section id="class-questions" className="mt-10 scroll-mt-24" aria-labelledby="class-questions-title">
      <h2 id="class-questions-title" className="section-title">
        {isInstructor ? "수강생 질문·답변" : "강사에게 질문하기"}
      </h2>
      <p className="mb-5 text-sm leading-6 text-slate-600">
        {isInstructor
          ? "담당 수업의 질문을 확인하고 답변해 주세요. 비공개 질문은 작성한 수강생에게만 보입니다."
          : "질문할 때 나와 담당 강사만 볼지, 같은 수업 수강생에게도 공개할지 선택할 수 있습니다."}
      </p>
      {questions === null ? (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          질문을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.
        </p>
      ) : (
        <>
          {!isInstructor && (
            <div className="panel mb-6">
              <h3 className="mb-4 text-lg font-bold">새 질문</h3>
              <ActionForm action={askClassQuestion} label="강사에게 질문 보내기">
                <input type="hidden" name="offering" value={offeringId} />
                <label className="field">
                  질문 내용
                  <textarea name="body" rows={4} maxLength={2000} required />
                </label>
                <fieldset>
                  <legend className="mb-2 font-semibold">공개 범위</legend>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex min-h-11 items-center gap-2">
                      <input type="radio" name="visibility" value="PRIVATE" defaultChecked required />
                      나와 담당 강사만 보기
                    </label>
                    <label className="flex min-h-11 items-center gap-2">
                      <input type="radio" name="visibility" value="COURSE" required />
                      같은 수업에 공개
                    </label>
                  </div>
                </fieldset>
              </ActionForm>
            </div>
          )}
          <div className="space-y-4">
            {questions.length === 0 && (
              <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
                {isInstructor ? "아직 수강생 질문이 없습니다." : "아직 볼 수 있는 질문이 없습니다."}
              </p>
            )}
            {questions.map((question) => <QuestionCard key={question.id} question={question} isInstructor={isInstructor} />)}
          </div>
        </>
      )}
    </section>
  );
}

function QuestionCard({ question, isInstructor }: { question: ClassQuestion; isInstructor: boolean }) {
  return (
    <article className="panel">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-semibold text-teal-800">{question.author_label}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={question.created_at}>{dateTime(question.created_at)}</time>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
          {question.visibility === "PRIVATE" ? "1:1 비공개" : "수업 공개"}
        </span>
      </div>
      <p className="mt-4 whitespace-pre-wrap break-words leading-7">{question.body}</p>
      {question.answer_text ? (
        <div className="mt-5 rounded-xl bg-teal-50 p-4">
          <strong className="text-sm text-teal-900">강사 답변</strong>
          <p className="mt-2 whitespace-pre-wrap break-words leading-7">{question.answer_text}</p>
          {question.answered_at && <time className="mt-2 block text-xs text-slate-500" dateTime={question.answered_at}>{dateTime(question.answered_at)}</time>}
        </div>
      ) : (
        <p className="mt-4 text-sm text-amber-800">답변 대기 중</p>
      )}
      {isInstructor && (
        <details className="mt-5" open={!question.answer_text}>
          <summary className="cursor-pointer font-semibold text-teal-800">
            {question.answer_text ? "답변 수정" : "답변 작성"}
          </summary>
          <div className="mt-4">
            <ActionForm action={answerClassQuestion} label={question.answer_text ? "답변 수정 저장" : "답변 등록"}>
              <input type="hidden" name="question" value={question.id} />
              <label className="field">
                답변 내용
                <textarea name="body" rows={4} maxLength={5000} defaultValue={question.answer_text ?? ""} required />
              </label>
            </ActionForm>
          </div>
        </details>
      )}
    </article>
  );
}
