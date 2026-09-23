import Link from "next/link";
import {
  ACADEMIES, AFFILIATIONS, BUDGET_LABELS, filterCourses,
  formatSourceNumber, formatSourceText, sumCourses,
  type CoursePlan, type CourseFilters, type PlannedCourse, type Staffing,
} from "@/lib/course-plan/model";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-1 break-words font-medium">{children}</dd>
    </div>
  );
}

function StaffList({ label, staff, showAffiliation = true }: {
  label: string; staff: Staffing; showAffiliation?: boolean;
}) {
  return (
    <section className="rounded-xl bg-slate-50 p-4">
      <h4 className="mb-3 font-semibold">{label}</h4>
      {staff.members.length ? (
        <ul className="space-y-2">
          {staff.members.map((person, index) => (
            <li key={index} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{person.name}{/^[AB]$/.test(person.name) && " (원문 표기)"}</span>
              {showAffiliation && (
                <span className="rounded-md border border-slate-200 bg-white px-2 py-1">
                  {AFFILIATIONS[person.affiliation]}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-slate-600">{formatSourceText(staff.sourceText)}</p>}
    </section>
  );
}

function CourseDetails({ course: c }: { course: PlannedCourse }) {
  return (
    <details className="mt-5 border-t border-slate-200 pt-2">
      <summary className="min-h-11 cursor-pointer py-3 font-semibold text-teal-800">
        인력·일정·예산 상세 보기 · {c.title}
      </summary>
      <div className="space-y-7 pb-2 pt-4">
        <div>
          <h3 className="mb-3 text-lg font-semibold">강사 및 보조인력</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <StaffList label="강사" staff={c.instructors} />
            <StaffList label="보조강사" staff={c.assistantInstructors} />
            <StaffList label="보조인력" staff={c.supportStaff} showAffiliation={false} />
          </div>
        </div>
        <section>
          <h3 className="mb-3 text-lg font-semibold">사업계획과 교육일정</h3>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="실행과제">{c.task}</Field>
            <Field label="학부(과)">{c.department}</Field>
            <Field label="거버넌스">{c.partner}</Field>
            <Field label="모집정원">{c.capacity}명</Field>
            <Field label="모집인원">{formatSourceNumber(c.recruited, "명")}</Field>
            <Field label="수료인원">{formatSourceNumber(c.completed, "명")}</Field>
            <Field label="교육기간 (원문)">{c.schedule.sourcePeriod}</Field>
            <Field label="요일·반복">{c.schedule.weekdays} · {c.schedule.frequency}</Field>
            <Field label="시간·시수">{c.schedule.time} · {c.hours}시간</Field>
            <Field label="장소">{c.schedule.location}</Field>
            <Field label="관련 자격증">{formatSourceText(c.certificate)}</Field>
            <Field label="비고">{formatSourceText(c.notes)}</Field>
          </dl>
        </section>
        <section>
          <h3 className="mb-3 text-lg font-semibold">예산현황 <span className="text-sm font-normal text-slate-500">(단위: 원)</span></h3>
          <dl className="grid gap-x-8 gap-y-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(BUDGET_LABELS).map(([key, label]) => (
              <Field key={key} label={label}>
                {formatSourceNumber(c.budget[key as keyof typeof BUDGET_LABELS], "원")}
              </Field>
            ))}
            <div className="border-t pt-3 sm:col-span-2 lg:col-span-3">
              <Field label="총액 (원문)">{formatSourceNumber(c.budget.total, "원")}</Field>
            </div>
          </dl>
        </section>
      </div>
    </details>
  );
}

export function CoursePlanView({ plan, filters }: {
  plan: CoursePlan; filters: CourseFilters;
}) {
  const total = sumCourses(plan.courses);
  const courses = filterCourses(plan.courses, filters);
  return (
    <div className="page-shell">
      <p className="eyebrow">2026 RISE · 연간 교육계획</p>
      <h1 className="page-title">평생직업교육과정 현황</h1>
      <p className="mt-3 text-slate-600">
        아카데미별 연간 계획의 과정·인력·일정·예산을 확인하세요. 실제 운영은 과정 운영 관리에서 확인합니다.
      </p>
      <section aria-label="세부 과정 전체 합산" className="my-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["세부 과정", total.count.toLocaleString("ko-KR"), "개"],
          ["세부 정원 합계", total.capacity.toLocaleString("ko-KR"), "명"],
          ["세부 시수 합계", total.hours.toLocaleString("ko-KR"), "시간"],
          ["세부 예산 합계", total.budget.toLocaleString("ko-KR"), "원"],
        ].map(([label, value, unit]) => (
          <div key={label} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-3 break-words text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {value}<span className="ml-1 text-sm font-normal">{unit}</span>
            </p>
          </div>
        ))}
      </section>

      <section aria-label="아카데미별 현황" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plan.academySummaries.map((summary) => {
          const sum = sumCourses(plan.courses.filter((c) => c.academy === summary.academy));
          return (
            <div key={summary.academy} className="rounded-xl border border-teal-100 bg-teal-50 p-5">
              <h2 className="font-bold text-teal-900">{summary.academy}</h2>
              <p className="mt-2 text-lg font-semibold">{sum.count}개 과정</p>
              <p className="mt-2 text-sm">세부 합산 {sum.capacity}명 · {sum.hours}시간</p>
              <p className="mt-1 text-sm text-slate-600">원문 소계 {summary.capacity}명 · {summary.hours}시간</p>
              <p className="mt-1 text-sm text-slate-600">원문 예산 {formatSourceNumber(summary.budget.total, "원")}</p>
              {!sum.count && <p className="mt-3 text-sm font-semibold text-amber-800">세부 과정 미기재</p>}
              {!!sum.count && summary.capacity !== sum.capacity && (
                <p className="mt-3 text-sm font-semibold text-amber-800">정원 {summary.capacity - sum.capacity}명 차이 · 확인 필요</p>
              )}
            </div>
          );
        })}
      </section>

      <details className="my-7 rounded-xl border border-amber-200 bg-amber-50 p-5">
        <summary className="cursor-pointer font-semibold text-amber-950">원문 수치와 확인할 사항</summary>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-amber-950">
          <li>원문 총계는 {plan.total.capacity}명·{plan.total.hours}시간이며 세부 합산은 {total.capacity}명·{total.hours}시간입니다.</li>
          <li>스마트테크는 소계만 있습니다. 로컬창업·팝업은 원문 소계와 세부 정원의 차이를 그대로 표시했습니다.</li>
          <li>교내·교외 구분이 없어 강사와 보조강사의 소속은 확인 필요로 표시합니다. A·B는 원문 표기입니다.</li>
          <li>모집인원·수료인원과 빈칸은 미기재로, 대시(-)와 미정은 원문대로 구분합니다.</li>
          <li>기간·요일·시수는 원문 계획입니다. 실제 회차 일정은 과정 개설 시 확인하세요. 예산은 수강료가 아닙니다.</li>
        </ul>
      </details>

      <form action="/admin/course-plan" className="mb-6 grid items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
        <label className="field">
          과정·인력 검색
          <input name="q" defaultValue={filters.q} maxLength={100} placeholder="과정명, 학부, 이름, 자격증" />
        </label>
        <label className="field">
          아카데미
          <select name="academy" defaultValue={filters.academy}>
            <option value="">전체 아카데미</option>
            {ACADEMIES.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className="field">
          강사 구분 (보조강사 포함)
          <select name="affiliation" defaultValue={filters.affiliation}>
            <option value="">전체 구분</option>
            {Object.entries(AFFILIATIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-3">
          <button className="btn-primary" type="submit">검색</button>
          <Link className="min-h-11 py-3 text-sm text-slate-600 underline" href="/admin/course-plan">초기화</Link>
        </div>
      </form>

      <p className="mb-4 text-sm text-slate-600">검색 결과 <strong className="text-slate-900">{courses.length}개 과정</strong> / 전체 {total.count}개</p>
      <div className="space-y-5">
        {courses.map((course) => (
          <article key={course.id} id={course.id} className="panel">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="badge">{course.academy}</span>
              <span className="text-xs text-slate-500">원문 {course.sourceOrder}번 · {course.task}</span>
            </div>
            <h2 className="break-words text-xl font-bold">{course.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{course.department} · {course.partner}</p>
            <dl className="mt-5 grid gap-4 sm:grid-cols-3">
              <Field label="교육기간">{course.schedule.startDate} ~ {course.schedule.endDate}</Field>
              <Field label="모집정원·시수">{course.capacity}명 · {course.hours}시간</Field>
              <Field label="요일·시간">{course.schedule.weekdays} · {course.schedule.time}</Field>
            </dl>
            <CourseDetails course={course} />
          </article>
        ))}
        {!courses.length && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <h2 className="text-lg font-semibold">
              {filters.academy === "스마트테크" ? "스마트테크 세부 과정이 원문에 없습니다" : "조건에 맞는 과정이 없습니다"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {filters.affiliation === "INTERNAL" || filters.affiliation === "EXTERNAL"
                ? "현재 원문에는 교내·교외 구분이 없습니다. 확인 필요 또는 전체 구분으로 조회하세요."
                : "다른 검색 조건을 선택하거나 전체 과정을 확인하세요."}
            </p>
            <Link className="btn-secondary mt-5" href="/admin/course-plan">전체 과정 보기</Link>
          </div>
        )}
      </div>
      <p className="mt-8 break-words text-sm text-slate-500">
        자료: {plan.source.title} · {plan.source.page}쪽. 원문 기준 현황이며 강사 소속·세부 일정·미기재 항목은 추가 확인이 필요합니다.
      </p>
    </div>
  );
}
