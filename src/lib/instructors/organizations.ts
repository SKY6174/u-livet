import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import type { Identity } from "@/lib/portal/types";

type ManagedOrganization = { id: string; name: string };

// Identity is verified on the server. Business RPCs still enforce current roles.
export async function getManagedInstructorOrganizations(
  identity: Pick<Identity, "roles">,
) {
  const ids = Array.from(new Set(
    identity.roles
      .filter((role) => role.role === "COURSE_MANAGER")
      .map((role) => role.org_id),
  ));
  const empty: ManagedOrganization[] = [];
  if (!ids.length) return { organizations: empty, unavailable: false };
  if (ids.some((id) => !UUID.test(id)))
    return { organizations: empty, unavailable: true };
  try {
    const db = await createServerSupabaseClient();
    const { data, error } = await db.from("life_organizations")
      .select("id,name").in("id", ids).order("name");
    if (error) return { organizations: empty, unavailable: true };
    return {
      organizations: ((data ?? []) as ManagedOrganization[])
        .sort((a, b) => a.name.localeCompare(b.name, "ko")),
      unavailable: false,
    };
  } catch {
    return { organizations: empty, unavailable: true };
  }
}
