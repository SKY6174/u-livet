import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/workspace-navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageIntro, Empty } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import { reviewLearningRequest } from "@/app/learning-request-actions";
import { requestLabels } from "@/lib/student-learning/model";
import type { LearningRequest } from "@/lib/student-learning/types";
import { dateTime } from "@/lib/portal/data";
export default async function CourseRequests() {
  const me = await requireIdentity("/admin/course-requests");
  if (!hasRole(me, "COURSE_MANAGER")) notFound();
  const orgs = me.roles
    .filter((r) => r.role === "COURSE_MANAGER")
    .map((r) => r.org_id);
  const { data, error } = await (
    await createServerSupabaseClient()
  )
    .from("life_learning_requests")
    .select(
      "id,org_id,title,goal,preferred_schedule,status,response,created_at,updated_at",
    )
    .in("org_id", orgs)
    .order("created_at", { ascending: false });
  const requests = (data ?? []) as LearningRequest[];
  return (
    <div className="page-shell">
      <Link className="text-sm text-teal-800" href="/admin">
        ← 사업단 관리
      </Link>
      <PageIntro eyebrow="LEARNER VOICE" title="희망 과목 제안·검토">
        수강생의 학습 수요를 확인하고 검토 결과를 안내합니다.
      </PageIntro>
      {error ? (
        <Empty title="제안 내역을 불러오지 못했습니다" />
      ) : !requests.length ? (
        <Empty title="접수된 제안이 없습니다" />
      ) : (
        <div className="space-y-5">
          {requests.map((r) => (
            <article key={r.id} className="panel">
              <span className="badge">{requestLabels[r.status]}</span>
              <h2 className="mt-3 text-xl font-bold">{r.title}</h2>
              <p className="mt-2 text-xs text-slate-500">
                접수 {dateTime(r.created_at)}
              </p>
              <p className="my-4 whitespace-pre-wrap">{r.goal}</p>
              <p className="mb-5 text-sm text-slate-600">
                희망 시간: {r.preferred_schedule || "미지정"}
              </p>
              <ActionForm
                action={reviewLearningRequest}
                label="검토 결과 저장"
                resetOnSuccess={false}
              >
                <input type="hidden" name="request" value={r.id} />
                <label className="field">
                  검토 상태
                  <select
                    name="status"
                    defaultValue={
                      r.status === "SUBMITTED" ? "REVIEWING" : r.status
                    }
                  >
                    {["REVIEWING", "PLANNED", "NOT_PLANNED"].map((s) => (
                      <option key={s} value={s}>
                        {requestLabels[s as keyof typeof requestLabels]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  수강생에게 안내할 답변
                  <textarea
                    name="reply"
                    rows={3}
                    required
                    maxLength={2000}
                    defaultValue={r.response}
                  />
                </label>
              </ActionForm>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
