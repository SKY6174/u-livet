// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 메인 랜딩 페이지
// ==============================================================================
// 파일 경로: src/app/page.tsx
// 설명:
//   학습자, 강사 및 방문자가 접속했을 때 마주하는 대표 포털 화면입니다.
//   사업단 비전, 울산 주력산업 특화 강좌 목록, 주요 서비스 바로가기 및
//   수료증 진위확인 퀵 검증 영역을 제공합니다.
// ==============================================================================

import React from 'react';
import Link from 'next/link';
import { 
  BookOpen, 
  UserCheck, 
  Award, 
  ShieldCheck, 
  Calendar, 
  Users, 
  Clock, 
  CheckCircle, 
  ArrowRight, 
  Search,
  Sparkles
} from 'lucide-react';

export default function HomePage() {
  // 메인 화면에 전시할 울산 주력산업 추천 대표 강좌 샘플 데이터
  const featuredCourses = [
    {
      id: 'c1',
      title: '스마트 조선·해양 3D 선체 블록 모델링 및 검사 실무',
      category: '조선·해양산업',
      course_type: 'BLENDED',
      type_label: '혼합교육 (대면+온라인)',
      target: 'HD현대중공업 협력사 재직자 및 구직자',
      capacity: 25,
      applied_count: 18,
      period: '2026.10.15 ~ 2026.11.20',
      total_hours: 45,
      tuition: '전액 무료 (지자체·사업단 100% 지원)',
      location: '동부캠퍼스 3공학관 204호',
    },
    {
      id: 'c2',
      title: '친환경 미래 모빌리티 고전압 배터리 팩 정비 및 안전관리',
      category: '미래모빌리티',
      course_type: 'OFFLINE',
      type_label: '현장 실습 집합교육',
      target: '울산 자동차부품 기업 재직자 및 기계전공자',
      capacity: 20,
      applied_count: 20,
      is_full: true,
      period: '2026.10.20 ~ 2026.11.30',
      total_hours: 60,
      tuition: '전액 무료 (교재 및 실습재료비 포함)',
      location: '서부캠퍼스 산학협력관 102호',
    },
    {
      id: 'c3',
      title: '산업용 생성형 AI와 스마트 팩토리 공정 데이터 분석 기초',
      category: '디지털·AI',
      course_type: 'ONLINE',
      type_label: '온라인 원격 이러닝',
      target: '울산지역 성인학습자 및 직무전환 희망자',
      capacity: 50,
      applied_count: 32,
      period: '2026.11.01 ~ 2026.12.15',
      total_hours: 30,
      tuition: '전액 무료 (온라인 자율수강)',
      location: 'LMS 온라인 전용 강의실',
    },
  ];

  return (
    <div className="space-y-16 pb-20">
      {/* 1. 히어로 섹션 (Hero Banner) */}
      <section className="relative bg-gradient-to-br from-uc-navy via-uc-navy-dark to-slate-950 text-white py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* 은은한 배경 데코 서클 */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-uc-orange/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-semibold text-uc-orange border border-white/15">
              <Sparkles className="w-3.5 h-3.5" />
              <span>울산과학대학교 앵커사업단 RCC센터 공식 포털</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight text-white">
              울산의 주력산업을 선도하는 <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-uc-orange via-amber-300 to-orange-400">
                실무 직업역량 강화의 중심
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
              지역 재직자, 성인학습자, 청년 구직자를 위한 맞춤형 직무 교육과정을 제공합니다.
              선착순 수강신청부터 온·오프라인 하이브리드 LMS, 위·변조 방지 전자수료증까지 원스톱으로 지원합니다.
            </p>

            {/* 빠른 액션 CTA 버튼 그룹 */}
            <div className="pt-4 flex flex-wrap gap-4">
              <Link
                href="/courses"
                className="inline-flex items-center space-x-2 bg-uc-orange hover:bg-uc-orange-hover text-white px-6 py-3.5 rounded-xl font-bold text-base shadow-lg transition transform hover:-translate-y-0.5"
              >
                <BookOpen className="w-5 h-5" />
                <span>모집 강좌 둘러보기</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
              <Link
                href="/lms"
                className="inline-flex items-center space-x-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3.5 rounded-xl font-semibold text-base border border-white/20 backdrop-blur-sm transition"
              >
                <span>나의 LMS 강의실</span>
              </Link>
              <Link
                href="/instructor"
                className="inline-flex items-center space-x-2 bg-transparent hover:bg-white/5 text-slate-300 hover:text-white px-5 py-3.5 rounded-xl font-semibold text-base border border-slate-700 transition"
              >
                <UserCheck className="w-5 h-5 text-uc-orange" />
                <span>강사 풀(Pool) 지원</span>
              </Link>
            </div>

            {/* 하단 태그 */}
            <div className="pt-4 flex flex-wrap gap-2 text-xs text-slate-400">
              <span className="bg-white/5 px-2.5 py-1 rounded-md border border-white/10">#스마트조선·해양</span>
              <span className="bg-white/5 px-2.5 py-1 rounded-md border border-white/10">#친환경모빌리티</span>
              <span className="bg-white/5 px-2.5 py-1 rounded-md border border-white/10">#이차전지실무</span>
              <span className="bg-white/5 px-2.5 py-1 rounded-md border border-white/10">#제조AI스마트팩토리</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. 4대 핵심 서비스 안내 카드 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-uc-navy">
            앵커사업단만의 특별한 평생직업교육 혜택
          </h2>
          <p className="mt-3 text-slate-600 text-sm sm:text-base">
            학습자와 산업체 전문가가 함께 성장하는 4대 핵심 교육 인프라를 소개합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 카드 1 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 bg-blue-50 text-uc-navy rounded-xl flex items-center justify-center mb-4 font-bold">
              <Award className="w-6 h-6 text-uc-blue" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">100% 전액 지원 교육</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              지자체 및 앵커사업단 예산으로 수강료, 실습 재료비, 교재비 일체를 무상 지원합니다.
            </p>
          </div>

          {/* 카드 2 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 bg-orange-50 text-uc-orange rounded-xl flex items-center justify-center mb-4 font-bold">
              <BookOpen className="w-6 h-6 text-uc-orange" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">하이브리드 스마트 LMS</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              모바일 QR 출석체크와 온라인 영상 시청시간 자동 집계로 재직자도 편리하게 이수 가능합니다.
            </p>
          </div>

          {/* 카드 3 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4 font-bold">
              <UserCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">대한민국 명장·전문가 직강</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              울산 지역 산업체 실무 경력 10년 이상의 최고 전문가와 대학 전임교원이 직접 강의합니다.
            </p>
          </div>

          {/* 카드 4 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-4 font-bold">
              <ShieldCheck className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">위·변조 방지 QR 수료증</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              암호화 해시와 QR코드가 탑재된 공인 전자수료증을 즉시 출력하고 기업체에서 진위 확인이 가능합니다.
            </p>
          </div>
        </div>
      </section>

      {/* 3. 현재 모집 중인 교육과정 섹션 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8">
          <div>
            <span className="text-xs font-bold text-uc-orange uppercase tracking-wider">
              Enrolling Courses
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-uc-navy mt-1">
              지금 모집 중인 평생직업교육 과정
            </h2>
          </div>
          <Link
            href="/courses"
            className="mt-3 sm:mt-0 inline-flex items-center space-x-1 text-sm font-semibold text-uc-blue hover:text-uc-navy transition"
          >
            <span>전체 과정 12개 보기</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* 강좌 카드 목록 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredCourses.map((course) => (
            <div
              key={course.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition flex flex-col justify-between"
            >
              <div className="p-6 space-y-4">
                {/* 상단 뱃지 및 카테고리 */}
                <div className="flex justify-between items-center">
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold">
                    {course.category}
                  </span>
                  <span className="text-xs font-medium text-uc-blue">
                    {course.type_label}
                  </span>
                </div>

                {/* 강좌명 */}
                <h3 className="text-lg font-bold text-slate-900 line-clamp-2 hover:text-uc-navy transition">
                  {course.title}
                </h3>

                {/* 대상 및 교육정보 요약 */}
                <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <div className="flex items-center space-x-2">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>대상: {course.target}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>일정: {course.period} ({course.total_hours}시간)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>장소: {course.location}</span>
                  </div>
                </div>

                {/* 수강료 및 정원 현황 */}
                <div className="bg-slate-50 p-3 rounded-xl flex justify-between items-center text-xs">
                  <div>
                    <span className="text-slate-500 block">수강료</span>
                    <span className="font-bold text-emerald-600">{course.tuition}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block">모집현황</span>
                    <span className="font-bold text-slate-800">
                      {course.applied_count} / {course.capacity}명
                      {course.is_full && <span className="ml-1 text-uc-orange font-bold">(대기접수)</span>}
                    </span>
                  </div>
                </div>
              </div>

              {/* 카드 하단 수강신청 버튼 */}
              <div className="p-6 pt-0">
                <Link
                  href={`/courses/${course.id}`}
                  className="w-full text-center block py-3 bg-uc-navy hover:bg-uc-navy-light text-white rounded-xl font-semibold text-sm transition shadow-sm"
                >
                  과정 상세 및 수강신청
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. 수료증 간이 진위 검증 폼 (Quick Certificate Verification) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-slate-900 to-uc-navy rounded-3xl p-8 sm:p-12 text-white shadow-xl flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center space-x-2 text-xs font-semibold text-emerald-400 bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-500/30">
              <ShieldCheck className="w-4 h-4" />
              <span>공인 전자문서 위·변조 검증 서비스</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold">
              울산과학대학교 앵커사업단 RCC센터 수료증 진위 확인
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              수료증 상단에 인쇄된 <strong>수료증 고유 등록번호</strong>(예: UC-ANCHOR-2026-00001)를
              입력하시면 원본 대조 및 수료 사실 여부를 즉시 검증할 수 있습니다.
            </p>
          </div>

          {/* 검색 입력 박스 */}
          <div className="w-full lg:w-auto flex-1 max-w-md">
            <form action="/verify" method="GET" className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  name="code"
                  placeholder="수료증 등록번호 입력"
                  className="w-full pl-11 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 text-sm focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-uc-orange transition"
                  required
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3.5 bg-uc-orange hover:bg-uc-orange-hover text-white rounded-xl text-sm font-bold transition shrink-0 shadow"
              >
                진위 검증
              </button>
            </form>
            <span className="text-xs text-slate-400 mt-2 block text-center sm:text-left">
              * 스마트폰 카메라로 수료증 내 QR코드를 비추면 즉시 검증 페이지로 연결됩니다.
            </span>
          </div>
        </div>
      </section>

      {/* 5. 산업체 전문가 강사 풀 지원 안내 배너 (Instructor CTA) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border border-uc-orange/30 bg-orange-50/50 rounded-3xl p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-uc-orange font-bold text-sm">
              <UserCheck className="w-5 h-5" />
              <span>산업체 전문가 / 겸임교원 초빙</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
              울산의 미래를 밝힐 최고 강사진을 모십니다
            </h3>
            <p className="text-sm text-slate-600 max-w-2xl">
              조선, 모빌리티, 이차전지 등 산업 현장의 풍부한 실무 경험을 보유하고 계신가요?
              강사 풀에 등록하시고 직접 강의계획서를 제안하여 지역 인재 양성에 함께해 주세요.
            </p>
          </div>
          <Link
            href="/instructor"
            className="px-6 py-3.5 bg-uc-orange hover:bg-uc-orange-hover text-white rounded-xl text-sm font-bold transition shadow shrink-0"
          >
            강사 풀 등록 신청하기
          </Link>
        </div>
      </section>
    </div>
  );
}
