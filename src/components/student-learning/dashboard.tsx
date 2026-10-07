import Link from "next/link";
import { MenuHint } from "@/components/navigation/menu-hint";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  GraduationCap,
  Heart,
  Lightbulb,
  MapPin,
  MessageSquare,
  Plus,
  Settings2,
  Sparkles,
  Ticket,
  UserRound,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ActionForm } from "@/components/portal/action-form";
import { DocumentPopup } from "@/components/instructor-documents/document-popup";
import { applicationDocumentHref } from "@/lib/learner-documents/model";
import { LearningRecordJourney } from "@/components/student-learning/learning-record-journey";
import { decideApplication } from "@/app/actions";
import { submitLearningRequest } from "@/app/learning-request-actions";
import { attendanceState } from "@/lib/attendance/model";
import { dateTime, modeLabel, statusLabel } from "@/lib/portal/data";
import { outcomeLabels } from "@/lib/portal/evaluation";
import {
  courseAttendance,
  courseStage,
  nextClass,
  recommendCourses,
  requestLabels,
} from "@/lib/student-learning/model";
import type { LearningCourse } from "@/lib/student-learning/types";
import type { StudentLearningData } from "@/lib/student-learning/data";

const shortDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));
const time = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
const sectionClass = "scroll-mt-40";
function SectionTitle({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-teal-700">{number}</span>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
            {title}
          </h2>
        </div>
        {description && (
          <p className="mt-2 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}
function TextLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 items-center gap-2 text-base font-semibold text-teal-800 hover:underline"
    >
      {children}
      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}
function Missing({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
    >
      {children}{" "}
      <Link className="underline" href="/mypage">
        다시 불러오기
      </Link>
    </p>
  );
}
function ServiceLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex min-w-0 items-center gap-4 rounded-xl border border-slate-200/80 bg-white p-4 transition hover:z-10 hover:border-teal-300 hover:bg-teal-50/40 focus-visible:z-10"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-teal-800">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-slate-800"><MenuHint label={title} description={description} /></h3>
      </div>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-teal-700"
        aria-hidden="true"
      />
    </Link>
  );
}
function CourseCard({
  course: c,
  now,
}: {
  course: LearningCourse;
  now: number;
}) {
  const attendance = courseAttendance(c, now);
  const session = nextClass([c], now)?.session;
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/30">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md bg-teal-50 px-2.5 py-1 font-semibold text-teal-800">
            {c.starts_on >
            new Date(now + 9 * 3600000).toISOString().slice(0, 10)
              ? "개강 예정"
              : "학습 중"}
          </span>
          <span className="text-slate-500">
            {c.academy} · {modeLabel[c.mode]}
          </span>
        </div>
        <h3 className="mt-3 text-xl font-bold leading-snug text-slate-900">
          {c.name}
        </h3>
        <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
          <p className="flex items-start gap-2">
            <UserRound
              className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
              aria-hidden="true"
            />
            {c.instructors.join(" · ") || "강사 배정 안내 예정"}
          </p>
          <p className="flex items-start gap-2">
            <MapPin
              className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
              aria-hidden="true"
            />
            {c.location}
          </p>
          <p className="flex items-start gap-2 sm:col-span-2">
            <CalendarDays
              className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
              aria-hidden="true"
            />
            {c.starts_on} ~ {c.ends_on}
          </p>
        </div>
        {session && (
          <div className="mt-5 flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <Clock3
              className="mt-0.5 h-4 w-4 shrink-0 text-teal-700"
              aria-hidden="true"
            />
            <p>
              <strong className="mr-2 font-semibold text-teal-800">
                다음 수업
              </strong>
              {shortDate(session.starts_at)} {time(session.starts_at)}–
              {time(session.ends_at)}
              <span className="mt-1 block text-slate-500">{session.title}</span>
            </p>
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
          <div>
            <p className="text-xs text-slate-500">종료된 수업 기준 출석률</p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {attendance.percent === null ? (
                <span className="text-base">
                  {attendance.ended ? "출석 확인 중" : "수업 시작 전"}
                </span>
              ) : (
                `${attendance.percent}%`
              )}
              <span className="ml-2 text-xs font-normal text-slate-500">
                {attendance.missing
                  ? `미입력 ${attendance.missing}회`
                  : `${attendance.recorded}회 기록`}
              </span>
            </p>
          </div>
          <Link href={`/learning/${c.id}`} className="btn-primary gap-2">
            강의실 입장
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
      <details className="group border-t border-slate-100">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 bg-slate-50/60 px-5 py-3 text-sm font-semibold text-slate-700 sm:px-6">
          주차별 학습·출석·이수 기준
          <Plus
            className="h-4 w-4 transition group-open:rotate-45"
            aria-hidden="true"
          />
        </summary>
        <div className="space-y-6 border-t border-slate-100 p-5 sm:p-6">
          <div>
            <h4 className="mb-3 font-semibold">수업 일정과 출석</h4>
            {!c.sessions.length ? (
              <p className="text-sm text-slate-500">
                수업 일정이 등록되면 회차별 학습내용과 출석이 표시됩니다.
              </p>
            ) : (
              <ol className="divide-y divide-slate-100">
                {c.sessions.map((s, index) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-start gap-3 py-3"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{s.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {shortDate(s.starts_at)} · {time(s.starts_at)}–
                        {time(s.ends_at)}
                      </p>
                      {s.status === "CANCELLED" && s.reason && (
                        <p className="mt-1 text-xs text-amber-800">
                          휴강 사유: {s.reason}
                        </p>
                      )}
                    </div>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      {attendanceState(
                        s,
                        s.credited_minutes === null
                          ? undefined
                          : {
                              session_id: s.id,
                              person_id: "self",
                              credited_minutes: s.credited_minutes,
                              reason: "",
                              revision: 0,
                              recorded_at: "",
                            },
                        now,
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <TextLink href={`/learning/${c.id}/attendance`}>
              출석 상세 보기
            </TextLink>
          </div>
          <div>
            <h4 className="mb-3 font-semibold">주차별 학습자료</h4>
            {!c.lessons.length ? (
              <p className="text-sm text-slate-500">
                강사가 공개한 학습자료가 이곳에 표시됩니다.
              </p>
            ) : (
              <ul className="space-y-2">
                {c.lessons.map((l) => (
                  <li key={l.id}>
                    <Link
                      className="flex min-h-12 items-center gap-3 rounded-lg bg-slate-50 p-3 text-base hover:bg-teal-50"
                      href={`/learning/${c.id}`}
                    >
                      <BookOpen
                        className="h-4 w-4 shrink-0 text-teal-700"
                        aria-hidden="true"
                      />
                      <span className="flex-1">
                        {l.position}. {l.title}
                      </span>
                      {l.read && (
                        <span className="text-xs text-teal-700">읽음</span>
                      )}
                      <ChevronRight
                        className="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl bg-teal-50/70 p-4">
            <h4 className="flex items-center gap-2 font-semibold text-teal-900">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />이 과목의
              이수 기준
            </h4>
            {c.completion ? (
              <>
                <div className="my-3 flex flex-wrap gap-2">
                  {[
                    ["출석", c.completion.attendance_percent, "% 이상"],
                    ["과제별", c.completion.assignment_min, "점 이상"],
                    ["시험별", c.completion.quiz_min, "점 이상"],
                  ].map(
                    ([label, value, unit]) =>
                      value !== null && (
                        <span
                          key={String(label)}
                          className="rounded-md bg-white px-3 py-1 text-xs font-semibold text-teal-800"
                        >
                          {label} {value}
                          {unit}
                        </span>
                      ),
                  )}
                </div>
                <p className="text-xs font-semibold text-teal-800">
                  {c.completion.title} · {c.completion.version}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-teal-900">
                  {c.completion.body}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-teal-900">
                이수 기준 안내를 준비하고 있습니다. 사업단의 확정 안내를 확인해
                주세요.
              </p>
            )}
            <p className="mt-3 text-xs text-teal-800">
              자료 열람과 공식 출석은 별도이며, 수료는 사업단의 최종 확인 후
              확정됩니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-5">
            <TextLink href={`/learning/${c.id}/evaluation`}>
              시험·평가 확인
            </TextLink>
            <TextLink href="/mypage/payments">납부·환불 확인</TextLink>
          </div>
          <details>
            <summary className="cursor-pointer text-xs text-slate-500 underline">
              수강 신청 취소
            </summary>
            <div className="mt-3">
              <p className="mb-3 text-sm text-slate-600">
                취소하면 강의실 이용이 종료됩니다. 납부한 과정은 납부·환불에서
                환불을 신청해 주세요.
              </p>
              <ActionForm action={decideApplication} label="신청 취소 확정">
                <input
                  type="hidden"
                  name="application"
                  value={c.application_id}
                />
                <input type="hidden" name="decision" value="CANCELLED" />
              </ActionForm>
            </div>
          </details>
        </div>
      </details>
    </article>
  );
}

export function StudentDashboard({
  name,
  data,
}: {
  name: string;
  data: StudentLearningData;
}) {
  const { hub, history, surveys, catalog, now } = data;
  const today = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
  const courses = hub?.courses ?? [];
  const current = courses.filter((c) => courseStage(c, today) === "current");
  const applications = courses.filter(
    (c) => courseStage(c, today) === "application",
  );
  const pending = applications.filter((c) =>
    ["SUBMITTED", "WAITLISTED", "PENDING_PAYMENT"].includes(c.status),
  );
  const next = nextClass(courses, now);
  const surveyTasks =
    surveys?.filter((s) => !s.submitted_at && !s.closed && s.policy_valid) ??
    [];
  const completed = history?.filter((h) => h.approved_at && !h.stale).length;
  const recommendations = recommendCourses(catalog.courses, courses);
  const paid = hub?.scholarships
    .filter((s) => s.paid_on)
    .reduce((sum, s) => sum + s.amount, 0);
  const metrics = [
    {
      label: "나의 수업",
      value: hub ? current.length : "—",
      unit: "과정",
      icon: BookOpen,
      href: "#my-classes",
    },
    {
      label: "신청·납부 대기",
      value: hub ? pending.length : "—",
      unit: "건",
      icon: Clock3,
      href: "#applications",
    },
    {
      label: "수료한 과정",
      value: completed ?? "—",
      unit: "과정",
      icon: GraduationCap,
      href: "#learning-record",
    },
    {
      label: "참여할 만족도 조사",
      value: surveys ? surveyTasks.length : "—",
      unit: "건",
      icon: MessageSquare,
      href: "/mypage/surveys",
    },
  ];
  return (
    <div className="mx-auto max-w-7xl px-5 py-8 md:py-10">
      <header className="relative isolate overflow-hidden rounded-3xl bg-[#102d50] p-6 text-white sm:p-8 md:p-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-44 -z-10 h-[440px] w-[440px] rounded-full border-[70px] border-teal-200/[0.06]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-44 right-24 -z-10 h-80 w-80 rounded-full border border-teal-200/10"
        />
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-label text-teal-200">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-200" />
              MY LEARNING JOURNEY
            </p>
            <h1 className="page-title mb-0">
              {name}님의 학습
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
              오늘의 배움이, 내일의 가능성으로.
              <br className="sm:hidden" /> 나의 모든 학습을 한곳에서 이어가세요.
            </p>
          </div>
          <Link
            href="/courses"
            className="inline-flex min-h-12 items-center justify-center gap-6 rounded-xl bg-[#b0f1df] px-5 py-3 text-sm font-bold text-[#143d43] transition hover:bg-teal-100"
          >
            새로운 배움 찾기
            <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 border-t border-white/15 pt-6 md:grid-cols-4 md:gap-6">
          {metrics.map(({ label, value, unit, icon: Icon, href }) => (
            <Link
              key={label}
              href={href}
              className="group rounded-xl p-2 transition hover:bg-white/10"
            >
              <p className="flex items-center gap-2 text-xs text-slate-300">
                <Icon className="h-4 w-4 text-teal-200" aria-hidden="true" />
                {label}
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {value}
                <span className="ml-2 text-xs font-normal text-slate-300">
                  {unit}
                </span>
                <ChevronRight
                  className="ml-2 inline h-4 w-4 text-teal-200 opacity-0 group-hover:opacity-100"
                  aria-hidden="true"
                />
              </p>
            </Link>
          ))}
        </div>
      </header>
      <nav
        aria-label="나의 학습 바로가기"
        className="mb-9 mt-5 flex flex-wrap gap-x-6 gap-y-1 border-b border-slate-200 px-1"
      >
        {[
          ["#my-classes", "내 강의실"],
          ["#learning-record", "학습 기록"],
          ["#scholarships", "장학금·혜택"],
          ["#next-learning", "추천 과정"],
          ["#course-request", "희망 과목 제안"],
        ].map(([href, label], i) => (
          <a
            key={href}
            href={href}
            className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-1 text-sm font-semibold transition ${i === 0 ? "border-teal-700 text-teal-800" : "border-transparent text-slate-500 hover:border-teal-200 hover:text-teal-800"}`}
          >
            {label}
            {i === 0 && <ArrowDown className="h-3 w-3" aria-hidden="true" />}
          </a>
        ))}
      </nav>

      <section className="mb-8 flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-teal-100 bg-white p-5 sm:p-6" aria-label="수강생 작성 서류">
        <div className="flex items-center gap-4">
          <span className="rounded-xl bg-teal-50 p-3 text-teal-800"><Check className="h-5 w-5" aria-hidden="true" /></span>
          <div><h2 className="font-bold text-slate-900">수강생 작성 서류</h2><p className="mt-1 text-sm text-slate-500">정보 입력부터 서명까지, 원본 서식으로 간편하게 작성하세요.</p></div>
        </div>
        <div className="flex flex-wrap gap-3">
          <DocumentPopup href="/mypage/documents" windowName="learner-documents" className="btn-primary gap-2">수강생 서류 작성 <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></DocumentPopup>
        </div>
      </section>

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section id="my-classes" className={sectionClass}>
          <SectionTitle
            number="01"
            title="내 강의실"
            description="수업 준비부터 출석 확인까지, 여기서 시작하세요."
          >
            <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
              {hub ? `${current.length}개 과정` : "확인 중"}
            </span>
          </SectionTitle>
          {!hub ? (
            <Missing>학습 정보를 불러오지 못했습니다.</Missing>
          ) : current.length ? (
            <div className="space-y-4">
              {current.map((c) => (
                <CourseCard key={c.application_id} course={c} now={now} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center sm:p-10">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-800">
                <BookOpen
                  className="h-8 w-8"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </div>
              <h3 className="mt-5 text-lg font-bold text-slate-900">
                새로운 배움을 시작해 볼까요?
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                {pending.length
                  ? "신청한 과정의 확정을 기다리고 있어요. 아래에서 신청 상태를 확인하세요."
                  : "관심 있는 과정을 찾아 수강 신청해 보세요. 수업 일정과 학습자료, 나의 출석이 이곳에 모입니다."}
              </p>
              <Link className="btn-primary mt-6 gap-3" href="/courses">
                교육과정 둘러보기
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <div className="mt-7 flex flex-wrap justify-center gap-4 border-t border-slate-100 pt-5 text-xs text-slate-500">
                {["과정 선택", "수강 신청", "학습 시작"].map((s, i) => (
                  <span key={s} className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold">
                      {i + 1}
                    </span>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div id="applications" className="mt-6 scroll-mt-40">
            <details
              open={pending.length > 0}
              className="rounded-2xl border border-slate-200 bg-white"
            >
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 p-5 text-xl font-semibold">
                신청 현황
                <span className="flex items-center gap-3 text-slate-500">
                  {hub ? `${applications.length}건` : "확인 중"}
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </span>
              </summary>
              <div className="border-t border-slate-100 px-5 pb-5">
                {!hub ? (
                  <p className="pt-4 text-sm text-slate-500">
                    신청 현황을 불러오지 못했습니다.
                  </p>
                ) : !applications.length ? (
                  <p className="pt-4 text-sm text-slate-500">
                    대기 중이거나 취소한 신청이 없습니다.
                  </p>
                ) : (
                  applications.map((c) => (
                    <article
                      key={c.application_id}
                      className="border-b border-slate-100 py-4 last:border-b-0"
                    >
                      <span className="badge">
                        {statusLabel[c.status] ?? c.status}
                      </span>
                      <h3 className="mt-3 break-words text-xl font-semibold">{c.name}</h3>
                      <p className="mt-2 text-base text-slate-600">
                        신청일시 {dateTime(c.submitted_at)}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <TextLink href={`/offerings/${c.id}`}>
                          과정 정보
                        </TextLink>
                        <TextLink href={`/mypage/applications/${c.application_id}`}>신청 상세·처리 이력</TextLink>
                        <DocumentPopup href={applicationDocumentHref(c.id)} windowName="learner-documents" className="btn-secondary">수강신청원서 작성</DocumentPopup>
                        {c.status === "PENDING_PAYMENT" && (
                          <Link className="btn-primary" href="/mypage/payments">
                            납부 안내 확인
                          </Link>
                        )}
                        {[
                          "SUBMITTED",
                          "WAITLISTED",
                          "PENDING_PAYMENT",
                          "ACCEPTED",
                        ].includes(c.status) && (
                          <details>
                            <summary className="flex min-h-12 cursor-pointer items-center text-base text-slate-600 underline">
                              신청 취소
                            </summary>
                            <div className="mt-3">
                              <p className="mb-3 text-xs text-slate-600">
                                취소하면 수강할 수 없습니다. 납부한 과정은
                                납부·환불에서 확인하세요.
                              </p>
                              <ActionForm
                                action={decideApplication}
                                label="신청 취소 확정"
                              >
                                <input
                                  type="hidden"
                                  name="application"
                                  value={c.application_id}
                                />
                                <input
                                  type="hidden"
                                  name="decision"
                                  value="CANCELLED"
                                />
                              </ActionForm>
                            </div>
                          </details>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </details>
          </div>
        </section>
        <aside className="space-y-5 lg:pt-1" aria-label="학습 일정과 할 일">
          <section className="rounded-2xl border border-teal-100 bg-gradient-to-br from-[#edf8f3] to-[#f3f9f8] p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-teal-950">다가오는 수업</h2>
              <CalendarDays
                className="h-5 w-5 text-teal-700"
                aria-hidden="true"
              />
            </div>
            {next ? (
              <>
                <p className="mt-6 text-2xl font-bold tracking-tight text-teal-950">
                  {shortDate(next.session.starts_at)}
                </p>
                <p className="mt-1 font-medium text-teal-800">
                  {time(next.session.starts_at)}–{time(next.session.ends_at)}
                </p>
                <div className="my-5 border-t border-teal-200/60 pt-4">
                  <p className="font-semibold text-teal-950">
                    {next.course.name}
                  </p>
                  <p className="mt-2 text-sm text-teal-800">
                    {next.session.title}
                  </p>
                  <p className="mt-3 flex items-start gap-2 text-sm text-teal-800">
                    <MapPin
                      className="mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    {next.course.location}
                  </p>
                </div>
                <TextLink href={`/learning/${next.course.id}`}>
                  수업 준비하기
                </TextLink>
              </>
            ) : (
              <>
                <p className="mt-5 text-sm font-semibold text-teal-950">
                  {hub ? "예정된 수업이 없습니다" : "일정을 확인할 수 없습니다"}
                </p>
                <p className="mt-2 text-sm leading-6 text-teal-800">
                  확정된 수업 일정이 등록되면 가장 가까운 수업부터 안내해
                  드려요.
                </p>
              </>
            )}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="flex items-center gap-2 font-bold">
              <Check className="h-5 w-5 text-teal-700" aria-hidden="true" />
              지금 확인해 주세요
            </h2>
            <div className="mt-4 divide-y divide-slate-100">
              {pending
                .filter((c) => c.status === "PENDING_PAYMENT")
                .map((c) => (
                  <Link
                    key={c.id}
                    href="/mypage/payments"
                    className="block py-3 text-sm"
                  >
                    <span className="font-semibold text-amber-800">
                      수강료 납부 대기
                    </span>
                    <span className="mt-1 block text-slate-500">{c.name}</span>
                  </Link>
                ))}
              {surveyTasks.map((s) => (
                <Link
                  key={s.id}
                  href="/mypage/surveys"
                  className="block py-3 text-sm"
                >
                  <span className="font-semibold text-teal-800">
                    만족도 조사 참여
                  </span>
                  <span className="mt-1 block text-slate-500">{s.name}</span>
                  <span className="mt-1 block text-xs text-slate-400">
                    {shortDate(s.closes_at)} 마감
                  </span>
                </Link>
              ))}
              {(!hub || !surveys) && (
                <p className="py-3 text-sm text-amber-800">
                  일부 할 일을 불러오지 못했습니다. 납부·조사 화면에서 확인해
                  주세요.
                </p>
              )}
              {hub &&
                surveys &&
                !pending.some((c) => c.status === "PENDING_PAYMENT") &&
                !surveyTasks.length && (
                  <p className="py-3 text-sm leading-6 text-slate-500">
                    현재 납부 대기나 참여할 조사가 없어요. 나의 속도로 배움을
                    이어가세요.
                  </p>
                )}
            </div>
            <TextLink href="/mypage/notifications">
              연락처·알림 수신 설정
            </TextLink>
          </section>
        </aside>
      </div>

      <section id="learning-record" className={`${sectionClass} mt-12`}>
        <SectionTitle
          number="02"
          title="차곡차곡, 나의 배움"
          description="지난 수업과 수료의 순간을 기록으로 남겨요."
        >
          <TextLink href="/mypage/history">전체 수강이력</TextLink>
        </SectionTitle>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            {history === null ? (
              <Missing>수강이력을 불러오지 못했습니다.</Missing>
            ) : !history.length ? (
              <div className="flex h-full min-h-32 items-center gap-5">
                <GraduationCap
                  className="h-11 w-11 shrink-0 text-slate-300"
                  strokeWidth={1.3}
                  aria-hidden="true"
                />
                <div>
                  <h3 className="font-semibold text-slate-800">
                    나만의 학습 기록을 채워보세요
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    수강한 과정과 공식 수료 결과가 이곳에 남습니다.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {history.slice(0, 4).map((h) => (
                  <li
                    key={h.offering_id}
                    className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{h.name}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {h.approved_at && !h.stale
                          ? `수료 확정 ${shortDate(h.approved_at)}`
                          : h.stale
                            ? "자료 변경으로 다시 확인하고 있어요"
                            : "공식 수료 결과를 확인하세요"}
                      </p>
                      {courses.some(
                        (c) => c.id === h.offering_id && c.active,
                      ) && (
                        <TextLink href={`/learning/${h.offering_id}`}>
                          강의실 다시 보기
                        </TextLink>
                      )}
                    </div>
                    <Link
                      href="/mypage/history"
                      className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-teal-50"
                    >
                      {h.stale
                        ? "재검토 필요"
                        : h.approved_at
                          ? "수료 완료"
                          : h.outcome
                            ? outcomeLabels[h.outcome]
                            : "수료 검토 전"}
                      <ChevronRight
                        className="ml-1 inline h-3 w-3"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-3">
            <ServiceLink
              href="/mypage/certificates"
              icon={Award}
              title="사업단 이수증 신청·발급"
              description="U-LiVET 과정의 수료 확정 후 신청"
            />
            <ServiceLink
              href="/mypage/badges"
              icon={GraduationCap}
              title="나의 디지털배지"
              description="쌓아온 역량과 성취 확인"
            />
          </div>
        </div>
        <LearningRecordJourney />
      </section>

      <section id="scholarships" className={`${sectionClass} mt-12`}>
        <SectionTitle
          number="03"
          title="배움을 응원하는 혜택"
          description="장학금 지급 기록과 수강료를 확인하세요."
        />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
              <div>
                <h3 className="flex items-center gap-2 font-semibold">
                  <Heart className="h-5 w-5 text-teal-700" aria-hidden="true" />
                  나의 장학금
                </h3>
                <p className="mt-2 text-xs text-slate-500">
                  사업단에 등록된 지급일 기준
                </p>
              </div>
              <p className="text-3xl font-bold tracking-tight text-teal-800">
                {paid === undefined ? "—" : paid.toLocaleString("ko-KR")}
                <span className="ml-1 text-sm font-normal text-slate-500">
                  원
                </span>
              </p>
            </div>
            <div className="border-t border-slate-100 px-5 pb-5 sm:px-6">
              {!hub ? (
                <p className="pt-4 text-sm text-amber-800">
                  장학금 내역을 불러오지 못했습니다.
                </p>
              ) : !hub.scholarships.length ? (
                <p className="py-5 text-sm text-slate-500">
                  아직 등록된 장학금 내역이 없습니다. 대상 여부와 지급 일정은
                  과정별 사업단 안내를 확인해 주세요.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {hub.scholarships.map((s, i) => (
                    <li
                      key={`${s.offering_id}-${i}`}
                      className="flex flex-wrap justify-between gap-3 py-4"
                    >
                      <div>
                        <p className="text-sm font-semibold">{s.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {s.category} ·{" "}
                          {s.paid_on ? `지급일 ${s.paid_on}` : "지급일 확인 중"}
                        </p>
                      </div>
                      <p className="text-sm font-bold">
                        {s.amount.toLocaleString("ko-KR")}원
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs leading-5 text-slate-400">
                사업단의 지급 기록이며, 실제 입금 여부는 본인 계좌에서도 확인해
                주세요.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <ServiceLink
              href="/parking"
              icon={Ticket}
              title="무료 주차권 신청"
              description="교육일 주차권 신청과 승인 상태 확인"
            />
            <ServiceLink
              href="/mypage/payments"
              icon={Wallet}
              title="나의 납부·환불"
              description="납부 안내와 처리 현황 확인"
            />
            <ServiceLink
              href="/mypage/surveys"
              icon={MessageSquare}
              title="수업에 대한 의견 남기기"
              description="더 나은 수업을 만드는 만족도 조사"
            />
            <p className="px-2 text-xs leading-5 text-slate-500">
              만족도 조사는 자율 참여이며 수료·증명 발급에 영향을 주지 않습니다.
            </p>
          </div>
        </div>
      </section>

      <section id="next-learning" className={`${sectionClass} mt-12`}>
        <SectionTitle
          number="04"
          title="다음 배움도, 나답게"
          description={
            courses.length
              ? "나의 수강 분야와 연결되는 과정을 먼저 모았어요."
              : "새로운 관심사를 발견할 수 있는 교육과정을 만나보세요."
          }
        >
          <TextLink href="/courses">모든 과정 보기</TextLink>
        </SectionTitle>
        {catalog.unavailable && (
          <Missing>추천 과정의 일부 정보를 불러오지 못했습니다.</Missing>
        )}
        {!recommendations.length && !catalog.unavailable ? (
          <div className="panel text-sm text-slate-500">
            새로운 교육과정을 준비하고 있습니다.{" "}
            <TextLink href="/courses">교육과정 확인</TextLink>
          </div>
        ) : (
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            {recommendations.map((c, i) => (
              <Link
                key={c.id}
                href={c.href}
                className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-teal-300 hover:shadow-md motion-reduce:transform-none"
              >
                <div className="mb-5 flex items-center justify-between">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${i === 1 ? "bg-indigo-50 text-indigo-700" : i === 2 ? "bg-amber-50 text-amber-700" : "bg-teal-50 text-teal-700"}`}
                  >
                    <Sparkles className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {c.related ? "같은 분야 추천" : "새로운 분야 탐색"}
                  </span>
                </div>
                <p className="text-xs font-semibold text-teal-700">
                  {c.academy}
                </p>
                <h3 className="mt-2 text-lg font-bold leading-snug text-slate-900">
                  {c.name}
                </h3>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">
                  {c.summary}
                </p>
                <div className="mt-auto pt-6">
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
                    <span className="text-slate-500">
                      {modeLabel[c.mode]}
                      {c.teaching_hours ? ` · ${c.teaching_hours}시간` : ""}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-teal-800">
                      과정 살펴보기
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs leading-5 text-slate-400">
          동일 교육 분야를 기준으로 제안합니다. 모집 여부·신청 자격은 각
          과정에서 확인해 주세요.
        </p>
      </section>

      <section
        id="course-request"
        className={`${sectionClass} mt-12 overflow-hidden rounded-2xl border border-teal-100 bg-[#eff7f4]`}
      >
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_1.2fr] md:gap-10 md:p-8">
          <div>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-teal-800">
              <Lightbulb className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="mb-2 mt-5 text-xs font-semibold tracking-[0.12em] text-teal-700">
              LEARNING STARTS WITH YOU
            </p>
            <h2 className="text-2xl font-bold leading-snug tracking-tight text-teal-950">
              배우고 싶은 수업,
              <br />
              직접 제안해 주세요.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-teal-800">
              일에 필요한 기술부터 꼭 도전하고 싶었던 취미까지. 여러분의 제안이
              다음 교육과정의 시작이 됩니다.
            </p>
            <p className="mt-4 text-xs leading-5 text-teal-700">
              사업단이 수요를 검토한 뒤 결과를 안내합니다.
              <br />
              제안 접수가 실제 개설이나 수강 신청을 의미하지는 않습니다.
            </p>
          </div>
          {!hub ? (
            <Missing>과목 제안 정보를 불러오지 못했습니다.</Missing>
          ) : !hub.organizations.length ? (
            <div className="self-center rounded-xl bg-white p-5 text-sm text-slate-600">
              소속 기관 정보를 확인할 수 없습니다. 사업단에 문의해 주세요.
            </div>
          ) : (
            <div className="rounded-2xl bg-white p-5 sm:p-6">
              <ActionForm
                action={submitLearningRequest}
                label="희망 과목 제안하기"
              >
                <label className="field">
                  배우고 싶은 과목명
                  <input
                    name="title"
                    placeholder="예: 업무에 바로 쓰는 생성형 AI"
                    minLength={2}
                    maxLength={100}
                    required
                  />
                </label>
                <label className="field">
                  어떤 내용을 배우고 싶으신가요?
                  <textarea
                    name="goal"
                    placeholder="배우고 싶은 내용과 활용하고 싶은 곳을 10자 이상 적어주세요."
                    rows={3}
                    minLength={10}
                    maxLength={2000}
                    required
                  />
                </label>
                <label className="field">
                  희망 요일·시간 <span className="sr-only">선택 입력</span>
                  <input
                    name="schedule"
                    placeholder="예: 평일 저녁, 토요일 오전 (선택)"
                    maxLength={200}
                  />
                </label>
                {hub.organizations.length === 1 ? (
                  <input
                    type="hidden"
                    name="org"
                    value={hub.organizations[0].id}
                  />
                ) : (
                  <label className="field">
                    제안할 기관
                    <select name="org" required>
                      {hub.organizations.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <p className="text-xs text-slate-500">
                  연락처·계좌번호 등 개인정보는 적지 마세요.
                </p>
              </ActionForm>
            </div>
          )}
        </div>
        {!!hub?.requests.length && (
          <details className="border-t border-teal-200/60 px-6 py-4 md:px-8">
            <summary className="cursor-pointer text-sm font-semibold text-teal-900">
              내가 제안한 과목 {hub.requests.length}건
            </summary>
            <ul className="mt-4 space-y-3">
              {hub.requests.map((r) => (
                <li key={r.id} className="rounded-xl bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{r.title}</h3>
                    <span className="badge">{requestLabels[r.status]}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                    {r.goal}
                  </p>
                  {r.preferred_schedule && (
                    <p className="mt-2 text-xs text-slate-500">
                      희망 시간: {r.preferred_schedule}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-400">
                    접수 {dateTime(r.created_at)}
                  </p>
                  {r.response && (
                    <p className="mt-3 whitespace-pre-wrap rounded-lg bg-teal-50 p-3 text-sm text-teal-900">
                      <strong className="mb-1 block">사업단 답변</strong>
                      {r.response}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
      <footer className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6 text-sm text-slate-500">
        <p className="flex items-center gap-2">
          <Settings2 className="h-4 w-4" aria-hidden="true" />내 정보 관리
        </p>
        <div className="flex flex-wrap gap-5">
          <Link
            className="inline-flex min-h-12 items-center hover:text-teal-800"
            href="/mypage/notifications"
          >
            연락처·수신 설정
          </Link>
          <Link
            className="inline-flex min-h-12 items-center hover:text-teal-800"
            href="/auth/security"
          >
            계정 보안·추가 인증
          </Link>
        </div>
      </footer>
    </div>
  );
}
