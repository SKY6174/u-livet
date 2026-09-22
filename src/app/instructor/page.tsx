import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWorkspaceOfferings } from "@/lib/portal/data";
import { Empty, PageIntro } from "@/components/portal/ui";
import { AccountSecurity } from "@/components/auth/account-security";
import { memberLabel } from "@/lib/auth/workspace-navigation";
import { 
  BookOpen, 
  ClipboardCheck, 
  GraduationCap, 
  QrCode, 
  ShieldCheck, 
  TrendingUp, 
  Users, 
  Award 
} from "lucide-react";

export default async function InstructorRoom() {
  // 강사 권한 여부를 확인하고 사용자 정보를 조회합니다.
  const me = await requireIdentity("/instructor");
  if (!me.roles.some((r) => r.role === "INSTRUCTOR")) notFound();

  // 배정된 강좌 목록을 데이터베이스에서 조회합니다.
  const { data, error } = await (await createServerSupabaseClient())
    .from("life_offering_instructors")
    .select("offering_id,valid_until")
    .eq("person_id", me.id);

  const assigned = (data ?? [])
    .filter((i) => !i.valid_until || Date.parse(i.valid_until) > Date.now())
    .map((i) => i.offering_id);

  const { offerings: own, unavailable } = await getWorkspaceOfferings(
    "id",
    error ? [] : assigned,
  );

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const isExternal = me.instructor_kind === "EXTERNAL";

  return (
    <div className="page-shell">
      {/* 1. 제목과 내 계정 정보를 한 줄에 배치 */}
      <div className="mb-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,32rem)] lg:items-start">
        <PageIntro eyebrow="MY ROOM" title={`${me.name}님 전용 공간`} />

        {/* 2. 내 계정 정보 카드 (기존 '내 정보' 카드 디자인 100% 유지) */}
        <section className="panel h-fit w-full" aria-label="강사 계정 정보">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="badge">{memberLabel(me)}</span>
            {isExternal && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                운영센터 연간 자격 점검 대상
              </span>
            )}
          </div>
          <h2 className="mt-4 text-2xl font-bold text-slate-900">{me.name}</h2>
          <p className="mt-1 break-all text-base text-slate-600">{me.email}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            {isExternal && <Link className="btn-primary text-sm" href="/parking">무료 주차권 신청</Link>}
            <Link className="btn-primary text-sm" href="/mypage/instructor/documents">
              강사 서류 제출
            </Link>
            <Link className="btn-secondary text-sm" href="/mypage/notifications">
              연락처·수신 설정
            </Link>
            <Link className="btn-secondary text-sm" href="/auth/security">
              계정 보안·추가 인증
            </Link>
            <Link className="btn-secondary text-sm" href="/mypage/instructor">
              강사 이력·등록 심사
            </Link>
            <Link className="btn-secondary text-sm" href="/instructor/records">
              강의실적·경력증명
            </Link>
          </div>
        </section>
      </div>

      <AccountSecurity />
      <Link className="btn-primary mb-7" href="/operation-documents">책임과정 운영계획서·결과보고서 작성 →</Link>
      {/* 3. 강사 전주기 라이프사이클 (10대 프로세스 워크플로우 허브) */}
      <section className="mb-10" aria-label="강사 라이프사이클 업무 가이드">
        <h2 className="section-title flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-teal-800" />
          나의 강사 업무 순서
        </h2>
        <p className="mb-6 text-sm text-slate-600">
          울산과학대학교 평생직업교육 플랫폼에서 강사가 수행하는 전주기 업무 단계입니다.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* 1단계: 수업 설계 및 개발 */}
          <div className="panel flex flex-col justify-between border-t-4 border-t-teal-700">
            <div>
              <div className="flex items-center gap-2 text-teal-800">
                <BookOpen className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wider text-teal-700">STEP 1</span>
              </div>
              <h3 className="mt-2 text-lg font-bold text-slate-900">수업 설계 및 개발</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                강사는 수업을 설계하고 개발하는 것부터 시작합니다. (주로 내부 교원이 선도 개발 담당)
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <Link className="text-sm font-semibold text-teal-800 hover:underline inline-flex items-center gap-1" href="/development">
                과정 개발·제안하기 →
              </Link>
            </div>
          </div>

          {/* 2단계: 강사 조건 점검 & 강사진 배정 */}
          <div className="panel flex flex-col justify-between border-t-4 border-t-teal-700">
            <div>
              <div className="flex items-center gap-2 text-teal-800">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wider text-teal-700">STEP 2</span>
              </div>
              <h3 className="mt-2 text-lg font-bold text-slate-900">운영센터 자격 점검 & 배정</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                교외 강사는 매년 이력·자격 자료를 갱신하고 운영센터의 조건 충족 점검을 받습니다. 점검 이후 담당자가 강좌의 강사진에 배정합니다.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <Link className="text-sm font-semibold text-teal-800 hover:underline inline-flex items-center gap-1" href="/mypage/instructor">
                강사 자격·이력 확인 →
              </Link>
            </div>
          </div>

          {/* 3단계: 강좌 운영 준비 & 홍보 & 개설 확정 */}
          <div className="panel flex flex-col justify-between border-t-4 border-t-teal-700">
            <div>
              <div className="flex items-center gap-2 text-teal-800">
                <TrendingUp className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wider text-teal-700">STEP 3</span>
              </div>
              <h3 className="mt-2 text-lg font-bold text-slate-900">운영 준비, 홍보 & 개설 확정</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                교내·외 강사는 개발된 강좌의 수업 일정·학습자료·평가를 준비합니다. 사업단(센터)과 함께 홍보하고 수강 확정 인원을 확인하여 최종 개설 여부를 사업단에 확인합니다.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <Link className="text-sm font-semibold text-teal-800 hover:underline inline-flex items-center gap-1" href="/courses">
                공개 교육과정 및 홍보 보기 →
              </Link>
            </div>
          </div>

          {/* 4단계: 수강생 관리 및 스마트 QR 출결 */}
          <div className="panel flex flex-col justify-between border-t-4 border-t-teal-700">
            <div>
              <div className="flex items-center gap-2 text-teal-800">
                <QrCode className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wider text-teal-700">STEP 4</span>
              </div>
              <h3 className="mt-2 text-lg font-bold text-slate-900">수업 운영 & 실시간 QR 출결</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                개설 후 종강까지 수업·과제와 수강생을 관리합니다. 매 수업 QR로 입실 시각을 확인하고, 종료 후 실제 출석시간을 확정합니다.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <span className="text-xs text-slate-500">아래 담당 강좌 카드에서 QR 화면을 즉시 띄울 수 있습니다.</span>
            </div>
          </div>

          {/* 5단계: 이수(수료) 확인 & 만족도 조사 */}
          <div className="panel flex flex-col justify-between border-t-4 border-t-teal-700">
            <div>
              <div className="flex items-center gap-2 text-teal-800">
                <ClipboardCheck className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wider text-teal-700">STEP 5</span>
              </div>
              <h3 className="mt-2 text-lg font-bold text-slate-900">이수 확인 & 만족도 평가</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                강좌별 이수 현황에서 출결·과제·시험 기준에 따른 수료 결과를 확인합니다. 매 종강 후 개설된 만족도 조사를 수강생에게 안내하고 결과를 다음 수업에 반영합니다.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <span className="text-xs text-slate-500">아래 담당 강좌의 이수 확인·만족도 조사에서 진행</span>
            </div>
          </div>

          {/* 6단계: 강의이력 확인 & 산학협력단 증명서 발급 */}
          <div className="panel flex flex-col justify-between border-t-4 border-t-teal-700">
            <div>
              <div className="flex items-center gap-2 text-teal-800">
                <Award className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wider text-teal-700">STEP 6</span>
              </div>
              <h3 className="mt-2 text-lg font-bold text-slate-900">강의이력 & 경력증명서 발급</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                본인의 강의이력과 실제 강의시간을 확인·제출합니다. 사업단(또는 산학협력단)은 승인된 실적을 정리하여 등록된 발급기관·서식으로 강의경력증명서를 발급합니다.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <Link className="text-sm font-semibold text-teal-800 hover:underline inline-flex items-center gap-1" href="/mypage/certificates">
                증명서 신청·발급 바로가기 →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 4. 배정된 교육과정 목록 (담당 기수 카드) */}
      <section aria-label="담당 교육과정 목록">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="section-title mb-0 flex items-center gap-2">
            <Users className="h-6 w-6 text-teal-800" />
            담당 교육과정 및 실시간 출결 관리
          </h2>
          <span className="text-sm text-slate-600">총 {own.length}개 과정 배정됨</span>
        </div>

        {error || unavailable ? (
          <Empty title="담당 과정을 불러오지 못했습니다" />
        ) : !own.length ? (
          <Empty title="현재 배정된 교육과정이 없습니다">
            사업단 및 운영센터에서 강사진 배정을 완료하면 이곳에 표시됩니다. 교외 강사는 연간 자격 점검을 먼저 확인해 주세요.
          </Empty>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {own.map((o) => (
              <article key={o.id} className="panel flex flex-col justify-between border-2 hover:border-teal-600 transition-colors">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="badge">{o.status === "DRAFT" ? "개설 준비" : o.status === "ARCHIVED" ? "보관" : o.ends_on < today ? "교육 기간 종료" : o.starts_on <= today ? "교육 기간 중" : o.status === "PUBLISHED" ? "모집 공개" : "접수 마감"}</span>
                    <span className="text-xs text-slate-500">정원 {o.capacity}명</span>
                  </div>
                  <h3 className="mt-3 text-xl font-bold text-slate-900">{o.name}</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    교육 기간: {o.starts_on} ~ {o.ends_on}
                  </p>
                  <p className="mt-3 text-sm text-slate-600">강의 운영에서 수강 확정 인원을 확인하세요. 모집 공개나 강사 배정만으로 개설이 확정되지는 않으며, 최종 운영 여부는 사업단에 확인해 주세요.</p>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-200">
                  {/* 스마트 실시간 QR 출석 바로가기 강조 버튼 */}
                  <Link 
                    href={`/instructor/offerings/${o.id}/attendance/qr`} 
                    className="btn-primary w-full flex items-center justify-center gap-2 mb-3 bg-teal-800 hover:bg-teal-900 text-white font-bold py-3"
                  >
                    <QrCode className="h-5 w-5" />
                    <span>QR 입실 확인 화면</span>
                  </Link>

                  {/* 세부 메뉴 링크들 */}
                  <div className="grid grid-cols-2 gap-2 text-center text-xs font-semibold">
                    <Link 
                      href={`/instructor/offerings/${o.id}`}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2.5 text-slate-800 hover:bg-teal-50 hover:text-teal-900 transition-colors"
                    >
                      운영 준비·수강생 →
                    </Link>
                    <Link 
                      href={`/instructor/offerings/${o.id}/attendance`}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2.5 text-slate-800 hover:bg-teal-50 hover:text-teal-900 transition-colors"
                    >
                      출석부 관리 →
                    </Link>
                    <Link href={`/instructor/offerings/${o.id}/completion`} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2.5 text-slate-800 hover:bg-teal-50 hover:text-teal-900">이수 확인 →</Link>
                    <Link
                      href={`/quality/${o.id}`}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2.5 text-slate-800 hover:bg-teal-50 hover:text-teal-900 transition-colors"
                    >
                      만족도 조사 →
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
