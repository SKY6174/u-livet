import { ActionForm } from "@/components/portal/action-form";
import { updateOffering } from "@/app/actions";
import type { Offering } from "@/lib/portal/types";
import { CourseLocationFields } from "@/components/course-guide/course-location-fields";
import { CourseCurriculumFields } from "@/components/course-workspace/course-curriculum-fields";
import Link from "next/link";

const koreanInput = (value: string | null) => value ? new Date(Date.parse(value) + 9 * 60 * 60 * 1000).toISOString().slice(0, 16) : "";
export function OfferingEditForm({ offering: o, linkedGuideId }: { offering: Offering; linkedGuideId: string | null }) {
  if (o.academic_sealed) return <p className="notice mb-6">운영자료가 마감된 과정입니다. 기본 정보는 수정할 수 없습니다.</p>;
  return <details className="panel mb-6">
    <summary className="cursor-pointer text-lg font-bold">과정 기본 정보 수정</summary>
    {linkedGuideId && <p className="mt-4 text-sm text-slate-600">이 과정의 기본 정보는 여기서 한 번 수정하면 공개 과정 안내에도 반영됩니다. <Link href={`/admin/courses/guides/${linkedGuideId}`} className="font-semibold text-teal-800 underline">연결된 과정 안내 편집 →</Link></p>}
    <div className="mt-6"><ActionForm action={updateOffering} label="과정 정보 저장" resetOnSuccess={false} submitAlign="right" className="space-y-6">
      <input type="hidden" name="offering" value={o.id} /><input type="hidden" name="revision" value={o.academic_revision} />
      <section className="space-y-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
        <h3 className="font-bold">과정·모집 기본 정보</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="field">과정명<input name="name" maxLength={200} defaultValue={o.name} required /></label>
          <label className="field">정원<input type="number" name="capacity" min={1} max={1000} defaultValue={o.capacity} required /></label>
          <div className="grid gap-4 md:col-span-2 md:grid-cols-3">
            <label className="field">모집 상태<select name="status" defaultValue={o.status}>{o.status === "DRAFT" ? <option value="DRAFT">개설 초안</option> : <><option value="PUBLISHED">모집 공개</option><option value="CLOSED">모집 종료</option></>}</select></label>
            <label className="field">선발방식<select name="selection_method" defaultValue={o.selection_method ?? "REVIEW"}><option value="REVIEW">심사</option><option value="FIRST_COME">선착순</option></select></label>
            <label className="field">운영방식<select name="mode" defaultValue={o.mode}><option value="OFFLINE">대면</option><option value="ONLINE">온라인</option><option value="BLENDED">혼합</option></select></label>
          </div>
          {([["apply_from", "접수 시작"], ["apply_until", "접수 마감"]] as const).map(([name, label]) => <label className="field" key={name}>{label} (한국시간)<input type="datetime-local" name={name} defaultValue={koreanInput(o[name])} required /></label>)}
          {([["starts_on", "교육 시작일"], ["ends_on", "교육 종료일"]] as const).map(([name, label]) => <label className="field" key={name}>{label}<input type="date" name={name} defaultValue={o[name]} required /></label>)}
        </div>
      </section>
      <section className="space-y-5 rounded-xl border border-slate-200 p-4 sm:p-5">
        <h3 className="font-bold">수강생에게 보여줄 안내</h3>
        <label className="field">과정 소개
          <span className="text-sm font-normal text-slate-600">수강생이 이 과정에서 무엇을 배우고 어떤 경험을 하는지 쉽게 이해할 수 있도록 설명해 주세요.</span>
          <textarea name="summary" rows={4} maxLength={3000} defaultValue={o.summary} required />
        </label>
        <CourseLocationFields initialLocation={o.location} />
      </section>
      <CourseCurriculumFields initialCurriculum={o.curriculum} />
      <p className="text-sm text-slate-600">접수 마감은 교육 시작 전이어야 합니다. 신청이 있는 과정은 선발방식을 바꿀 수 없으며, 정원은 확정·납부 대기 인원보다 줄일 수 없습니다. 초안 공개와 강사 배정은 아래에서 관리합니다.</p>
    </ActionForm></div>
  </details>;
}
