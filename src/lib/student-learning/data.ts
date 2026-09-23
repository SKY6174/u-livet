import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCourseCatalog } from "@/lib/course-guide/data";
import type { HistoryRow } from "@/lib/portal/evaluation";
import type { MySurvey } from "@/lib/performance/types";
import type { LearningHub } from "./types";

export async function getMyLearningHub(): Promise<LearningHub | null> {
  try {
    const { data, error } = await (await createServerSupabaseClient()).rpc("life_my_learning");
    return error || !data ? null : data as LearningHub;
  } catch {
    return null;
  }
}

export async function getLearnerHomeData() {
  const [hub, catalog] = await Promise.all([getMyLearningHub(), getCourseCatalog()]);
  return { hub, catalog, now: Date.now() };
}

export async function getStudentLearning() {
  const db = await createServerSupabaseClient();
  async function read<T>(name: string): Promise<T | null> {
    try {
      const { data, error } = await db.rpc(name);
      return error ? null : (data as T);
    } catch {
      return null;
    }
  }
  const [hub, history, surveys, catalog] = await Promise.all([
    read<LearningHub>("life_my_learning"),
    read<HistoryRow[]>("life_completion_history"),
    read<MySurvey[]>("life_my_surveys"),
    getCourseCatalog(),
  ]);
  return { hub, history, surveys, catalog, now: Date.now() };
}
export type StudentLearningData = Awaited<
  ReturnType<typeof getStudentLearning>
>;
