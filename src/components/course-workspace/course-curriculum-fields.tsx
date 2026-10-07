"use client";

import { useState } from "react";
import { formatCourseCurriculum, MAX_COURSE_CURRICULUM_LENGTH, parseCourseCurriculum, type CourseCurriculumSections } from "@/lib/course-workspace/curriculum";

export function CourseCurriculumFields({ initialCurriculum }: { initialCurriculum: string }) {
  const [sections, setSections] = useState(() => parseCourseCurriculum(initialCurriculum));
  const [edited, setEdited] = useState(false);
  const formatted = formatCourseCurriculum(sections);
  const update = (field: keyof CourseCurriculumSections, value: string) => {
    setEdited(true);
    setSections(current => ({ ...current, [field]: value }));
  };
  return <fieldset className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
    <legend className="px-1 text-base font-bold">교육 안내</legend>
    <input type="hidden" name="curriculum" value={edited ? formatted ?? "" : initialCurriculum} />
    <label className="field">교육내용
      <textarea rows={5} maxLength={16000} value={sections.content} required
        onChange={event => update("content", event.target.value)} placeholder="배울 주제와 실습 내용을 적어주세요." />
    </label>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="field">교육대상
        <textarea rows={4} maxLength={3000} value={sections.audience}
          onChange={event => update("audience", event.target.value)} placeholder="예: 관련 분야 종사자 또는 관심 있는 성인학습자" />
      </label>
      <label className="field">준비사항
        <textarea rows={4} maxLength={3000} value={sections.preparation}
          onChange={event => update("preparation", event.target.value)} placeholder="예: 실습복, 개인 노트북" />
      </label>
    </div>
    <p className={`text-xs ${edited && !formatted ? "text-red-700" : "text-slate-500"}`}>
      {edited && !formatted ? "교육내용은 필수이며 전체 20,000자 이내로 작성해 주세요." : `세 항목은 수강생에게 각각 표시됩니다. 전체 ${MAX_COURSE_CURRICULUM_LENGTH.toLocaleString("ko-KR")}자 이내.`}
    </p>
  </fieldset>;
}
