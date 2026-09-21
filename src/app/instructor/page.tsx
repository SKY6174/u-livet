import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWorkspaceOfferings } from "@/lib/portal/data";
import { Empty, PageIntro } from "@/components/portal/ui";
import { memberLabel } from "@/lib/auth/workspace-navigation";
import { 
  BookOpen, 
  CheckCircle2, 
  ClipboardCheck, 
  FileText, 
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

  const isExternal = me.instructor_kind === "EXTERNAL";

  return (
    <div className="page-shell">
      {/* 1. 상단 타이틀 안내 */}
      <PageIntro eyebrow="MY ROOM" title={`${me.name} 님의 My Room`}>
        수업 설계부터 강사진 배정, 강좌 개설·운영, 스마트 실시간 QR 출결, 평가 및 강의이력 관리까지 한 곳에서 통합 관리합니다.
      </PageIntro>

      {/* 2. 내 계정 정보 카드 (기존 '내 정보' 카드 디자인 100% 유지) */}
      <section className="panel mb-8 max-w-3xl" aria-label="강사 계정 정보">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="badge">{memberLabel(me)}</span>
          {isExternal && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
              RCC센터 연간 자격 점검 대상
            </span>
          )}
        </div>
        <h2 className="mt-4 text-2xl font-bold text-slate-900">{me.name}</h2>
        <p className="mt-1 break-all text-base text-slate-600">{me.email}</p>
        
        <div className="mt-6 flex flex-wrap gap-3">
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

      {/* 3. 강사 전주기 라이프사이클 (10대 프로세스 워크플로우 허브) */}
      <section className="mb-10" aria-label="강사 라이프사이클 업무 가이드">
        <h2 className="section-title flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-teal-800" />
          강사 전주기 업무 로드맵 (Teaching Lifecycle)
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
              <h3 className="mt-2 text-lg font-bold text-slate-900">RCC센터 자격 점검 & 배정</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                외부 교원은 매년 강사(교외) 조건을 만족하는지 RCC센터의 점검을 통과한 후 강사진에 최종 할당됩니다.
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
                사업단 및 교내·외 강사진이 함께 홍보를 추진하며, 학생 모집 인원에 따라 강좌 개설 여부가 확정됩니다.
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
                충실한 수업과 학생 관리를 수행합니다. 매 시간 수기 출석부 대신 화면에 실시간 QR 코드를 제시하여 출석을 체크합니다.
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
                수강생의 출석·과제 요건 충족을 확인하고, 강좌 종료 후 강의 만족도 조사를 실시하여 품질을 제고합니다.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <span className="text-xs text-slate-500">담당 강좌별 '과정 평가·개선' 메뉴에서 확인</span>
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
                본인의 실제 강의실적을 정리·제출하고, 사업단(산학협력단)의 공식 직인이 날인된 강의경력증명서를 발급받습니다.
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
            사업단 및 RCC센터에서 강사진 배정 및 개설이 확정되면 이곳에 표시됩니다.
          </Empty>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {own.map((o) => (
              <article key={o.id} className="panel flex flex-col justify-between border-2 hover:border-teal-600 transition-colors">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="badge">운영 중</span>
                    <span className="text-xs text-slate-500 font-mono">기수 ID: {o.id.slice(0, 8)}</span>
                  </div>
                  <h3 className="mt-3 text-xl font-bold text-slate-900">{o.name}</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    📅 교육 기간: {o.starts_on} ~ {o.ends_on}
                  </p>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-200">
                  {/* 스마트 실시간 QR 출석 바로가기 강조 버튼 */}
                  <Link 
                    href={`/instructor/offerings/${o.id}/attendance/qr`} 
                    className="btn-primary w-full flex items-center justify-center gap-2 mb-3 bg-teal-800 hover:bg-teal-900 text-white font-bold py-3"
                  >
                    <QrCode className="h-5 w-5" />
                    <span>실시간 스마트 QR 출석 화면 띄우기</span>
                  </Link>

                  {/* 세부 메뉴 링크들 */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold">
                    <Link 
                      href={`/instructor/offerings/${o.id}`}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2.5 text-slate-800 hover:bg-teal-50 hover:text-teal-900 transition-colors"
                    >
                      강의 운영 →
                    </Link>
                    <Link 
                      href={`/instructor/offerings/${o.id}/attendance`}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2.5 text-slate-800 hover:bg-teal-50 hover:text-teal-900 transition-colors"
                    >
                      출석부 관리 →
                    </Link>
                    <Link 
                      href={`/quality/${o.id}`}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2.5 text-slate-800 hover:bg-teal-50 hover:text-teal-900 transition-colors"
                    >
                      만족도 평가 →
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
