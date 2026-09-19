import Link from "next/link";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { dateTime } from "@/lib/portal/data";
import { PageIntro, Empty } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import { requestCertificate } from "@/app/certificate-actions";
import {
  kindLabel,
  certificateState,
  type CertificateRequest,
} from "@/lib/certificates/types";
import type { HistoryRow } from "@/lib/portal/evaluation";
export default async function Certificates() {
  const me = await requireIdentity("/mypage/certificates");
  const db = await createServerSupabaseClient();
  const [list, history, teaching] = await Promise.all([
    db.rpc("life_certificate_list"),
    db.rpc("life_completion_history"),
    db.rpc("life_teaching_records"),
  ]);
  if ([list, history, teaching].some((x) => x.error))
    return (
      <div className="page-shell">
        <Empty title="증명 신청 정보를 불러오지 못했습니다" />
      </div>
    );
  const rows = (list.data as CertificateRequest[]).filter(
    (r) => r.person_id === me.id,
  );
  const completed = (history.data as HistoryRow[]).filter(
    (r) => r.approved_at && !r.stale,
  );
  const teachingCourses = Array.from(
    new Map(
      (
        teaching.data as {
          offering_id: string;
          course_name: string;
          person_id: string;
          current: boolean;
        }[]
      )
        .filter((r) => r.person_id === me.id && r.current)
        .map((r) => [r.offering_id, r]),
    ).values(),
  );
  const options = [
    ...completed.map((c) => ({
      id: c.offering_id,
      name: c.name,
      kind: "COMPLETION",
    })),
    ...teachingCourses.map((o) => ({
      id: o.offering_id,
      name: o.course_name,
      kind: "TEACHING",
    })),
  ];
  return (
    <div className="page-shell">
      <PageIntro eyebrow="MY CERTIFICATES" title="증명 신청·발급">
        현재 승인된 수료 또는 실제 강의실적으로 신청합니다. PDF가 완성되면
        원본을 다운로드할 수 있습니다.
      </PageIntro>
      <section className="mb-10">
        <h2 className="section-title">신청 가능한 증명</h2>
        {!options.length ? (
          <Empty title="확정된 수료·강의실적이 없습니다" />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {options.map((o) => (
              <article key={o.id + o.kind} className="panel">
                <h3 className="font-semibold">{o.name}</h3>
                <p className="my-3 text-sm">{kindLabel[o.kind]}</p>
                <ActionForm action={requestCertificate} label="발급 신청">
                  <input type="hidden" name="offering" value={o.id} />
                  <input type="hidden" name="kind" value={o.kind} />
                  <p className="text-sm text-slate-500">
                    같은 건의 재신청은 기존 신청 상태를 보여줍니다.
                  </p>
                </ActionForm>
              </article>
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="section-title">나의 신청·발급 이력</h2>
        <div className="space-y-4">
          {rows.map((r) => (
            <article className="panel" key={r.id}>
              <span className="badge">
                {certificateState[r.state ?? r.status]}
              </span>
              <h3 className="mt-3 text-lg font-semibold">
                {r.course_name} · {kindLabel[r.kind]}
              </h3>
              <p className="my-3 text-sm">
                신청 {dateTime(r.requested_at)} {r.number && `· ${r.number}`}
              </p>
              {r.last_error && <p className="notice mb-3">{r.last_error}</p>}
              {r.issue_id ? (
                <Link
                  className="btn-secondary"
                  href={`/certificate/${r.issue_id}`}
                >
                  상세·다운로드
                </Link>
              ) : (
                <p className="text-sm text-slate-500">
                  사업단의 발급권·서식 확인과 승인을 기다리고 있습니다.
                </p>
              )}
            </article>
          ))}
          {!rows.length && <Empty title="신청한 증명이 없습니다" />}
        </div>
      </section>
    </div>
  );
}
