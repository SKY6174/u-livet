import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOfferings, dateTime } from "@/lib/portal/data";
import { PageIntro, Empty } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import {
  approveTeaching,
  approveCertificate,
  retryCertificate,
  revokeCertificate,
} from "@/app/certificate-actions";
import {
  kindLabel,
  certificateState,
  type CertificateOptions,
  type CertificateRequest,
  type TeachingRecord,
} from "@/lib/certificates/types";
export default async function Credentials() {
  const me = await requireIdentity("/credentials");
  if (!me.roles.some((r) => ["COURSE_MANAGER", "CERTIFIER"].includes(r.role)))
    notFound();
  const db = await createServerSupabaseClient();
  const [records, requests, options, { offerings }] = await Promise.all([
    db.rpc("life_teaching_records"),
    db.rpc("life_certificate_list"),
    db.rpc("life_certificate_options"),
    getOfferings(),
  ]);
  if ([records, requests, options].some((x) => x.error))
    return (
      <div className="page-shell">
        <Empty title="증명 관리 정보를 불러오지 못했습니다" />
      </div>
    );
  const config = options.data as CertificateOptions;
  const logs = (records.data as TeachingRecord[]).filter((l) =>
    me.roles.some(
      (r) =>
        r.role === "COURSE_MANAGER" &&
        r.org_id === offerings.find((o) => o.id === l.offering_id)?.org_id,
    ),
  );
  const rows = requests.data as CertificateRequest[];
  return (
    <div className="page-shell">
      <PageIntro eyebrow="CREDENTIAL OPERATIONS" title="강의실적·증명 관리">
        실제 강의실적을 확인하고, 승인된 발급권과 서식으로 증명을 발급합니다.
        증명승인 역할 외에 별도 발급 위임이 필요합니다.
      </PageIntro>
      <Link className="btn-secondary mb-6" href="/credentials/badges">
        디지털배지 정의·발급 관리 →
      </Link>
      {!config.issuers.length && (
        <p className="notice mb-8">
          현재 사용할 수 있는 발급권이 없습니다. 기관 승인문서·사업단장
          명의·직인 또는 생략 근거·발급 위임을 먼저 등록해야 합니다.
        </p>
      )}
      <section className="mb-10">
        <h2 className="section-title">강의실적 확인</h2>
        <div className="space-y-4">
          {logs.map((l) => (
            <article className="panel" key={l.id}>
              <span className="badge">
                {l.current ? "승인 완료" : "검토 필요"}
              </span>
              <h3 className="my-3 font-semibold">
                {l.person_name} · {l.course_name} · {l.session_title}
              </h3>
              <p className="text-sm">
                {dateTime(l.starts_at)} · 실제 {l.minutes}분
              </p>
              <p className="my-4 whitespace-pre-wrap text-sm">{l.notes}</p>
              {!l.current && (
                <ActionForm
                  action={approveTeaching}
                  label="실제 강의실적 승인"
                  disabled={l.person_id === me.id}
                >
                  <input type="hidden" name="log" value={l.id} />
                  <input type="hidden" name="revision" value={l.revision} />
                </ActionForm>
              )}
            </article>
          ))}
          {!logs.length && <Empty title="확인할 강의실적이 없습니다" />}
        </div>
      </section>
      <section>
        <h2 className="section-title">증명 발급 요청</h2>
        <div className="space-y-5">
          {rows.map((r) => {
            const org = r.org_id;
            const issuers = config.issuers.filter(
              (i) => i.org_id === org && i.kinds.includes(r.kind),
            );
            const templates = config.templates.filter(
              (t) => t.org_id === org && t.kind === r.kind,
            );
            return (
              <article className="panel" key={r.id}>
                <span className="badge">
                  {certificateState[r.state ?? r.status]}
                </span>
                <h3 className="my-3 text-lg font-semibold">
                  {r.person_name} · {kindLabel[r.kind]}
                </h3>
                <p className="mb-4 text-sm">
                  {r.course_name} · {dateTime(r.requested_at)}
                </p>
                <p className="notice mb-4">
                  현재 확정 근거:{" "}
                  {r.evidence
                    ? r.evidence.evidence.minutes == null
                      ? "수료 사실 확인 · 시간 미기재"
                      : `${r.evidence.evidence.minutes}분 확인`
                    : "근거 없음 또는 변경됨"}
                </p>
                {r.evidence?.evidence.logs && (
                  <ul className="mb-4 text-sm">
                    {r.evidence.evidence.logs.map((l, i) => (
                      <li key={i}>
                        {l.title} · 실제 {l.minutes}분
                      </li>
                    ))}
                  </ul>
                )}
                {r.reason && (
                  <p className="notice mb-3">정정 사유: {r.reason}</p>
                )}
                {r.issue_id ? (
                  <div className="space-y-4">
                    <Link
                      className="text-teal-800 underline"
                      href={`/certificate/${r.issue_id}`}
                    >
                      {r.number} · 근거·원본 확인
                    </Link>
                    {r.last_error && <p className="notice">{r.last_error}</p>}
                    {r.status === "GENERATING" && (
                      <ActionForm
                        action={retryCertificate}
                        label="PDF 생성 재시도"
                      >
                        <input type="hidden" name="issue" value={r.issue_id} />
                      </ActionForm>
                    )}
                    {["ISSUED", "GENERATING"].includes(r.status) &&
                      r.state !== "SUPERSEDED" && (
                        <details>
                          <summary className="cursor-pointer text-sm">
                            발급 취소
                          </summary>
                          <ActionForm
                            action={revokeCertificate}
                            label="취소 기록"
                          >
                            <input
                              type="hidden"
                              name="issue"
                              value={r.issue_id}
                            />
                            <label className="field">
                              취소 사유
                              <input name="reason" maxLength={1000} required />
                            </label>
                          </ActionForm>
                        </details>
                      )}
                  </div>
                ) : (
                  <ActionForm
                    action={approveCertificate}
                    label="승인·PDF 생성"
                    disabled={
                      !issuers.length ||
                      !templates.length ||
                      r.person_id === me.id
                    }
                  >
                    <input type="hidden" name="request" value={r.id} />
                    <label className="field">
                      발급권
                      <select name="issuer" defaultValue="" required>
                        <option value="" disabled>
                          승인된 발급권 선택
                        </option>
                        {issuers.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.test_only ? "[검증용] " : ""}
                            {i.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      승인 서식
                      <select name="template" defaultValue="" required>
                        <option value="" disabled>
                          서식 선택
                        </option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title} · {t.version}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex gap-3 text-sm">
                      <input type="checkbox" name="reviewed" required />
                      현재 확정 근거·발급 위임·서식 적용을 확인했습니다.
                    </label>
                  </ActionForm>
                )}
              </article>
            );
          })}
          {!rows.length && <Empty title="발급 요청이 없습니다" />}
        </div>
      </section>
    </div>
  );
}
