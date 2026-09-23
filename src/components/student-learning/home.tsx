import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, MessageCircleQuestion, Users } from "lucide-react";
import { CourseRecommendationRail } from "./course-recommendation-rail";
import { courseAttendance, nextClass, recommendCourses } from "@/lib/student-learning/model";
import { dateTime, modeLabel } from "@/lib/portal/data";
import type { LearningCourse } from "@/lib/student-learning/types";
import type { getLearnerHomeData } from "@/lib/student-learning/data";

type LearnerHomeData = Awaited<ReturnType<typeof getLearnerHomeData>>;

export function LearnerHeroSummary({
  data,
  current,
}: {
  data: LearnerHomeData;
  current: LearningCourse[];
}) {
  const next = nextClass(current, data.now);
  const pending = data.hub?.courses.filter((course) =>
    !course.active && ["SUBMITTED", "WAITLISTED", "PENDING_PAYMENT", "ACCEPTED"].includes(course.status),
  ).length ?? 0;
  return (
    <div className="self-center rounded-2xl border border-white/20 bg-white/10 p-6">
      <p className="text-sm font-semibold text-teal-200">MY LEARNING</p>
      {!data.hub ? (
        <p className="mt-4 text-sm leading-6 text-slate-200">내 학습 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>
      ) : (
        <>
          <p className="mt-3 text-2xl font-bold">내 수업 {current.length}개</p>
          {next ? (
            <div className="mt-5 border-t border-white/20 pt-5">
              <p className="text-sm text-teal-200">가장 가까운 수업</p>
              <p className="mt-2 font-semibold leading-6">{next.course.name}</p>
              <p className="mt-1 text-sm text-slate-200">{dateTime(next.session.starts_at)} · {next.session.title}</p>
              <Link href={`/learning/${next.course.id}`} className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-teal-100 hover:underline">
                강의실 입장 <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className="mt-5 border-t border-white/20 pt-5">
              <p className="text-sm leading-6 text-slate-200">
                {current.length ? "등록된 다음 수업 일정이 없습니다. 내 강의실에서 학습자료와 출석을 확인하세요."
                  : pending ? `신청한 과정 ${pending}건의 수강 확정을 기다리고 있습니다.`
                    : "수강 중인 수업이 없습니다. 관심 있는 과정을 찾아보세요."}
              </p>
              <Link href={current.length || pending ? "/mypage" : "/courses"}
                className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-teal-100 hover:underline">
                {current.length ? "나의 학습 보기" : pending ? "신청 현황 보기" : "교육과정 둘러보기"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function LearnerHome({ data, current }: { data: LearnerHomeData; current: LearningCourse[] }) {
  const recommendations = data.hub && !data.catalog.unavailable
    ? recommendCourses(data.catalog.courses, data.hub.courses, 8)
    : [];
  const pending = data.hub?.courses.some((course) =>
    !course.active && ["SUBMITTED", "WAITLISTED", "PENDING_PAYMENT", "ACCEPTED"].includes(course.status),
  );
  const today = new Date(data.now + 9 * 3600000).toISOString().slice(0, 10);
  return (
    <>
      <section id="my-classes" className="page-shell scroll-mt-24">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">MY CLASSES</p>
            <h2 className="text-3xl font-bold">내 수업</h2>
            <p className="mt-2 text-sm text-slate-600">지금 수강하는 수업의 일정·출석·강사 질문을 이어서 확인하세요.</p>
          </div>
          <Link href="/mypage" className="text-sm font-semibold text-teal-800">나의 학습 전체 보기 →</Link>
        </div>
        {!data.hub ? (
          <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
            내 수업 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.
          </div>
        ) : current.length ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {current.map((course) => {
              const next = nextClass([course], data.now)?.session;
              const attendance = courseAttendance(course, data.now);
              return <article key={course.application_id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-teal-50 px-2.5 py-1 text-teal-800">{course.starts_on > today ? "개강 예정" : "수강 중"}</span>
                  <span className="text-slate-500">{course.academy} · {modeLabel[course.mode]}</span>
                </div>
                <h3 className="mt-4 text-xl font-bold text-slate-900">{course.name}</h3>
                <p className="mt-2 text-sm text-slate-600">{course.instructors.join(" · ") || "강사 배정 안내 예정"} · {course.starts_on} ~ {course.ends_on}</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="flex items-center gap-2 text-xs font-semibold text-slate-600"><CalendarDays className="h-4 w-4 text-teal-700" aria-hidden="true" /> 다음 수업</p>
                    <p className="mt-2 text-sm font-semibold">{next ? dateTime(next.starts_at) : "등록된 다음 일정 없음"}</p>
                    {next && <p className="mt-1 text-xs text-slate-600">{next.title}</p>}
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="flex items-center gap-2 text-xs font-semibold text-slate-600"><Users className="h-4 w-4 text-teal-700" aria-hidden="true" /> 종료된 수업 기준 출석</p>
                    <p className="mt-2 text-sm font-semibold">
                      {attendance.percent === null ? (attendance.ended ? "출석 확인 중" : "수업 시작 전") : `${attendance.percent}%`}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">{attendance.missing ? `미입력 ${attendance.missing}회` : `${attendance.recorded}회 기록`}</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
                  <Link href={`/learning/${course.id}`} className="btn-primary gap-2"><BookOpen className="h-4 w-4" aria-hidden="true" /> 강의실 입장</Link>
                  <Link href={`/learning/${course.id}/attendance`} className="btn-secondary">출석 확인</Link>
                  <Link href={`/learning/${course.id}#class-questions`} className="btn-secondary gap-2"><MessageCircleQuestion className="h-4 w-4" aria-hidden="true" /> 강사에게 질문</Link>
                </div>
              </article>;
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <h3 className="text-lg font-bold">현재 수강 중인 수업이 없습니다</h3>
            <p className="mt-2 text-sm text-slate-600">{pending ? "신청한 과정의 수강 확정을 기다리고 있습니다." : "새로운 과정을 찾아 배움을 시작해 보세요."}</p>
            <Link href={pending ? "/mypage#applications" : "/courses"} className="btn-primary mt-5">
              {pending ? "신청 현황 확인" : "교육과정 찾기"}
            </Link>
          </div>
        )}
      </section>
      <section className="mx-auto max-w-7xl min-w-0 px-5 pb-14" aria-labelledby="home-recommendations-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">EXPLORE MORE</p>
            <h2 id="home-recommendations-title" className="text-2xl font-bold">다른 과정 추천</h2>
            <p className="mt-2 text-sm text-slate-600">내 수업 아래에서 다음 배움을 가볍게 살펴보세요.</p>
          </div>
          <Link href="/courses" className="text-sm font-semibold text-teal-800">전체 과정 보기 →</Link>
        </div>
        {!data.hub ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">내 학습 정보를 확인한 뒤 다른 과정을 추천할 수 있습니다.</p>
        ) : data.catalog.unavailable ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">다른 과정 정보를 불러오지 못했습니다. 전체 과정에서 다시 확인해 주세요.</p>
        ) : recommendations.length ? (
          <CourseRecommendationRail courses={recommendations} />
        ) : (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">지금 추천할 다른 과정이 없습니다. 새로운 과정이 공개되면 이곳에 표시됩니다.</p>
        )}
      </section>
    </>
  );
}
