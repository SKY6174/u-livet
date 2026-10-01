import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { canEditGuide } from "@/lib/course-guide/data";
import type { CourseGuide } from "@/lib/course-guide/model";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { GuideEditForm } from "@/components/course-guide/guide-edit-form";

const FIELDS = "id,year,sort_order,name,academy,summary,curriculum,mode,capacity,teaching_hours,period_label,schedule_history,time_label,location,certificate,offering_id,org_id,card_image_url,revision";

export default async function EditGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id) || id.length > 100) notFound();
  const identity = await requireIdentity(`/admin/courses/guides/${id}`);
  const { data, error } = await (await createServerSupabaseClient())
    .from("life_course_guides").select(FIELDS).eq("id", id).eq("published", true).maybeSingle();
  if (error || !data || !canEditGuide(identity, data.org_id)) notFound();
  const course = data as CourseGuide;
  return <div className="page-shell max-w-5xl">
    <Link href="/courses" className="mb-5 inline-block text-sm font-semibold text-teal-800 hover:underline">← 교육과정 찾기</Link>
    <h1 className="mb-2 text-3xl font-bold text-slate-900">과정 안내 수정</h1>
    <p className="mb-8 text-slate-600">공개 과정 카드와 상세 안내에 표시되는 내용을 편집합니다.</p>
    <GuideEditForm course={course} />
  </div>;
}
