import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import opening from "../../../docs/operations/2026-course-opening-plans.json";
import { mergeOperationCourses, type OperationCourse, type WorkbookSummary } from "./model";
import type { CourseWorkspace } from "@/lib/course-workspace/types";

export async function getCourseBudgets(org: string, workspaces: CourseWorkspace[]) {
  try {
    const { data, error } = await (await createServerSupabaseClient()).rpc("life_course_budget_overview", { o: org, y: 2026 });
    if (error || !data) return { courses: [], workbooks: [], unavailable: true };
    const guides = (data.courses as Omit<OperationCourse, "workspace">[]).map(course => {
      const plan = opening.courses.find(p => p.sourceId === course.source_id);
      return { ...course,
        teachers: plan?.staff.teachers.map(p => `${p.name}(${p.classification})`).join(", ") || "미기재",
        assistants: plan?.staff.assistantInstructors.map(p => `${p.name}(${p.classification})`).join(", ") || "미기재",
        support_staff: plan?.staff.supportStaff.map(p => p.name).join(", ") || "미기재",
      };
    });
    return { courses: mergeOperationCourses(guides, workspaces), workbooks: data.workbooks as WorkbookSummary[], unavailable: false };
  } catch { return { courses: [], workbooks: [], unavailable: true }; }
}
