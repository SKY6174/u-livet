import { notFound } from "next/navigation";
import { getOperationContext } from "@/lib/operation-documents/data";
import type { CourseInfo } from "@/lib/operation-documents/model";
import { DocumentEditor } from "@/components/operation-documents/document-editor";
import { createServerSupabaseClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export const metadata = { title: "과정 운영 문서 · U-LIFE" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; kind: string }>;
}) {
  const { id, kind } = await params;
  if (kind !== "plan" && kind !== "result") notFound();
  const initial = await getOperationContext(id);
  const { data } = await (await createServerSupabaseClient()).rpc("life_operation_list");
  const courses = (Array.isArray(data) ? data : []) as Pick<
    CourseInfo,
    "id" | "name" | "starts_on"
  >[];
  const courseOptions = courses.some((course) => course.id === initial.course.id)
    ? courses
    : [initial.course, ...courses];
  return (
    <DocumentEditor
      key={id}
      initial={initial}
      kind={kind}
      courseOptions={courseOptions}
    />
  );
}
