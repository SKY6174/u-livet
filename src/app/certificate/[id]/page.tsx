import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID, dateTime } from "@/lib/portal/data";
import { PageIntro } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import { requestCertificate } from "@/app/certificate-actions";
import {
  certificateState,
  type CertificateDetail,
} from "@/lib/certificates/types";
export default async function Certificate({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireIdentity(`/certificate/${id}`);
  if (!UUID.test(id)) notFound();
  const { data, error } = await (
    await createServerSupabaseClient()
  ).rpc("life_certificate_detail", { i: id });
  if (error || !data) notFound();
  const c = data as CertificateDetail;
  const s = c.snapshot;
  return (
    <div className="page-shell">
      <Link className="text-sm text-teal-800" href="/mypage/certificates">
        ← 나의 증명 이력
      </Link>
      <PageIntro eyebrow="CERTIFICATE" title={s.template.title}>
        {c.number} · {certificateState[c.state]}
      </PageIntro>
      {s.issuer.test_only && (
        <p className="notice mb-6">
          검증용 문서입니다. 실제 사업단 증명으로 사용할 수 없습니다.
        </p>
      )}
      <section className="panel max-w-3xl">
        <dl className="grid grid-cols-[7rem_1fr] gap-4">
          <dt>성명</dt>
          <dd>{s.person_name}</dd>
          <dt>과정</dt>
          <dd>{s.course_name}</dd>
          <dt>교육기간</dt>
          <dd>
            {s.starts_on} ~ {s.ends_on}
          </dd>
          <dt>확인 시간</dt>
          <dd>
            {s.evidence.minutes == null
              ? "시간 미기재"
              : `${s.evidence.minutes}분`}
          </dd>
          <dt>발급 명의</dt>
          <dd>
            {s.issuer.organization_name}
            <br />
            {s.issuer.title} {s.issuer.holder_name}
          </dd>
          <dt>발급일</dt>
          <dd>{c.issued_at ? dateTime(c.issued_at) : "원본 생성 대기"}</dd>
        </dl>
        <p className="my-6 whitespace-pre-wrap">{s.template.body}</p>
        {c.state === "ISSUED" ? (
          <a className="btn-primary" href={`/api/certificates/${id}/download`}>
            PDF 원본 다운로드
          </a>
        ) : (
          <p className="notice">
            {c.last_error ??
              "현재 유효한 원본이 아니므로 다운로드가 제한됩니다."}
          </p>
        )}
        {c.sha256 && (
          <p className="mt-5 break-all text-xs text-slate-500">
            원본 SHA-256: {c.sha256}
          </p>
        )}
        {c.revocation_reason && (
          <p className="mt-4 text-sm">취소 사유: {c.revocation_reason}</p>
        )}
      </section>
      {["STALE", "REVOKED"].includes(c.state) &&
        c.request.person_id === me.id && (
          <section className="panel mt-6 max-w-3xl">
            <h2 className="section-title">정정본 신청</h2>
            <ActionForm action={requestCertificate} label="정정본 발급 신청">
              <input
                type="hidden"
                name="offering"
                value={c.request.offering_id}
              />
              <input type="hidden" name="kind" value={c.request.kind} />
              <input type="hidden" name="supersedes" value={c.id} />
              <label className="field">
                정정·재발급 사유
                <textarea name="reason" maxLength={1000} required />
              </label>
              <p className="text-sm">
                근거를 다시 확정한 후 신청하세요. 새 원본 발급이 완료되면 이전
                원본은 대체 이력으로 남습니다.
              </p>
            </ActionForm>
          </section>
        )}
    </div>
  );
}
