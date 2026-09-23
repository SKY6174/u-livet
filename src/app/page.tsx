import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowUpRight,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
} from "lucide-react";
import { requireIdentity } from "@/lib/auth/session";
import { hasRole, officeSections, workspaceKind } from "@/lib/auth/workspace-navigation";
import { getCourseCards, getWorkspaceOfferings } from "@/lib/portal/data";
import { getInstructorHomeSummary } from "@/lib/classroom-questions/data";
import { getAdminLearnerDocuments } from "@/lib/learner-document-workflow/data";
import { DOCUMENT_KIND_LABELS } from "@/lib/learner-document-workflow/types";
import { CourseCard, Empty } from "@/components/portal/ui";
export const metadata: Metadata = { alternates: { canonical: "/" } };
const REQUEST_KINDS = ["APPLICATION", "SCHOLARSHIP", "REFUND"] as const;
const OPEN_REQUEST_STATUSES = new Set(["RECEIVED", "REVIEWING", "APPROVED"]);
export default async function Home() {
  const me = await requireIdentity("/");
  const kind = workspaceKind(me);
  const officeGroups = kind === "office" ? officeSections(me) : [];
  const canReviewRequests = kind === "office" && hasRole(me, "SYSTEM_ADMIN", "COURSE_MANAGER", "FINANCE");
  const learnerRequests = canReviewRequests
    ? await getAdminLearnerDocuments({ kind: null, status: null, query: "" })
    : undefined;
  const openRequests = learnerRequests?.requests.filter((request) => OPEN_REQUEST_STATUSES.has(request.status));
  const instructorSummary = kind === "instructor" ? await getInstructorHomeSummary() : undefined;
  const instructorCourses = instructorSummary?.length
    ? await getWorkspaceOfferings("id", instructorSummary.map((item) => item.offering_id))
    : undefined;
  const { offerings: courses, unavailable } = kind === "learner"
    ? await getCourseCards(true)
    : { offerings: [], unavailable: false };
  const teacherLinks = [
    { href: "/instructor", title: "My Room", description: "내 정보와 과정 개발·강의·출결·이력 관리", icon: GraduationCap },
    { href: "/mypage/instructor", title: "강사 이력·등록 심사", description: "나의 이력과 심사 진행 상태 확인", icon: ClipboardCheck },
    { href: "/instructor/records", title: "강의실적·경력증명", description: "강의실적 제출과 경력 기록 확인", icon: BookOpen },
  ];
  const shortcuts = kind === "office" ? [
    ...officeGroups.flatMap(section => section.links).slice(0, 3).map(link => ({ href: link.href, title: link.label, description: link.description, icon: ClipboardCheck })),
    ...(hasRole(me, "INSTRUCTOR") ? [teacherLinks[0]] : []),
    { href: "/mypage", title: "내 정보·계정 보안", description: "개인 정보와 연결된 인증 앱 관리", icon: BookOpen },
  ] : kind === "instructor" ? teacherLinks : [
    { href: "/mypage", title: "나의 강의실", description: "수업 일정·학습자료·출석을 한눈에 확인", icon: BookOpen },
    { href: "/mypage", title: "신청 현황", description: "접수·심사·수강 확정 상태 확인", icon: ClipboardCheck },
    { href: "/mypage/history", title: "수강이력·수료 현황", description: "나의 배움과 수료 기록 확인", icon: GraduationCap },
  ];
  const welcome = kind === "office" ? {
    title: "사업단 업무를,", accent: "한곳에서.",
    description: "과정 운영부터 결과 보고·수료·증명까지 담당 업무를 확인하세요.",
    href: "/admin", action: "사업단 관리 시작하기",
  } : kind === "instructor" ? {
    title: "나의 강의와,", accent: "수강생을 한눈에.",
    description: "담당 과정의 강의자료·출결·평가와 강의실적을 관리하세요.",
    href: "/instructor", action: "My Room으로 이동",
  } : {
    title: "지금의 배움이,", accent: "내일의 일로.",
    description: "새로운 기술을 익히고, 다음 경력을 준비하세요. 과정 신청부터 학습까지 한곳에서 함께합니다.",
    href: "/courses", action: "나에게 맞는 과정 찾기",
  };
  return (
    <>
      <section className="relative overflow-hidden bg-uc-navy text-white">
        <div
          className="absolute -right-28 top-16 h-96 w-96 rounded-full border-[60px] border-white/5"
          aria-hidden="true"
        />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-[1.35fr_1fr] md:py-24">
          <div>
            <p className="mb-6 text-sm font-semibold tracking-label text-teal-200">
              U-LIFE · LIFELONG LEARNING
            </p>
            <p className="mb-4 break-words text-lg text-teal-100">{me.name} 님, 반갑습니다.</p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              {welcome.title}
              <br />
              <span className="text-teal-200">{welcome.accent}</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-200">
              {welcome.description}
            </p>
            <Link
              href={welcome.href}
              className="mt-8 inline-flex items-center gap-8 rounded-xl bg-white px-6 py-4 font-bold text-uc-navy"
            >
              {welcome.action}
              <ArrowUpRight className="h-5 w-5" />
            </Link>
          </div>
          <div className="self-center space-y-3">
            {shortcuts.map(({ href, title, description, icon: Icon }) => (
              <Link key={title} href={href}
                className="flex items-center gap-4 rounded-2xl border border-white/20 bg-white/10 p-6 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-200">
                <Icon className="h-7 w-7 shrink-0 text-teal-200" aria-hidden="true" />
                <div>
                  <strong className="block text-lg">{title}</strong>
                  <span className="text-sm text-slate-200">{description}</span>
                </div>
                <span className="ml-auto" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      {kind === "office" ? (
        <section className="page-shell">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">OFFICE WORKSPACE</p>
              <h2 className="text-3xl font-bold">사업단 운영 현황</h2>
              <p className="mt-2 text-sm text-slate-600">담당 권한에 맞는 요청과 관리 업무를 확인하세요.</p>
            </div>
            <Link href="/admin" className="text-sm font-semibold text-teal-800">업무 홈 전체 보기 →</Link>
          </div>
          {canReviewRequests && (
            <section className="mb-6 overflow-hidden rounded-2xl border border-teal-200 bg-white" aria-labelledby="home-learner-requests">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-teal-50 px-5 py-4">
                <div>
                  <h3 id="home-learner-requests" className="text-lg font-bold">수강생 요청</h3>
                  <p className="mt-1 text-sm text-slate-600">수강신청·장학금·환불 서류의 처리 현황</p>
                </div>
                <Link href="/admin/learner-documents" className="text-sm font-semibold text-teal-800">서류함 열기 →</Link>
              </div>
              {learnerRequests ? (
                <div className="grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                  {REQUEST_KINDS.map((requestKind) => (
                    <Link key={requestKind} href={`/admin/learner-documents?kind=${requestKind}`} className="flex items-center justify-between gap-3 p-5 hover:bg-teal-50">
                      <span>
                        <span className="block text-sm text-slate-600">{DOCUMENT_KIND_LABELS[requestKind]}</span>
                        <strong className="mt-1 block text-2xl tabular-nums">{openRequests?.filter((request) => request.kind === requestKind).length ?? 0}<span className="ml-1 text-sm font-medium text-slate-500">건 미종결</span></strong>
                      </span>
                      <ArrowUpRight aria-hidden="true" className="h-5 w-5 shrink-0 text-teal-700" />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="px-5 py-6 text-sm text-amber-800">요청 현황을 불러오지 못했습니다. 수강생 서류함에서 다시 확인해 주세요.</p>
              )}
            </section>
          )}
          {officeGroups.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {officeGroups.map((section) => (
                <section key={section.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label={section.title}>
                  <h3 className="mb-3 text-lg font-bold text-slate-900">{section.title}</h3>
                  <ul className="divide-y divide-slate-100">
                    {section.links.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href} className="flex items-start justify-between gap-3 py-3 text-sm hover:text-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">
                          <span>
                            <strong className="block">{link.label}</strong>
                            <span className="mt-1 block leading-5 text-slate-600">{link.description}</span>
                          </span>
                          <ArrowUpRight aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <Empty title="연결된 관리 업무가 없습니다">담당 업무 권한을 사업단 관리자에게 확인해 주세요.</Empty>
          )}
        </section>
      ) : kind === "instructor" ? (
        <section className="page-shell">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">MY CLASSES</p>
              <h2 className="text-3xl font-bold">담당 수업 현황</h2>
              <p className="mt-2 text-sm text-slate-600">수강생, 지난 수업의 출결 기록, 답변할 질문을 확인하세요.</p>
            </div>
            <Link href="/instructor" className="text-sm font-semibold text-teal-800">My Room 전체 보기 →</Link>
          </div>
          {instructorSummary === null || instructorCourses?.unavailable ? (
            <Empty title="담당 수업 현황을 불러오지 못했습니다">My Room에서 다시 확인해 주세요.</Empty>
          ) : !instructorSummary?.length ? (
            <Empty title="현재 배정된 수업이 없습니다">사업단의 강사 배정이 완료되면 이곳에 표시됩니다.</Empty>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {instructorSummary.map((item) => {
                const course = instructorCourses?.offerings.find((offering) => offering.id === item.offering_id);
                return <article key={item.offering_id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-xl font-bold">{course?.name ?? "담당 수업"}</h3>
                  <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-slate-600">수강생</dt><dd className="text-xl font-bold tabular-nums">{item.learner_count}명</dd></div>
                    <div><dt className="text-slate-600">미답변 질문</dt><dd className="text-xl font-bold tabular-nums">{item.unanswered_questions}건</dd></div>
                    <div><dt className="text-slate-600">종료된 수업</dt><dd className="text-xl font-bold tabular-nums">{item.ended_sessions}회</dd></div>
                    <div><dt className="text-slate-600">출결 기록</dt><dd className="text-xl font-bold tabular-nums">{item.attendance_records}건</dd></div>
                  </dl>
                  <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-4 text-sm font-semibold text-teal-800">
                    <Link href={`/instructor/offerings/${item.offering_id}`}>수강생·수업 관리 →</Link>
                    <Link href={`/instructor/offerings/${item.offering_id}/attendance`}>출석부 →</Link>
                    <Link href={`/instructor/offerings/${item.offering_id}#class-questions`}>질문 확인 →</Link>
                  </div>
                </article>;
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="page-shell">
          <div className="mb-7 flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">FIND YOUR NEXT STEP</p>
              <h2 className="text-3xl font-bold">함께 시작할 교육과정</h2>
            </div>
            <Link href="/courses" className="text-sm font-semibold text-teal-800">
              전체 보기 →
            </Link>
          </div>
          {courses.length ? (
            <div className="grid gap-5 md:grid-cols-3">
              {courses.map((o) => (
                <CourseCard key={o.id} offering={o} />
              ))}
            </div>
          ) : (
            <Empty
              title={
                unavailable
                  ? "교육과정 정보를 준비하고 있습니다"
                  : "공개된 교육과정이 없습니다"
              }
            >
              모집 일정과 신청 방법은 과정 공개 시 함께 안내합니다.
            </Empty>
          )}
        </section>
      )}
      {kind === "learner" && <section className="mx-auto max-w-7xl px-5">
        <div className="grid gap-6 rounded-2xl bg-teal-50 p-8 md:grid-cols-3">
          {[
            [
              "01",
              "과정 찾기",
              "목표에 맞는 교육내용과 운영 일정을 확인하세요.",
            ],
            [
              "02",
              "신청과 확인",
              "모집 기준을 확인하고 나의 학습에서 접수 상태를 살펴보세요.",
            ],
            [
              "03",
              "배움 이어가기",
              "홈페이지 안의 강의실에서 자료를 읽고 과제를 제출하세요.",
            ],
          ].map(([n, t, d]) => (
            <div key={n}>
              <span className="text-sm font-bold text-teal-700">{n}</span>
              <h3 className="mt-3 text-lg font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-slate-600">{d}</p>
            </div>
          ))}
        </div>
      </section>}
    </>
  );
}
