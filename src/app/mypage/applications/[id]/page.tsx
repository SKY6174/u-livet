import { notFound } from "next/navigation";
import { PageIntro } from "@/components/portal/ui";
import { requireIdentity } from "@/lib/auth/session";
import { getApplicationDetail } from "@/lib/management/data";
import { ApplicationDetail } from "@/components/management/application-detail";
export default async function MyApplication({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireIdentity(`/mypage/applications/${id}`);
  const data = await getApplicationDetail(id);
  if (data.application.person_id !== me.id) notFound();
  return <div className="page-shell"><PageIntro eyebrow="MY APPLICATION" title="나의 신청·처리 이력" /><ApplicationDetail data={data} /></div>;
}
