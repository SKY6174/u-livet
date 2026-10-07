import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type LearnerProfile = {
  phone: string;
  nickname: string | null;
  character_key: string | null;
  photo_path: string | null;
};

export async function getLearnerProfile(): Promise<LearnerProfile> {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.rpc("life_my_learner_profile");
  if (error || !data) throw new Error("LEARNER_PROFILE_UNAVAILABLE");
  const value = data as Partial<LearnerProfile>;
  return {
    phone: typeof value.phone === "string" ? value.phone : "",
    nickname: typeof value.nickname === "string" ? value.nickname : null,
    character_key: typeof value.character_key === "string" ? value.character_key : null,
    photo_path: typeof value.photo_path === "string" ? value.photo_path : null,
  };
}
