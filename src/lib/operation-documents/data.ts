import "server-only";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { UUID } from "@/lib/portal/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { DocumentContext } from "./model";
export async function getOperationContext(id: string) {
  await requireIdentity(`/operation-documents/${id}/plan`);
  if (!UUID.test(id)) notFound();
  const { data, error } = await (
    await createServerSupabaseClient()
  ).rpc("life_operation_context", { f: id });
  if (error?.message === "FORBIDDEN") notFound();
  if (error || !data)
    throw new Error(
      "운영 문서를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  return data as DocumentContext;
}
