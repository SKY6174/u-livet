import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWorkspaceOfferings, dateTime } from "@/lib/portal/data";
import { PageIntro, Empty } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import { submitTeaching } from "@/app/certificate-actions";
import type { TeachingRecord } from "@/lib/certificates/types";
import type { ClassSession } from "@/lib/portal/evaluation";
export default async function Records() {
  const me = await requireIdentity("/instructor/records");
  if (!me.roles.some((r) => r.role === "INSTRUCTOR")) notFound();
  const db = await createServerSupabaseClient();
  const [records, assignments] = await Promise.all([
    db.rpc("life_teaching_records"),
    db
      .from("life_offering_instructors")
      .select("offering_id,valid_until")
      .eq("person_id", me.id),
  ]);
  if (records.error || assignments.error)
    return (
      <div className="page-shell">
        <Empty title="강의실적을 불러오지 못했습니다" />
      </div>
    );
  const ids = (assignments.data ?? [])
    .filter((a) => !a.valid_until || Date.parse(a.valid_until) > Date.now())
    .map((a) => a.offering_id);
  const [sessions, { offerings, unavailable }] = await Promise.all([
    ids.length
    ? db
        .from("life_class_sessions")
        .select("*")
        .in("offering_id", ids)
        .eq("status", "SCHEDULED")
        .lte("ends_at", new Date().toISOString())
        .order("starts_at")
    : { data: [], error: null },
    getWorkspaceOfferings("id", ids),
  ]);
  if (sessions.error || unavailable)
    return (
      <div className="page-shell">
        <Empty title="강의실적을 불러오지 못했습니다" />
      </div>
    );
  const logs = (records.data ?? []) as TeachingRecord[];
  return (
    <div className="page-shell">
      <PageIntro eyebrow="TEACHING RECORD" title="실제 강의실적">
        완료된 수업의 실제 강의시간과 내용을 제출하세요. 과정담당이 별도로
        확인한 실적만 경력증명에 반영됩니다.
      </PageIntro>
      <Link className="btn-secondary mb-6" href="/mypage/certificates">
        강의경력증명 신청 →
      </Link>
      <div className="space-y-5">
        {(sessions.data as (ClassSession & { offering_id: string })[]).map(
          (s) => {
            const l = logs.find(
              (l) => l.session_id === s.id && l.person_id === me.id,
            );
            return (
              <article className="panel" key={s.id}>
                <span className="eyebrow">
                  {offerings.find((o) => o.id === s.offering_id)?.name ??
                    "교육과정"}
                </span>
                <h2 className="my-2 text-lg font-semibold">{s.title}</h2>
                <p className="mb-4 text-sm">
                  {dateTime(s.starts_at)} ·{" "}
                  {l?.current
                    ? "실적 승인 완료"
                    : l
                      ? "승인 또는 재검토 필요"
                      : "미제출"}
                </p>
                <ActionForm
                  action={submitTeaching}
                  label={l ? "실적 정정 제출" : "실적 제출"}
                >
                  <input type="hidden" name="session" value={s.id} />
                  <input
                    type="hidden"
                    name="revision"
                    value={l?.revision ?? 0}
                  />
                  <label className="field">
                    실제 강의시간 (분)
                    <input
                      type="number"
                      name="minutes"
                      min={0.01}
                      max={
                        (Date.parse(s.ends_at) - Date.parse(s.starts_at)) /
                        60000
                      }
                      step="0.01"
                      defaultValue={l?.minutes}
                      required
                    />
                  </label>
                  <label className="field">
                    강의 내용·정정 근거
                    <textarea
                      name="notes"
                      rows={3}
                      maxLength={3000}
                      defaultValue={l?.notes ?? ""}
                      required
                    />
                  </label>
                  {l?.current && (
                    <p className="notice">
                      정정하면 다시 승인을 받아야 하며 기존 경력증명은 재검토
                      대상이 됩니다.
                    </p>
                  )}
                </ActionForm>
              </article>
            );
          },
        )}
        {!sessions.data?.length && (
          <Empty title="기록할 완료 수업이 없습니다" />
        )}
      </div>
    </div>
  );
}
