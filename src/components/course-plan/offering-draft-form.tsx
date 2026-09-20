import Link from "next/link";
import { createOffering } from "@/app/actions";
import { WorkingCopyForm } from "./working-copy-form";
import type { OpeningWorkingCopy } from "@/lib/course-opening/working-copy";
import { ActionForm } from "@/components/portal/action-form";
import type { OpeningCourse } from "@/lib/course-opening/model";
import { createOfferingPrefill } from "@/lib/course-opening/prefill";
import { formatSourceNumber } from "@/lib/course-plan/model";

function PlanReference({ plan, restored }: { plan: OpeningCourse; restored: boolean }) {
  return (
    <section aria-label="불러온 운영계획서" className="mb-6 rounded-xl border border-teal-200 bg-teal-50 p-5">
      <h2 className="break-words text-lg font-bold text-teal-950">{plan.sourceId} · {plan.title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-teal-950">{restored ? "본인이 임시저장한 입력을 불러왔습니다. 실제 기수로 등록되기 전이며 내용을 수정할 수 있습니다." : "계획서의 기본정보를 불러왔습니다. 아직 저장되지 않았으며 내용을 수정할 수 있습니다."} 사업연도·모집기간·최종 교육일정·운영방식·선발방식을 확인해 입력하세요.</p>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <Link className="py-2 text-teal-800 underline" href={`/admin/course-plan/opening#${plan.sourceId}`}>전체 계획서 확인</Link>
        <Link className="py-2 text-teal-800 underline" href="/admin/courses?create=1#offering-draft">불러오기 해제 · 직접 입력</Link>
      </div>
      <details className="mt-3 border-t border-teal-200 pt-3">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-teal-950">원문 일정·수강료·확인 사항 보기</summary>
        <dl className="mt-3 space-y-3 text-sm">
          <div><dt className="text-slate-600">표제 교육기간 (미확정)</dt><dd className="mt-1">{plan.schedule.declaredPeriod.startsOn} ~ {plan.schedule.declaredPeriod.endsOn}</dd></div>
          <div><dt className="text-slate-600">차시 날짜 (원문 표기)</dt><dd className="mt-1 break-words">{plan.schedule.sessionDatesAsWritten.join(" · ")}</dd></div>
          <div><dt className="text-slate-600">시간·교육방식 (계획)</dt><dd className="mt-1 break-words">{plan.schedule.summary} · {plan.schedule.modeAsWritten} · {plan.teachingHours}시간</dd></div>
          <div><dt className="text-slate-600">수강료 산식 기준 1인 금액 (미승인)</dt><dd className="mt-1">{formatSourceNumber(plan.tuition.perPersonDerivedFromFormula, "원")} ({formatSourceNumber(plan.tuition.hourlyRate, "원")} × {plan.tuition.formulaHours}시간)</dd></div>
        </dl>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-amber-950">{plan.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
      </details>
    </section>
  );
}

export function OfferingDraftForm({ orgId, years, plan, copy }: {
  orgId: string;
  years: { id: string; label: string }[];
  plan?: OpeningCourse;
  copy?: OpeningWorkingCopy | null;
}) {
  const defaults = { ...(plan ? createOfferingPrefill(plan) : {}), ...copy?.payload };
  const fields = <>
          <input type="hidden" name="org" value={orgId} />
          <div className="grid gap-4 md:grid-cols-2">
            <label className="field">
              사업연도
              <select name="year" required defaultValue={copy?.payload.year ?? (plan ? "" : undefined)}>
                {plan && <option value="" disabled>사업연도 선택</option>}
                {years.map((year) => <option key={year.id} value={year.id}>{year.label}</option>)}
              </select>
            </label>
            <label className="field">과정명<input name="title" maxLength={200} required defaultValue={defaults?.title} /></label>
            <label className="field">아카데미·분야<input name="academy" maxLength={100} required defaultValue={defaults?.academy} /></label>
            <label className="field">교육장소<input name="location" maxLength={200} required defaultValue={defaults?.location} /></label>
            <label className="field">
              운영방식
              <select name="mode" required defaultValue={copy?.payload.mode ?? (plan ? "" : "OFFLINE")}>
                <option value="" disabled>운영방식 선택</option>
                <option value="OFFLINE">대면</option><option value="ONLINE">온라인</option><option value="BLENDED">혼합</option>
              </select>
            </label>
            <label className="field">
              선발방식
              <select name="selection_method" required defaultValue={copy?.payload.selection_method ?? (plan ? "" : "REVIEW")}>
                <option value="" disabled>선발방식 선택</option>
                <option value="REVIEW">심사</option><option value="FIRST_COME">선착순</option>
              </select>
            </label>
            <label className="field">정원<input type="number" name="capacity" min={1} max={1000} required defaultValue={defaults?.capacity} /></label>
            <p className="notice self-end">
              기수 초안은 무료로 등록됩니다.<br />
              {plan && <>계획서의 수강료 산식은 자동 반영되지 않습니다.<br /></>}
              유료 과정은 기수 상세에서 승인된 환불 규정과 납부 안내를 설정하세요.
            </p>
            {([["apply_from", "접수 시작"], ["apply_until", "접수 마감"]] as const).map(([name, label]) => (
              <label key={name} className="field">{label} (한국시간)<input type="datetime-local" name={name} required defaultValue={copy?.payload[name]} /></label>
            ))}
            {([["starts_on", "교육 시작일"], ["ends_on", "교육 종료일"]] as const).map(([name, label]) => (
              <label key={name} className="field">{label}<input type="date" name={name} required defaultValue={copy?.payload[name]} /></label>
            ))}
          </div>
          <label className="field">과정 소개<textarea name="summary" rows={3} maxLength={3000} required defaultValue={defaults?.summary} /></label>
          <label className="field">교육내용·대상·준비사항<textarea name="curriculum" rows={6} maxLength={20000} required defaultValue={defaults?.curriculum} /></label>
  </>;
  return (
    <details id="offering-draft" open={!!plan} className="panel scroll-mt-6">
      <summary className="cursor-pointer text-lg font-bold">새 과정·기수 초안 등록</summary>
      <div className="mt-6">
        {plan && <PlanReference plan={plan} restored={!!copy} />}
        {plan ? <WorkingCopyForm source={plan.sourceId} copy={copy}>{fields}</WorkingCopyForm> : <ActionForm action={createOffering} label="초안 저장">{fields}</ActionForm>}
      </div>
    </details>
  );
}
