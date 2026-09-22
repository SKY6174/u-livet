import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import { DocumentPortal } from "@/components/instructor-documents/document-portal";
import Link from "next/link";
import { DocumentPopup } from "@/components/instructor-documents/document-popup";
import { Empty, PageIntro } from "@/components/portal/ui";
import { getManagedInstructorOrganizations } from "@/lib/instructors/organizations";

type DocumentRow = {
  id: string;
  name: string;
  has_id: boolean;
  has_bank: boolean;
  has_resume: boolean;
  has_draft: boolean;
  has_identity_pdf: boolean;
  has_resume_pdf: boolean;
};

export default async function InstructorDocumentAdmin({
  searchParams,
}: {
  searchParams: Promise<{ person?: string; org?: string; document?: string }>;
}) {
  const identity = await requireIdentity("/admin/instructors");
  const { person, org, document } = await searchParams;
  const db = await createServerSupabaseClient();
  if (!person) {
    const { organizations: orgs, unavailable } =
      await getManagedInstructorOrganizations(identity);
    const selected = orgs.find((o) => o.id === org) ?? orgs[0];
    const result = selected
      ? await db.rpc("life_instructor_document_directory", {
          p_org: selected.id,
        })
      : null;
    const rows = (result?.data?.items ?? []) as DocumentRow[];
    return (
      <div className="page-shell">
        <Link
          href={
            selected
              ? `/admin/instructors?org=${selected.id}`
              : "/admin/instructors"
          }
          className="text-sm text-teal-800"
        >
          ← 전문가 관리
        </Link>
        <PageIntro eyebrow="INSTRUCTOR DOCUMENTS" title="강사 서류 제출 현황">
          담당 기관 강사의 비공개 서류를 확인하고 입력합니다.
        </PageIntro>
        <form className="panel mb-6 flex flex-wrap items-end gap-3">
          <label className="field grow">
            담당 기관
            <select name="org" defaultValue={selected?.id}>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-secondary">기관 선택</button>
        </form>
        {unavailable || result?.error || !selected ? (
          <Empty title="담당 기관 서류 현황을 불러오지 못했습니다" />
        ) : !rows.length ? (
          <Empty title="등록된 강사가 없습니다" />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {rows.map((row) => (
                <article className="panel" key={row.id}>
                  <h2 className="text-xl font-bold">{row.name}</h2>
                  <dl className="my-4 grid grid-cols-2 gap-2 text-sm">
                    <dt>신분증</dt>
                    <dd>{row.has_id ? "제출 완료" : "미제출"}</dd>
                    <dt>통장사본</dt>
                    <dd>{row.has_bank ? "제출 완료" : "미제출"}</dd>
                    <dt>이력서</dt>
                    <dd>
                      {row.has_resume
                        ? "제출 완료"
                        : row.has_draft
                          ? "임시저장"
                          : "미제출"}
                      {row.has_resume && row.has_draft ? " · 수정 중" : ""}
                    </dd>
                    <dt>A4 PDF</dt>
                    <dd>
                      {row.has_identity_pdf ? "신분증·통장" : ""}
                      {row.has_identity_pdf && row.has_resume_pdf ? " / " : ""}
                      {row.has_resume_pdf ? "이력서" : ""}
                      {!row.has_identity_pdf && !row.has_resume_pdf
                        ? "미생성"
                        : ""}
                    </dd>
                  </dl>
                  <DocumentPopup
                    className="btn-secondary"
                    href={`/admin/instructors/documents?person=${row.id}&org=${selected.id}`}
                  >
                    서류 확인·입력
                  </DocumentPopup>
                </article>
              ))}
            </div>
            {result?.data?.more && (
              <p className="notice mt-4">
                이름순 200명까지 표시합니다. 추가 강사는 이력 심사 상세에서
                서류함을 열 수 있습니다.
              </p>
            )}
          </>
        )}
      </div>
    );
  }
  if (!person || !org || !UUID.test(person) || !UUID.test(org)) notFound();
  const { data, error } = await db.rpc("life_instructor_document_access", {
    p_person: person,
    p_org: org,
  });
  if (error || !data) notFound();
  return (
    <DocumentPortal
      key={`${person}-${org}-${document}`}
      initialDocument={document === "resume" ? "RESUME" : "IDENTITY_BANK"}
      personId={data.id}
      orgId={data.org_id}
      name={data.name}
      returnTo={`/admin/instructors?org=${org}`}
    />
  );
}
