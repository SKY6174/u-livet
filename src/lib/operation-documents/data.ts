/**
 * @file src/lib/operation-documents/data.ts
 * @description 운영계획서 및 결과보고서 컨텍스트와 편집기 데이터를 제공하는 서버 전용 모듈입니다.
 *              데이터베이스에 존재하는 과정뿐 아니라 2026년 RISE사업 16개 전체 과정(PREFILLED_COURSES)에 대해
 *              안전하고 충실한 문서 컨텍스트와 과정 선택 목록을 지원합니다.
 */

import "server-only";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { UUID } from "@/lib/portal/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CourseInfo, DocumentContext } from "./model";
import { PREFILLED_COURSES, findPrefilledCourse } from "./prefilled-data";

async function getOperationClient(id: string) {
  await requireIdentity(`/operation-documents/${id}/plan`);
  return createServerSupabaseClient();
}

function createFallbackContext(id: string): DocumentContext {
  const prefilled = findPrefilledCourse(id) || PREFILLED_COURSES[0];
  if (!prefilled) notFound();

  return {
    manager: true,
    course: {
      id: prefilled.id,
      name: prefilled.title,
      academy: prefilled.academy,
      starts_on: prefilled.startsOn,
      ends_on: prefilled.endsOn,
      capacity: prefilled.capacity,
      summary: prefilled.summary,
      curriculum: prefilled.curriculum,
      location: prefilled.location,
      status: "DRAFT",
      org_id: "default",
    },
    responsible: {
      person_id: "prefilled-resp",
      name: prefilled.facultyCoordinator,
      affiliation: "울산과학대학교",
      revision: 1,
    },
    candidates: [],
    members: [],
    documents: [],
    legacy: null,
    sessions: prefilled.scheduleRows.map((s) => ({
      title: s.topic || prefilled.title,
      starts_at: `${s.date}T18:00:00Z`,
      ends_at: `${s.date}T21:00:00Z`,
    })),
    submissions: [],
  };
}

function operationContext(id: string, data: unknown, error: { message: string } | null): DocumentContext {
  if (error?.message === "FORBIDDEN") notFound();
  if (error || !data) {
    // DB 조회가 실패하거나 해당 ID가 DB에 없는 경우 사전 채움 데이터에서 검색
    const fallback = findPrefilledCourse(id);
    if (fallback) {
      return createFallbackContext(id);
    }
    throw new Error(
      "운영 문서를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
  return data as DocumentContext;
}

export async function getOperationContext(id: string): Promise<DocumentContext> {
  if (!UUID.test(id)) {
    const fallback = findPrefilledCourse(id);
    if (fallback) return createFallbackContext(id);
    notFound();
  }
  try {
    const db = await getOperationClient(id);
    const { data, error } = await db.rpc("life_operation_context", { f: id });
    return operationContext(id, data, error);
  } catch {
    const fallback = findPrefilledCourse(id);
    if (fallback) return createFallbackContext(id);
    throw new Error("운영 문서를 불러오지 못했습니다.");
  }
}

export async function getOperationEditorData(id: string) {
  let initial: DocumentContext;
  let dbCourses: Pick<CourseInfo, "id" | "name" | "starts_on">[] = [];

  if (!UUID.test(id)) {
    initial = createFallbackContext(id);
  } else {
    try {
      const db = await getOperationClient(id);
      const [context, list] = await Promise.all([
        db.rpc("life_operation_context", { f: id }),
        db.rpc("life_operation_list"),
      ]);
      initial = operationContext(id, context.data, context.error);
      if (!list.error && Array.isArray(list.data)) {
        dbCourses = list.data as Pick<CourseInfo, "id" | "name" | "starts_on">[];
      }
    } catch {
      initial = createFallbackContext(id);
    }
  }

  // 16개 전체 과정 옵션 결합 (드롭다운에서 모든 과정 탐색 가능)
  const prefilledOptions = PREFILLED_COURSES.map((c) => ({
    id: c.id,
    name: c.title,
    starts_on: c.startsOn,
  }));

  const mergedMap = new Map<string, Pick<CourseInfo, "id" | "name" | "starts_on">>();
  // 1. 사전 채움 16개 과정 먼저 등록
  for (const opt of prefilledOptions) {
    mergedMap.set(opt.name, opt);
  }
  // 2. DB 과정이 있다면 덮어쓰기 (실제 ID 유지)
  for (const dbC of dbCourses) {
    mergedMap.set(dbC.name, dbC);
  }
  // 3. 현재 initial 코스도 확실히 포함
  mergedMap.set(initial.course.name, {
    id: initial.course.id,
    name: initial.course.name,
    starts_on: initial.course.starts_on,
  });

  return {
    initial,
    courseOptions: Array.from(mergedMap.values()),
  };
}
