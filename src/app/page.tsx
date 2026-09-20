import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowUpRight,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  Settings,
  Wallet,
  Award,
  BarChart3,
} from "lucide-react";
import { requireIdentity } from "@/lib/auth/session";
import { getCourseCards } from "@/lib/portal/data";
import { CourseCard, Empty } from "@/components/portal/ui";
export const metadata: Metadata = { alternates: { canonical: "/" } };
export default async function Home() {
  const me = await requireIdentity("/");
  const { offerings: courses, unavailable } = await getCourseCards(true);
  const hasRole = (role: string) => me.roles.some(item => item.role === role);
  const workLinks = [
    { role: "SYSTEM_ADMIN", href: "/admin/accounts", title: "계정 관리", description: "사업단 직책과 강사 구분 관리", icon: Settings },
    { role: "COURSE_MANAGER", href: "/admin", title: "과정 운영", description: "교육과정과 수강 신청 관리", icon: ClipboardCheck },
    { role: "FINANCE", href: "/finance", title: "수납·환불 관리", description: "수납과 환불 업무 확인", icon: Wallet },
    { role: "CERTIFIER", href: "/credentials", title: "증명 발급 관리", description: "증명 신청과 발급 업무 확인", icon: Award },
    { role: "PERFORMANCE", href: "/performance", title: "성과 관리", description: "사업 성과와 연차 보고 확인", icon: BarChart3 },
    { role: "INSTRUCTOR", href: "/instructor", title: "강사 공간", description: "담당 과정의 학습과 평가 관리", icon: GraduationCap },
  ].filter(item => hasRole(item.role));
  const shortcuts = workLinks.length ? [
    ...workLinks,
    ...(hasRole("INSTRUCTOR") ? [{ href: "/mypage/instructor", title: "강사 이력·등록 심사", description: "나의 이력과 심사 진행 상태 확인", icon: ClipboardCheck }] : []),
    { href: "/mypage", title: "나의 공간", description: "나의 신청 현황과 계정 정보 확인", icon: BookOpen },
  ] : [
    { href: "/mypage", title: "나의 강의실", description: "학습자료와 제출할 과제 확인", icon: BookOpen },
    { href: "/mypage", title: "신청 현황", description: "접수·심사·수강 확정 상태 확인", icon: ClipboardCheck },
    { href: "/mypage/history", title: "수강이력·수료 현황", description: "나의 배움과 수료 기록 확인", icon: GraduationCap },
  ];
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
              지금의 배움이,
              <br />
              <span className="text-teal-200">내일의 일로.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-200">
              새로운 기술을 익히고, 다음 경력을 준비하세요.
              <br />
              과정 신청부터 학습까지 한곳에서 함께합니다.
            </p>
            <Link
              href="/courses"
              className="mt-8 inline-flex items-center gap-8 rounded-xl bg-white px-6 py-4 font-bold text-uc-navy"
            >
              나에게 맞는 과정 찾기
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
      <section className="mx-auto max-w-7xl px-5">
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
              "모집 기준을 확인하고 나의 공간에서 접수 상태를 살펴보세요.",
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
      </section>
    </>
  );
}
