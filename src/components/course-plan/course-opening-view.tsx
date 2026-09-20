import Link from "next/link";
import { ACADEMIES, formatSourceNumber } from "@/lib/course-plan/model";
import {
  COVERAGE_OPTIONS, filterOpeningCourses,
  type OpeningCourse, type OpeningFilters, type OpeningPlan,
} from "@/lib/course-opening/model";

const BASE_PATH = "/admin/course-plan/opening";
const SOURCE_PAGE_LABELS = {
  cover: "표지", overview: "개요", target: "대상", qualifications: "자격",
  schedule: "일정", staff: "인력", budget: "예산",
} as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium">{children}</dd></div>;
}

function Teachers({ label, people }: {
  label: string; people: OpeningCourse["staff"]["teachers"];
}) {
  return (
    <section className="rounded-xl bg-slate-50 p-4">
      <h4 className="mb-3 font-semibold">{label}</h4>
      {people.length ? <ul className="space-y-3 text-sm">
        {people.map((person, index) => <li key={index}>
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {person.name}<span className="rounded border border-slate-200 bg-white px-2 py-1">{person.classification}</span>
          </p>
          <p className="mt-1 break-words text-slate-600">{person.affiliationAndPosition} · {person.hours}시간</p>
        </li>)}
      </ul> : <p className="text-sm text-slate-600">미기재</p>}
    </section>
  );
}

function OpeningDetails({ course: c, source }: { course: OpeningCourse; source: OpeningPlan["sources"][number] | undefined }) {
  return (
    <details className="mt-5 border-t border-slate-200 pt-2">
      <summary className="min-h-11 cursor-pointer py-3 font-semibold text-teal-800">
        교육내용·인력·개설 조건 확인 · {c.title}
      </summary>
      <div className="space-y-7 pb-2 pt-4">
        <section>
          <h3 className="mb-3 text-lg font-semibold">교육내용과 계획 대상</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm">{c.curriculumFromPlan.map((item) => <li key={item}>{item}</li>)}</ul>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="계획상 교육대상">{c.targetAsPlanned}</Field>
            <Field label="협력기관 (계획)">{c.partnerAsPlanned}</Field>
          </dl>
          <p className="mt-3 text-sm text-slate-500">모집 대상의 최종 지원자격·증빙·우선순위는 별도 확정이 필요합니다.</p>
        </section>
        <section>
          <h3 className="mb-3 text-lg font-semibold">일정과 장소 (원문 계획)</h3>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="요일·시간">{c.schedule.summary}</Field>
            <Field label="장소">{c.schedule.location}</Field>
            <Field label="교육방식">{c.schedule.modeAsWritten}</Field>
            <Field label="일정 확정 여부">미확정 · 표제와 차시표의 차이는 아래 확인 사항 참조</Field>
          </dl>
          <ul aria-label="차시표 날짜와 시수" className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {c.schedule.sessionDatesAsWritten.map((date, index) => (
              <li key={`${date}-${index}`} className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                <span>{date}</span><span>{formatSourceNumber(c.schedule.teachingHoursByDate[index] ?? null, "시간")}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-slate-500">차시표 날짜·시수는 원문 표기입니다. 실제 운영·수료 실적을 뜻하지 않습니다.</p>
        </section>
        <section>
          <h3 className="mb-3 text-lg font-semibold">강사 및 보조인력</h3>
          <div className="grid gap-3 lg:grid-cols-3">
            <Teachers label="강사" people={c.staff.teachers} />
            <Teachers label="보조강사" people={c.staff.assistantInstructors} />
            <section className="rounded-xl bg-slate-50 p-4">
              <h4 className="mb-3 font-semibold">보조인력</h4>
              <p className="text-sm text-slate-600">배정 상태: {c.staff.supportStatus}</p>
              <ul className="mt-3 space-y-3 text-sm">{c.staff.supportStaff.map((person, index) => <li key={index}>
                <p className="font-medium">{person.name}</p>
                <p className="mt-1 break-words text-slate-600">{person.department} · {person.hours}시간</p>
              </li>)}</ul>
            </section>
          </div>
          <p className="mt-3 text-sm text-slate-500">{c.staff.classificationBasis} 여러 명을 묶은 행의 시수는 인시 합계입니다.</p>
        </section>
        <section className="rounded-xl border border-slate-200 p-4">
          <h3 className="mb-3 text-lg font-semibold">수강료 검토 · 최종 금액 미확정</h3>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="예산표 산식 기준 1인 금액">{formatSourceNumber(c.tuition.perPersonDerivedFromFormula, "원")}</Field>
            <Field label="원문 수강료 산식">{formatSourceNumber(c.tuition.hourlyRate, "원")} × {c.tuition.formulaHours}시간 × {c.tuition.formulaCapacity}명</Field>
            <Field label="산식으로 계산한 총액">{formatSourceNumber(c.tuition.totalDerivedFromFormula, "원")}</Field>
            <Field label="원문 금액란 총액">{formatSourceNumber(c.tuition.totalCellAsWritten, "원")}</Field>
            {c.tuition.formulaHours !== c.teachingHours && <Field label={`교육시수 ${c.teachingHours}시간 기준 1인 계산값`}>{formatSourceNumber(c.tuition.perPersonDerivedFromTeachingHours, "원")}</Field>}
          </dl>
          <p className="mt-4 text-sm text-amber-900">예산표 산식은 승인된 수강료가 아닙니다. 최종 수강료·감면·납부·환불 조건과 자격비 포함 여부를 확정해야 합니다.</p>
          <p className="mt-2 text-sm text-slate-600">장학금 예산의 80% 산식은 자동 환급이나 수료 기준을 뜻하지 않습니다.</p>
        </section>
        <section>
          <h3 className="mb-3 text-lg font-semibold">관련 자격 정보 (원문)</h3>
          <p className="break-words text-sm leading-relaxed">{c.qualificationInformationAsWritten}</p>
          <p className="mt-2 text-sm text-slate-500">원문의 예시·빈칸·00원은 확정 자격이나 무료 발급을 뜻하지 않습니다.</p>
        </section>
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <h3 className="mb-3 text-lg font-semibold">개설 전 확인 사항</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm">{c.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
          <p className="mt-4 text-sm">모집기간·선발방법·수료 기준·정책 승인도 미확정입니다. 상단의 공통 확인 항목을 함께 검토하세요.</p>
        </section>
        <section className="text-sm text-slate-500">
          <h3 className="font-semibold text-slate-700">근거 자료 · {c.sourceId}</h3>
          <p className="mt-2 break-words">{source?.filename ?? "원본 파일 확인 필요"}</p>
          <p className="mt-2">PDF 물리 쪽수: {Object.entries(SOURCE_PAGE_LABELS).map(([key, label]) => {
            const page = c.sourcePages[key as keyof typeof SOURCE_PAGE_LABELS];
            return `${label} ${page === null ? "미기재" : `${page}쪽`}`;
          }).join(" · ")}</p>
        </section>
      </div>
    </details>
  );
}

export function CourseOpeningView({ plan, filters }: { plan: OpeningPlan; filters: OpeningFilters }) {
  const courses = filterOpeningCourses(plan.courses, filters);
  const additional = plan.courses.filter((course) => !course.existingCourseId);
  return (
    <div className="page-shell">
      <p className="eyebrow">2026 RISE · 운영계획서 검토</p>
      <h1 className="page-title">평생직업교육과정 개설 준비</h1>
      <p className="mt-3 max-w-3xl text-slate-600">운영계획서의 교육내용·인력·일정을 확인하고, 모집 전에 확정할 조건을 검토하세요. 모든 값은 계획 기준이며 개설 승인이나 모집 공고가 아닙니다.</p>
      <section aria-label="운영계획서 전체 합계" className="my-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["제공된 과정", `${plan.totals.courses}개`], ["계획 정원", `${plan.totals.capacity}명`], ["계획 교육시수", `${plan.totals.teachingHours}시간`], ["근거 문서", `${plan.sourceCount}개 · ${plan.sourcePageCount}쪽`]].map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{label}</p><p className="mt-3 break-words text-2xl font-bold">{value}</p>
          </div>
        ))}
      </section>
      <section aria-label="아카데미별 계획" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {plan.totals.academies.map((academy) => <div key={academy.academy} className="rounded-xl border border-teal-100 bg-teal-50 p-5">
          <h2 className="font-bold text-teal-900">{academy.academy}</h2>
          <p className="mt-2">{academy.courses}개 · {academy.capacity}명 · {academy.hours}시간</p>
          {academy.courses === 0 && <p className="mt-2 text-sm text-slate-600">운영계획서 미제공</p>}
        </div>)}
      </section>
      <section className="my-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">기존 현황표와 대조</h2>
        <p className="mt-3 text-sm">기존 현황표 대응 {plan.reconciliation.matchedExistingCourses}개 · 추가 자료 {additional.length}개 · 운영계획서 미제공 {plan.reconciliation.existingWithoutPlan.length}개</p>
        <ul className="mt-3 space-y-2 text-sm">
          {additional.map((course) => <li key={course.sourceId}>추가 자료: <Link className="text-teal-800 underline" href={`${BASE_PATH}#${course.sourceId}`}>{course.title}</Link></li>)}
          {plan.reconciliation.existingWithoutPlan.map((course) => <li key={course.id}>계획서 미제공: <Link className="text-teal-800 underline" href={`/admin/course-plan#${course.id}`}>{course.title}</Link> ({course.capacity}명 · {course.teachingHours}시간, 기존 현황표)</li>)}
        </ul>
        <p className="mt-3 text-sm text-slate-500">추가 자료는 신규 개설 승인을 뜻하지 않습니다. 계획서가 없는 과정은 위 16개 합계에 포함하지 않았습니다.</p>
      </section>
      <section aria-labelledby="opening-conditions" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
        <h2 id="opening-conditions" className="text-lg font-semibold">모든 과정에서 확정할 개설 조건</h2>
        <ul className="mt-3 grid list-disc gap-x-8 gap-y-2 pl-5 text-sm sm:grid-cols-2">
          <li>실제 개설 과정과 최종 교육일정</li><li>모집 시작·종료 일시</li>
          <li>지원자격·증빙·우선순위와 선발방법</li><li>최종 수강료·납부·감면·환불 조건</li>
          <li>출석률·평가 점수 등 수료 기준</li><li>수강신청·수료·환불 정책 승인</li>
        </ul>
        <p className="mt-3 text-sm">계획서의 모집 목표 80%와 실습 비중 90%는 수료 출석률이 아닙니다.</p>
      </section>
      <form action={BASE_PATH} className="mb-6 grid items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
        <label className="field sm:col-span-2 lg:col-span-4">과정·인력 검색<input name="q" defaultValue={filters.q} maxLength={100} placeholder="과정명, 강사·보조인력, 교육내용, 자격증" /></label>
        <label className="field">아카데미<select name="academy" defaultValue={filters.academy}><option value="">전체 아카데미</option>{ACADEMIES.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        <label className="field">강사 구분 (보조강사 포함)<select name="affiliation" defaultValue={filters.affiliation}><option value="">전체 구분</option><option value="INTERNAL">교내</option><option value="EXTERNAL">교외</option><option value="UNCONFIRMED">확인 필요</option></select></label>
        <label className="field">자료 대조<select name="coverage" defaultValue={filters.coverage}><option value="">전체 자료</option>{Object.entries(COVERAGE_OPTIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <div className="flex items-center gap-3"><button className="btn-primary" type="submit">검색</button><Link className="min-h-11 py-3 text-sm text-slate-600 underline" href={BASE_PATH}>초기화</Link></div>
      </form>
      <p className="mb-4 text-sm text-slate-600">검색 결과 <strong className="text-slate-900">{courses.length}개 과정</strong> / 전체 {plan.totals.courses}개</p>
      <div className="space-y-5">
        {courses.map((course) => <article key={course.sourceId} id={course.sourceId} className="panel scroll-mt-6">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="badge">{course.academy}</span><span className="text-slate-500">{course.sourceId} · {course.existingCourseId ? "기존 현황표 대응" : "추가 자료"}</span>
            <span className="rounded bg-amber-50 px-2 py-1 text-amber-900">모집 조건 미확정 · 확인 사항 {course.issues.length}건</span>
          </div>
          <h2 className="break-words text-xl font-bold">{course.title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{course.summaryFromPlan}</p>
          <dl className="mt-5 grid gap-4 sm:grid-cols-3">
            <Field label="계획서 표제 교육기간">{course.schedule.declaredPeriod.startsOn} ~ {course.schedule.declaredPeriod.endsOn}</Field>
            <Field label="계획 정원·시수">{course.capacity}명 · {course.teachingHours}시간</Field>
            <Field label="담당교수 (계획서)">{course.facultyCoordinator}</Field>
          </dl>
          {course.existingCourseId && <Link className="mt-3 inline-block py-2 text-sm text-teal-800 underline" href={`/admin/course-plan#${course.existingCourseId}`}>기존 현황표 비교</Link>}
          <div className="mt-4">
            <Link className="btn-secondary" href={`/admin/courses?plan=${course.sourceId}#offering-draft`}>등록 양식에 불러오기<span className="sr-only"> · {course.title}</span></Link>
            <p className="mt-2 text-sm text-slate-500">본인 계정에 임시저장한 준비 내용이 있으면 함께 불러옵니다. 미정 항목은 비워둔 채 임시저장할 수 있습니다.</p>
          </div>
          <OpeningDetails course={course} source={plan.sources.find((source) => source.id === course.sourceId)} />
        </article>)}
        {!courses.length && <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold">{filters.academy === "스마트테크" ? "스마트테크 운영계획서가 제공되지 않았습니다" : "조건에 맞는 과정이 없습니다"}</h2>
          <p className="mt-2 text-sm text-slate-600">다른 검색 조건을 선택하거나 전체 과정을 확인하세요.</p>
          <Link className="btn-secondary mt-5" href={BASE_PATH}>전체 과정 보기</Link>
        </section>}
      </div>
      <p className="mt-8 break-words text-sm text-slate-500">자료: {plan.sourceFolderName} · 정리 기준일 {plan.preparedAt}. 원본의 계획값과 확인 사항을 함께 검토하세요.</p>
    </div>
  );
}
