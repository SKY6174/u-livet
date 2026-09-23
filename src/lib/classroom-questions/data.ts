import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import type { ClassQuestion, InstructorHomeSummary } from "./types";

export async function getClassQuestions(offeringId: string): Promise<ClassQuestion[] | null> {
  if (!UUID.test(offeringId)) return null;
  try {
    const { data, error } = await (await createServerSupabaseClient())
      .rpc("life_class_questions", { f: offeringId });
    return error || !Array.isArray(data) ? null : data as ClassQuestion[];
  } catch {
    return null;
  }
}

export async function getInstructorHomeSummary(): Promise<InstructorHomeSummary[] | null> {
  try {
    const { data, error } = await (await createServerSupabaseClient())
      .rpc("life_instructor_home_summary");
    return error || !Array.isArray(data) ? null : data as InstructorHomeSummary[];
  } catch {
    return null;
  }
}
