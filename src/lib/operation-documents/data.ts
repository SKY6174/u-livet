import "server-only";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { UUID } from "@/lib/portal/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CourseInfo, DocumentContext } from "./model";

async function getOperationClient(id: string) {
  await requireIdentity(`/operation-documents/${id}/plan`);
  if (!UUID.test(id)) notFound();
  return createServerSupabaseClient();
}

function operationContext(data: unknown, error: { message: string } | null) {
  if (error?.message === "FORBIDDEN") notFound();
  if (error || !data)
    throw new Error(
      "운영 문서를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  return data as DocumentContext;
}

export async function getOperationContext(id: string) {
  const db = await getOperationClient(id);
  const { data, error } = await db.rpc("life_operation_context", { f: id });
  return operationContext(data, error);
}

export async function getOperationEditorData(id: string) {
  const db = await getOperationClient(id);
  const [context, list] = await Promise.all([
    db.rpc("life_operation_context", { f: id }),
    db.rpc("life_operation_list"),
  ]);
  const initial = operationContext(context.data, context.error);
  type CourseOption = Pick<CourseInfo, "id" | "name" | "starts_on">;
  const courses = (!list.error && Array.isArray(list.data) ? list.data : []) as CourseOption[];
  const options = courses.some((course) => course.id === initial.course.id)
    ? courses
    : [initial.course, ...courses];
  return {
    initial,
    courseOptions: options.map(({ id, name, starts_on }) => ({ id, name, starts_on })),
  };
}
