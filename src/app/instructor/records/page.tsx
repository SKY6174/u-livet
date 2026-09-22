import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWorkspaceOfferings, dateTime } from "@/lib/portal/data";
import { PageIntro, Empty } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import { submitTeaching } from "@/app/certificate-actions";
import { TeachingSegmentsInput } from "@/components/teaching/teaching-segments-input";
import { TeachingSignatureForm } from "@/components/teaching/teaching-signature-form";
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
  const logs = ((records.data ?? []) as TeachingRecord[]).filter(record => record.person_id === me.id);
  return (
    <div className="page-shell">
      <PageIntro eyebrow="TEACHING RECORD" title="실제 강의실적">
        완료된 수업의 실제 강의 구간과 내용을 제출하고 본인 서명을 등록하세요.
        과정담당이 확인한 실적과 서명이 강의날인부에 반영됩니다.
      </PageIntro>
      <Link className="btn-secondary mb-6" href="/mypage/certificates">
        강의경력증명 신청 →
      </Link>
      <section className="mb-8" aria-label="나의 전체 강의이력">
        <h2 className="section-title">나의 전체 강의이력</h2>
        <p className="mb-4 text-sm text-slate-600">담당 배정이 끝난 강좌도 제출한 강의실적을 확인할 수 있습니다. 현재 승인된 본인 실적 {logs.filter(log => log.current).reduce((sum, log) => sum + log.minutes, 0).toLocaleString("ko-KR")}분</p>
        {logs.length ? <div className="grid gap-4 md:grid-cols-2">{logs.map(log => <article className="panel" key={log.id}>
          <span className="badge">{log.current ? "승인 완료" : "승인·재검토 필요"}</span>
          <h3 className="mt-3 font-bold">{log.course_name}</h3><p className="mt-2">{log.session_title} · {log.minutes}분</p>
          <p className="mt-2 text-sm text-slate-600">{dateTime(log.starts_at)} ~ {dateTime(log.ends_at)}</p>
          <p className="mt-2 text-sm text-slate-600">강의날인부 서명: {log.signature && log.signed_revision === log.revision ? "등록 완료" : "미등록"}</p>
        </article>)}</div> : <Empty title="제출한 강의이력이 없습니다" />}
      </section>
      <h2 className="section-title">완료 수업 실적 제출·정정</h2>
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
                  resetOnSuccess={false}
                >
                  <input type="hidden" name="session" value={s.id} />
                  <input
                    type="hidden"
                    name="revision"
                    value={l?.revision ?? 0}
                  />
                  <TeachingSegmentsInput startsAt={s.starts_at} endsAt={s.ends_at} saved={l?.segments ?? []} />
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
                {l && (l.segments?.length ?? 0) > 0 && <div className="mt-5 border-t pt-5">
                  <TeachingSignatureForm log={l.id} revision={l.revision} existing={l.signature && l.signed_revision === l.revision ? l.signature : null} />
                </div>}
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
