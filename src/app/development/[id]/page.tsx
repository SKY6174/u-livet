import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import { PageIntro } from "@/components/portal/ui";
import { DevelopmentDetail } from "@/components/portal/development-detail";
import type { Development, InstructorOptions } from "@/lib/instructors/types";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  await requireIdentity("/development/" + id);
  const db = await createServerSupabaseClient();
  const [a, b] = await Promise.all([
    db.rpc("life_development_detail", { p: id }),
    db.rpc("life_instructor_options"),
  ]);
  if (a.error || b.error || !a.data || !b.data) notFound();
  const d = a.data as Development;
  return (
    <div className="page-shell">
      <PageIntro eyebrow="SYLLABUS & REVIEW" title="과정 계획·심의">
        제안 내용과 보완·승인·개설 이력을 함께 확인합니다.
      </PageIntro>
      <DevelopmentDetail
        development={d}
        options={b.data as InstructorOptions}
      />
    </div>
  );
}
