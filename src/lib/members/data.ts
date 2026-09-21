import "server-only";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MemberDirectory, MemberGroup, MemberHistory } from "./model";

export async function memberAdmin() {
  const me = await requireIdentity("/admin/accounts");
  if (!me.roles.some((role) => role.role === "SYSTEM_ADMIN")) notFound();
  return me;
}
export async function getMembers(group: MemberGroup, query = "", page = 1, person: string | null = null) {
  const { data, error } = await (await createServerSupabaseClient()).rpc("life_member_directory", {
    p_group: group, p_query: query, p_page: page, p_person: person,
  });
  return { data: error ? null : data as MemberDirectory | null, error: !!error };
}
export async function getMemberHistory(person: string, group: MemberGroup, page: number) {
  const { data, error } = await (await createServerSupabaseClient()).rpc("life_member_history", { p_person: person, p_group: group, p_page: page });
  return { data: error ? null : data as MemberHistory | null, error: !!error };
}
