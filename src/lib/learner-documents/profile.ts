import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { learnerDocumentProfile } from "./model";
import { getLearnerProfile } from "@/lib/learner-profile/data";

export async function getLearnerDocumentProfile() {
  try {
    const db = await createServerSupabaseClient();
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) throw new Error("가입 정보를 불러오지 못했습니다.");
    const profile = await getLearnerProfile();
    return { ...learnerDocumentProfile(user.user_metadata, profile.phone || user.phone), unavailable: false };
  } catch {
    return { phone: "", birthDate: "", unavailable: true };
  }
}
