import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DocumentPortal } from "@/components/instructor-documents/document-portal";
import { Empty } from "@/components/portal/ui";
import Link from "next/link";

export default async function InstructorDocuments() {
  const me = await requireIdentity("/mypage/instructor/documents");
  const { data, error } = await (await createServerSupabaseClient()).rpc("life_instructor_document_access", { p_person: me.id });
  if (error || !data) return <div className="page-shell"><Empty title="강사 등록 후 서류함을 이용할 수 있습니다"><Link className="btn-primary" href="/mypage/instructor">강사 이력 등록</Link></Empty></div>;
  return <DocumentPortal personId={data.id} orgId={data.org_id} name={data.name} />;
}
