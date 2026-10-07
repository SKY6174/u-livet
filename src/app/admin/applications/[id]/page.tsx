import { PageIntro } from "@/components/portal/ui";
import { getApplicationDetail, requireManager } from "@/lib/management/data";
import { ApplicationDetail } from "@/components/management/application-detail";
export default async function Application({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireManager(`/admin/applications/${id}`);
  return <div className="page-shell"><PageIntro eyebrow="APPLICATION" title="신청 상세·심사" /><ApplicationDetail data={await getApplicationDetail(id)} manager /></div>;
}
