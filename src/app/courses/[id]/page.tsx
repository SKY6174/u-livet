'use client';

// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 교육과정 상세 안내 페이지
// ==============================================================================
// 파일 경로: src/app/courses/[id]/page.tsx
// 설명:
//   개별 강좌의 상세 커리큘럼, 주차별 실습 계획서(Syllabus), 담당 강사 프로필,
//   그리고 수료를 위한 3대 조건(출석률 80%, 시험 60점, 설문 필수)을 시각적으로
//   안내하고 즉시 수강신청서 작성 페이지로 이동시키는 화면입니다.
// ==============================================================================

import React from 'react';
import Link from 'next/link';
import { 
  Calendar, 
  Users, 
  Clock, 
  MapPin, 
  Award, 
  CheckCircle2, 
  ShieldCheck, 
  FileText, 
  ArrowLeft, 
  ChevronRight,
  AlertCircle
} from 'lucide-react';

export default function CourseDetailPage({ params }: { params: { id: string } }) {
  // 실제 서비스에서는 params.id를 바탕으로 Supabase의 courses, course_instructors, lms_lectures 테이블을 조회합니다.
  const course = {
    id: params.id,
    title: '스마트 조선·해양 3D 선체 블록 모델링 및 검사 실무',
    category: '조선·해양산업',
    course_type_label: '혼합교육 (대면실습 70% + 온라인이러닝 30%)',
    target_audience: 'HD현대중공업 협력사 재직자, 조선해양 관련 학과 졸업자 및 청년 구직자',
    capacity: 25,
    applied_count: 18,
    tuition: '전액 무료 (울산시·사업단 100% 지원, 실습재료비 무상)',
    apply_period: '2026.09.20 ~ 2026.10.10',
    course_period: '2026.10.15 ~ 2026.11.20 (총 6주, 45시간)',
    lecture_schedule: '매주 화, 목 19:00 ~ 22:00 (야간 실습)',
    location: '울산과학대학교 동부캠퍼스 3공학관 204호 스마트선박CAD실',
    instructor_name: '김태진 명장 (대한민국 조선분야 명장 / 공학박사)',
    instructor_career: 'HD현대중공업 선체설계부 28년 근무, 전 울산시 조선해양 혁신자문위원',
    overview: `
      본 과정은 친환경 스마트 선박 건조 환경에 필수적인 3D 선체 블록 디지털 모델링 실무 기술을 습득하는 전문 직업교육입니다.
      최신 CAD/CAM 툴을 활용하여 실제 선체 도면을 3D 블록으로 구현하고, 비파괴 비접촉 3D 스캐너를 이용한 블록 형상 검사 프로세스를 
      체험함으로써 즉시 조선 현장에 투입 가능한 숙련된 엔지니어를 양성합니다.
    `,
    // 수료 기준
    criteria: {
      min_attendance: 80,
      min_score: 60,
      require_survey: true,
    },
    // 주차별/차시별 강의계획서
    syllabus: [
      { week: 1, title: '친환경 스마트선박 선체 구조의 이해 및 3D CAD 환경 설정', type: '대면실습', hours: 6 },
      { week: 2, title: '선체 외판 및 종횡격벽 부재 디지털 모델링 기법', type: '혼합 (온라인 이론+대면)', hours: 8 },
      { week: 3, title: '곡판 가공 및 조립 블록 단계별 3D 부재 배치 실습', type: '대면실습', hours: 8 },
      { week: 4, title: '선체 블록 용접 변형 시뮬레이션 및 잔류응력 해석', type: '이러닝 원격', hours: 6 },
      { week: 5, title: '정밀 광학 3D 스캐닝을 활용한 블록 치수 공차 검사', type: '현장 실습', hours: 9 },
      { week: 6, title: '종합 블록 모델링 캡스톤 프로젝트 평가 및 만족도 조사', type: '대면평가', hours: 8 },
    ],
  };

  const isFull = course.applied_count >= course.capacity;

  return (
    <div className="bg-slate-50 min-h-screen py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* 1. 상단 뒤로가기 네비게이션 */}
        <Link
          href="/courses"
          className="inline-flex items-center space-x-1.5 text-sm font-semibold text-slate-600 hover:text-uc-navy transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>전체 교육과정 목록으로 돌아가기</span>
        </Link>

        {/* 2. 강좌 핵심 개요 헤더 카드 */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-3 py-1 bg-blue-50 text-uc-navy font-bold rounded-lg text-xs">
              {course.category}
            </span>
            <span className="px-3 py-1 bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs">
              {course.course_type_label}
            </span>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs">
              국비 100% 무료
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-uc-navy leading-tight">
            {course.title}
          </h1>

          <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
            {course.overview}
          </p>

          {/* 핵심 정보 그리드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-6 border-t border-slate-100 text-sm">
            <div className="bg-slate-50 p-4 rounded-2xl space-y-1">
              <span className="text-slate-500 text-xs flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-uc-blue" />
                <span>교육 기간</span>
              </span>
              <p className="font-bold text-slate-800">{course.course_period}</p>
              <p className="text-xs text-slate-500">{course.lecture_schedule}</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl space-y-1">
              <span className="text-slate-500 text-xs flex items-center space-x-1">
                <Users className="w-3.5 h-3.5 text-uc-blue" />
                <span>모집 정원 현황</span>
              </span>
              <p className="font-bold text-slate-800">
                {course.applied_count}명 접수 / 정원 {course.capacity}명
              </p>
              <p className="text-xs text-slate-500">신청기간: {course.apply_period}</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl space-y-1 sm:col-span-2 lg:col-span-1">
              <span className="text-slate-500 text-xs flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-uc-blue" />
                <span>교육 장소</span>
              </span>
              <p className="font-bold text-slate-800">{course.location}</p>
              <p className="text-xs text-emerald-600 font-semibold">{course.tuition}</p>
            </div>
          </div>

          {/* 수강신청 액션 버튼 영역 */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl">
            <div>
              <span className="text-xs text-uc-orange font-bold uppercase tracking-wide">
                수강료 0원 (전액 국비지원)
              </span>
              <p className="text-lg font-bold">지금 온라인으로 간편하게 신청하세요</p>
              <p className="text-xs text-slate-400">
                * 접수 즉시 알림톡/SMS로 선발 일정 및 준비 서류가 안내됩니다.
              </p>
            </div>
            <Link
              href={`/courses/${course.id}/apply`}
              className="w-full sm:w-auto px-8 py-4 bg-uc-orange hover:bg-uc-orange-hover text-white rounded-xl font-bold text-base shadow-lg transition text-center shrink-0"
            >
              {isFull ? '대기자로 신청하기' : '수강신청서 작성하기'}
            </Link>
          </div>
        </div>

        {/* 3. 평생직업교육 수료 기준 인포그래픽 카드 */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center space-x-2">
            <Award className="w-6 h-6 text-uc-orange" />
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              울산과학대학교 앵커사업단 공식 수료 기준
            </h2>
          </div>
          <p className="text-sm text-slate-600">
            본 과정은 교육부 지침 및 대학 규정에 따라 아래 3대 조건을 모두 충족할 때 
            <strong>울산과학대학교 총장 명의 공식 위·변조 방지 전자수료증</strong>이 발급됩니다.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div className="p-5 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-start space-x-3">
              <CheckCircle2 className="w-5 h-5 text-uc-blue shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-900 text-sm">1. 출석률 80% 이상</strong>
                <span className="text-xs text-slate-600 mt-1 block">
                  대면 실습 QR 출석 및 온라인 영상 시청시간을 종합하여 총 시수의 80% 이상 출석 필수.
                </span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-orange-50/60 border border-orange-100 flex items-start space-x-3">
              <CheckCircle2 className="w-5 h-5 text-uc-orange shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-900 text-sm">2. 평가 점수 60점 이상</strong>
                <span className="text-xs text-slate-600 mt-1 block">
                  차시별 실습 과제 및 최종 블록 모델링 캡스톤 결과물 합산 60점 이상 통과.
                </span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex items-start space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-900 text-sm">3. 만족도 설문 완료</strong>
                <span className="text-xs text-slate-600 mt-1 block">
                  품질 향상 및 지자체 보고를 위한 종강 직전 만족도 평가 설문조사 제출 완료 필수.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. 주차별 강의계획서 (Syllabus) */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center space-x-2">
            <FileText className="w-6 h-6 text-uc-navy" />
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              주차별 실습 및 강의계획서
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            {course.syllabus.map((item) => (
              <div key={item.week} className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="flex items-start space-x-4">
                  <span className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-uc-navy text-sm shrink-0">
                    {item.week}주
                  </span>
                  <div>
                    <h4 className="text-base font-bold text-slate-800">{item.title}</h4>
                    <span className="text-xs text-slate-500">진행 방식: {item.type}</span>
                  </div>
                </div>
                <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg shrink-0">
                  {item.hours}시간
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 5. 담당 강사 프로필 */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">담당 교수진 프로필</h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-6 p-6 bg-slate-50 rounded-2xl">
            <div className="w-16 h-16 bg-uc-navy rounded-2xl flex items-center justify-center text-white font-bold text-xl shrink-0">
              명장
            </div>
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-slate-900">{course.instructor_name}</h3>
                <span className="text-xs bg-uc-orange/10 text-uc-orange font-bold px-2 py-0.5 rounded">
                  특급(TIER A) 강사
                </span>
              </div>
              <p className="text-sm text-slate-600">{course.instructor_career}</p>
              <p className="text-xs text-slate-500">
                * 울산과학대학교 앵커사업단 강사자격심의위원회의 엄격한 적격 심사를 통과한 최고 현장 전문가입니다.
              </p>
            </div>
          </div>
        </div>

        {/* 하단 고정 신청 바로가기 */}
        <div className="text-center pt-4">
          <Link
            href={`/courses/${course.id}/apply`}
            className="inline-flex items-center space-x-2 px-10 py-4 bg-uc-navy hover:bg-uc-navy-light text-white rounded-2xl font-bold text-lg shadow-md transition"
          >
            <span>{isFull ? '대기자로 수강신청 접수' : '수강신청서 작성하기'}</span>
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
