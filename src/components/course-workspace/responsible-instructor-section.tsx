import Link from "next/link";
import { assignInstructor } from "@/app/actions";
import { assignResponsibleInstructor } from "@/app/admin/offerings/[id]/manage/actions";
import { ActionForm } from "@/components/portal/action-form";
import { RESULT_STATUS_LABELS, STATUS_LABELS, type DocumentContext } from "@/lib/operation-documents/model";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Instructor = { person_id: string; name: string; assigned: boolean };
const namesWithDuplicates = (names: string[]) => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) duplicates.add(name);
    seen.add(name);
  }
  return duplicates;
};

export async function ResponsibleInstructorSection({ offeringId }: { offeringId: string }) {
  const db = await createServerSupabaseClient();
  const [instructorsResult, operationResult] = await Promise.all([
    db.rpc("life_instructors", { f: offeringId }),
    db.rpc("life_operation_context", { f: offeringId }),
  ]);
  const instructors = (instructorsResult.data ?? []) as Instructor[];
  const assigned = instructors.filter((instructor) => instructor.assigned);
  const available = instructors.filter((instructor) => !instructor.assigned);
  const context = operationResult.data as DocumentContext | null;
  const responsible = context?.responsible;
  const candidates = context?.candidates ?? [];
  const duplicateInstructorNames = namesWithDuplicates(instructors.map((instructor) => instructor.name));
  const duplicateCandidateNames = namesWithDuplicates(candidates.map((candidate) => candidate.name));
  const hasCurrentCandidate = candidates.some((candidate) => candidate.id === responsible?.person_id);

  return (
    <section className="panel mb-8 scroll-mt-6" id="instructors">
      <h2 className="section-title">강사 배정 · 책임강사 지정</h2>
      <p className="mb-5 text-sm leading-relaxed text-slate-600">
        먼저 승인된 강사를 이번 개설 과정에 배정하고, 그중 한 명을 책임강사로 지정하세요.
        이 지정은 운영계획서와 운영결과보고서의 작성 권한·표지에 함께 적용됩니다.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="font-semibold">1. 이번 과정 강사 배정</h3>
          {instructorsResult.error ? (
            <p role="alert" className="mt-3 text-sm text-red-700">강사 목록을 불러오지 못했습니다.</p>
          ) : instructors.length === 0 ? (
            <p className="notice mt-3 text-sm">
              이 사업단에 승인된 활성 강사 계정이 없습니다. 강사 등록과 역할 승인을 먼저 완료해 주세요.
              <Link className="ml-2 font-semibold underline" href="/admin/instructors">강사 관리 →</Link>
            </p>
          ) : (
            <div className="mt-3 space-y-4">
              <div className="divide-y rounded-xl border bg-white px-4">
                {assigned.length === 0 && <p className="py-4 text-sm text-slate-600">아직 배정된 강사가 없습니다.</p>}
                {assigned.map((instructor) => {
                const isResponsible = responsible?.person_id === instructor.person_id;
                return (
                  <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={instructor.person_id}>
                    <p className="text-sm">
                      {instructor.name}
                      {isResponsible && <strong className="ml-2 text-teal-800">책임강사</strong>}
                    </p>
                    {isResponsible ? (
                      <span className="text-xs text-slate-500">변경 후 배정 해제 가능</span>
                    ) : (
                      <ActionForm action={assignInstructor} label="배정 해제" className="space-y-1">
                        <input type="hidden" name="offering" value={offeringId} />
                        <input type="hidden" name="person" value={instructor.person_id} />
                        <input type="hidden" name="enabled" value="false" />
                      </ActionForm>
                    )}
                  </div>
                );
                })}
              </div>
              {available.length > 0 && <ActionForm action={assignInstructor} label="강사 배정" resetOnSuccess={false} submitAlign="right" className="space-y-3">
                <input type="hidden" name="offering" value={offeringId} />
                <input type="hidden" name="enabled" value="true" />
                <label className="field">
                  승인된 강사 추가
                  <select name="person" required defaultValue="">
                    <option value="" disabled>강사 선택</option>
                    {available.map((instructor) => <option key={instructor.person_id} value={instructor.person_id}>
                      {instructor.name}{duplicateInstructorNames.has(instructor.name) ? ` · ${instructor.person_id.slice(0, 8)}` : ""}
                    </option>)}
                  </select>
                </label>
              </ActionForm>}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-5">
          <h3 className="font-semibold">2. 책임강사 지정</h3>
          {operationResult.error || !context ? (
            <p role="alert" className="mt-3 text-sm text-red-700">책임강사 정보를 불러오지 못했습니다. 추가 인증 상태를 확인해 주세요.</p>
          ) : (
            <>
              <p className="mt-2 text-sm">현재 책임강사: <strong>{responsible?.name ?? "미지정"}</strong></p>
              {candidates.length ? (
                <ActionForm key={responsible?.revision ?? 0} action={assignResponsibleInstructor} label="책임강사 저장" resetOnSuccess={false} submitAlign="right" className="mt-4 space-y-3">
                  <input type="hidden" name="offering" value={offeringId} />
                  <input type="hidden" name="revision" value={responsible?.revision ?? 0} />
                  <label className="field">
                    이번 과정에 배정된 활성 강사
                    <select name="person" defaultValue={hasCurrentCandidate ? responsible?.person_id : ""} required>
                      <option value="" disabled>책임강사 선택</option>
                      {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>
                        {candidate.name}{duplicateCandidateNames.has(candidate.name) ? ` · ${candidate.id.slice(0, 8)}` : ""}
                      </option>)}
                    </select>
                  </label>
                </ActionForm>
              ) : (
                <p className="mt-4 text-sm text-amber-900">배정된 활성 강사가 없습니다. 왼쪽에서 강사를 배정해 주세요.</p>
              )}
              <p className="mt-3 text-xs leading-relaxed text-slate-600">
                변경 시 검토 중인 문서는 작성 중으로 돌아가고 미제출 문서의 책임강사명이 바뀝니다. 기존 최종 제출본은 보존됩니다.
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-teal-800">
                {(["plan", "result"] as const).map((kind) => {
                  const status = context.documents.find((document) => document.kind === kind)?.status;
                  return <Link className="underline" key={kind} href={`/operation-documents/${offeringId}/${kind}`}>
                    {kind === "plan" ? "운영계획서" : "운영결과보고서"} · {status ? (kind === "result" ? RESULT_STATUS_LABELS : STATUS_LABELS)[status] : "작성 전"} →
                  </Link>;
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
