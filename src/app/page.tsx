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
import { getWorkspaceOfferings } from "@/lib/portal/data";
import { getInstructorHomeSummary } from "@/lib/classroom-questions/data";
import { getLearnerHomeData } from "@/lib/student-learning/data";
import { courseStage } from "@/lib/student-learning/model";
import { LearnerHeroSummary, LearnerHome } from "@/components/student-learning/home";
import { getAdminLearnerDocuments } from "@/lib/learner-document-workflow/data";
import { DOCUMENT_KIND_LABELS } from "@/lib/learner-document-workflow/types";
import { Empty } from "@/components/portal/ui";
import { MenuHint } from "@/components/navigation/menu-hint";
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
  const learnerHome = kind === "learner" ? await getLearnerHomeData() : undefined;
  const today = learnerHome ? new Date(learnerHome.now + 9 * 3600000).toISOString().slice(0, 10) : "";
  const currentCourses = learnerHome?.hub?.courses.filter((course) => courseStage(course, today) === "current") ?? [];
  const teacherLinks = [
    { href: "/instructor", title: "My Room", description: "내 정보와 과정 개발·강의·출결·이력 관리", icon: GraduationCap },
    { href: "/mypage/instructor", title: "강사 이력·등록 심사", description: "나의 이력과 심사 진행 상태 확인", icon: ClipboardCheck },
    { href: "/instructor/records", title: "강의실적·경력증명", description: "강의실적 제출과 경력 기록 확인", icon: BookOpen },
  ];
  const shortcuts = kind === "office" ? [
    ...officeGroups.flatMap(section => section.links).slice(0, 3).map(link => ({ href: link.href, title: link.label, description: link.description, icon: ClipboardCheck })),
    ...(hasRole(me, "INSTRUCTOR") ? [teacherLinks[0]] : []),
    { href: "/mypage", title: "내 정보·계정 보안", description: "개인 정보와 연결된 인증 앱 관리", icon: BookOpen },
  ] : kind === "instructor" ? teacherLinks : [];
  const welcome = kind === "office" ? {
    title: "사업단 업무를,", accent: "한곳에서.",
    description: "과정 운영부터 결과 보고·수료·증명까지 담당 업무를 확인하세요.",
    href: "/admin", action: "사업단 관리 시작하기",
  } : kind === "instructor" ? {
    title: "나의 강의와,", accent: "수강생을 한눈에.",
    description: "담당 과정의 강의자료·출결·평가와 강의실적을 관리하세요.",
    href: "/instructor", action: "My Room으로 이동",
  } : {
    title: "나의 수업을,", accent: "이어가세요.",
    description: "내 수업 일정과 출석을 확인하고, 강의실에서 학습과 질문을 이어가세요.",
    href: learnerHome?.hub === null ? "/mypage" : currentCourses.length ? "#my-classes" : "/courses",
    action: learnerHome?.hub === null ? "나의 학습 다시 확인" : currentCourses.length ? "내 수업 바로가기" : "교육과정 찾기",
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
              U-LiVE · LIFELONG LEARNING
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
          {kind === "learner" && learnerHome ? <LearnerHeroSummary data={learnerHome} current={currentCourses} /> : (
            <div className="self-center space-y-3">
              {shortcuts.map(({ href, title, description, icon: Icon }) => (
                <Link key={title} href={href}
                  className="group relative flex items-center gap-4 rounded-2xl border border-white/20 bg-white/10 p-6 hover:z-10 hover:bg-white/15 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-200">
                  <Icon className="h-7 w-7 shrink-0 text-teal-200" aria-hidden="true" />
                  <strong className="text-lg"><MenuHint label={title} description={description} /></strong>
                  <span className="ml-auto" aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
      {kind === "office" ? (
        <section className="page-shell">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">OFFICE WORKSPACE</p>
              <h2 className="text-3xl font-bold">사업단 운영 현황</h2>
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
                        <Link href={link.href} className="group relative flex items-start justify-between gap-3 py-3 text-sm hover:z-10 hover:text-teal-800 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">
                          <strong><MenuHint label={link.label} description={link.description} /></strong>
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
      ) : learnerHome ? (
        <LearnerHome data={learnerHome} current={currentCourses} />
      ) : null}
    </>
  );
}
