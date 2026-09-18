'use client';

// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 교육과정 탐색 및 목록 페이지
// ==============================================================================
// 파일 경로: src/app/courses/page.tsx
// 설명:
//   학습자가 울산 5대 주력산업(조선·해양, 미래모빌리티, 이차전지, 디지털제조 등)의
//   다양한 교육과정을 카테고리 탭과 검색창을 통해 필터링하고 탐색할 수 있는 화면입니다.
// ==============================================================================

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Search, 
  Calendar, 
  Users, 
  Clock, 
  MapPin, 
  Filter, 
  Sparkles, 
  ChevronRight,
  BookOpen
} from 'lucide-react';
import type { CourseType } from '@/types/database';

// 교육과정 표시용 인터페이스 정의
interface CourseItem {
  id: string;
  title: string;
  category: string;
  course_type: CourseType;
  type_label: string;
  target_audience: string;
  capacity: number;
  applied_count: number;
  period: string;
  total_hours: number;
  tuition: string;
  location: string;
  is_enrolling: boolean; // 모집중 여부
}

export default function CoursesPage() {
  // 선택된 카테고리 상태 (기본값: '전체')
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  // 선택된 교육 방식 상태 (기본값: 'ALL')
  const [selectedType, setSelectedType] = useState<string>('ALL');
  // 검색어 상태
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // 사업단 카테고리 목록
  const categories = [
    '전체',
    '조선·해양',
    '미래모빌리티',
    '이차전지·신소재',
    '디지털·스마트제조',
    '직무소양·교양',
  ];

  // 교육과정 더미 데이터 (추후 Supabase DB에서 조회 연동)
  const coursesData: CourseItem[] = [
    {
      id: 'c1',
      title: '스마트 조선·해양 3D 선체 블록 모델링 및 검사 실무',
      category: '조선·해양',
      course_type: 'BLENDED',
      type_label: '혼합교육 (대면+온라인)',
      target_audience: 'HD현대중공업 협력사 재직자 및 구직자',
      capacity: 25,
      applied_count: 18,
      period: '2026.10.15 ~ 2026.11.20',
      total_hours: 45,
      tuition: '전액 무료 (지자체·사업단 100% 지원)',
      location: '동부캠퍼스 3공학관 204호',
      is_enrolling: true,
    },
    {
      id: 'c2',
      title: '친환경 미래 모빌리티 고전압 배터리 팩 정비 및 안전관리',
      category: '미래모빌리티',
      course_type: 'OFFLINE',
      type_label: '현장 실습 집합교육',
      target_audience: '울산 자동차부품 기업 재직자 및 기계전공자',
      capacity: 20,
      applied_count: 20,
      period: '2026.10.20 ~ 2026.11.30',
      total_hours: 60,
      tuition: '전액 무료 (교재 및 실습재료비 포함)',
      location: '서부캠퍼스 산학협력관 102호',
      is_enrolling: true,
    },
    {
      id: 'c3',
      title: '산업용 생성형 AI와 스마트 팩토리 공정 데이터 분석 기초',
      category: '디지털·스마트제조',
      course_type: 'ONLINE',
      type_label: '온라인 원격 이러닝',
      target_audience: '울산지역 성인학습자 및 직무전환 희망자',
      capacity: 50,
      applied_count: 32,
      period: '2026.11.01 ~ 2026.12.15',
      total_hours: 30,
      tuition: '전액 무료 (온라인 자율수강)',
      location: 'LMS 온라인 전용 강의실',
      is_enrolling: true,
    },
    {
      id: 'c4',
      title: '차세대 리튬이온 배터리 전극 제조 및 품질분석 실습',
      category: '이차전지·신소재',
      course_type: 'OFFLINE',
      type_label: '현장 실습 집합교육',
      target_audience: '배터리/화학 소재 기업 재직자 및 취업준비생',
      capacity: 15,
      applied_count: 12,
      period: '2026.11.05 ~ 2026.12.10',
      total_hours: 40,
      tuition: '전액 무료 (국비 100% 지원)',
      location: '서부캠퍼스 화공실습동 301호',
      is_enrolling: true,
    },
    {
      id: 'c5',
      title: '친환경 수소선박 연료전지 시스템 및 안전운항 실무',
      category: '조선·해양',
      course_type: 'BLENDED',
      type_label: '혼합교육 (대면+온라인)',
      target_audience: '해양플랜트 및 조선 기자재 엔지니어',
      capacity: 20,
      applied_count: 9,
      period: '2026.11.10 ~ 2026.12.20',
      total_hours: 45,
      tuition: '전액 무료 (사업단 지원)',
      location: '동부캠퍼스 산학융합동 105호',
      is_enrolling: true,
    },
    {
      id: 'c6',
      title: '스마트 제조 현장 리더를 위한 공정 혁신 및 조직 소통 기술',
      category: '직무소양·교양',
      course_type: 'ONLINE',
      type_label: '온라인 원격 이러닝',
      target_audience: '울산 중견·중소기업 현장 관리자 및 팀장급',
      capacity: 40,
      applied_count: 40,
      period: '2026.10.10 ~ 2026.11.15',
      total_hours: 20,
      tuition: '전액 무료',
      location: 'LMS 온라인 전용 강의실',
      is_enrolling: false, // 마감
    },
  ];

  // 필터링 및 검색 로직 적용
  const filteredCourses = useMemo(() => {
    return coursesData.filter((course) => {
      // 카테고리 일치 여부
      const matchCategory = selectedCategory === '전체' || course.category === selectedCategory;
      // 교육 방식 일치 여부
      const matchType = selectedType === 'ALL' || course.course_type === selectedType;
      // 검색어 일치 여부 (강좌명 또는 교육대상)
      const matchSearch = 
        course.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        course.target_audience.toLowerCase().includes(searchKeyword.toLowerCase());

      return matchCategory && matchType && matchSearch;
    });
  }, [selectedCategory, selectedType, searchKeyword]);

  return (
    <div className="bg-slate-50 min-h-screen py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* 1. 상단 타이틀 영역 */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="inline-flex items-center space-x-2 text-uc-orange text-xs font-bold bg-orange-50 px-3 py-1 rounded-full mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>지자체·대학 협력 앵커사업단 평생직업교육</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-uc-navy">
                모집 중인 교육과정 탐색
              </h1>
              <p className="mt-2 text-slate-600 text-sm sm:text-base">
                울산의 주력 산업을 선도하는 맞춤형 직무 교육을 만나보세요. 모든 과정은 전액 국비/지자체 무료 지원됩니다.
              </p>
            </div>

            {/* 실시간 검색창 */}
            <div className="w-full md:w-80 relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="강좌명 또는 대상 검색..."
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-blue focus:bg-white transition"
              />
            </div>
          </div>

          {/* 2. 카테고리 탭 바 */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition ${
                  selectedCategory === cat
                    ? 'bg-uc-navy text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* 3. 교육 방식 세부 필터 (대면 / 온라인 / 혼합) */}
          <div className="mt-4 flex items-center space-x-3 text-xs text-slate-600">
            <span className="flex items-center space-x-1 font-semibold text-slate-800">
              <Filter className="w-3.5 h-3.5" />
              <span>교육방식:</span>
            </span>
            <button
              onClick={() => setSelectedType('ALL')}
              className={`px-2.5 py-1 rounded-md ${selectedType === 'ALL' ? 'bg-slate-800 text-white font-bold' : 'hover:bg-slate-100'}`}
            >
              전체 방식
            </button>
            <button
              onClick={() => setSelectedType('OFFLINE')}
              className={`px-2.5 py-1 rounded-md ${selectedType === 'OFFLINE' ? 'bg-slate-800 text-white font-bold' : 'hover:bg-slate-100'}`}
            >
              대면실습
            </button>
            <button
              onClick={() => setSelectedType('ONLINE')}
              className={`px-2.5 py-1 rounded-md ${selectedType === 'ONLINE' ? 'bg-slate-800 text-white font-bold' : 'hover:bg-slate-100'}`}
            >
              원격 이러닝
            </button>
            <button
              onClick={() => setSelectedType('BLENDED')}
              className={`px-2.5 py-1 rounded-md ${selectedType === 'BLENDED' ? 'bg-slate-800 text-white font-bold' : 'hover:bg-slate-100'}`}
            >
              혼합형
            </button>
          </div>
        </div>

        {/* 4. 강좌 카드 목록 그리드 */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <span className="text-sm font-semibold text-slate-700">
              총 <strong className="text-uc-blue">{filteredCourses.length}</strong>개의 과정이 등록되어 있습니다.
            </span>
          </div>

          {filteredCourses.length === 0 ? (
            <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 space-y-3">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-lg font-bold text-slate-700">조건에 일치하는 교육과정이 없습니다.</h3>
              <p className="text-sm text-slate-500">다른 카테고리를 선택하거나 검색어를 변경해 보세요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCourses.map((course) => {
                const isFull = course.applied_count >= course.capacity;
                const percentage = Math.min(100, Math.round((course.applied_count / course.capacity) * 100));

                return (
                  <div
                    key={course.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition flex flex-col justify-between group"
                  >
                    <div className="p-6 space-y-4">
                      {/* 카드 헤더: 카테고리 및 상태 뱃지 */}
                      <div className="flex justify-between items-center">
                        <span className="px-2.5 py-1 bg-blue-50 text-uc-navy font-bold rounded-lg text-xs">
                          {course.category}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          course.is_enrolling 
                            ? isFull 
                              ? 'bg-amber-100 text-amber-800' 
                              : 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}>
                          {course.is_enrolling ? (isFull ? '대기접수' : '접수중') : '모집마감'}
                        </span>
                      </div>

                      {/* 강좌명 */}
                      <h3 className="text-lg font-bold text-slate-900 line-clamp-2 group-hover:text-uc-navy transition">
                        <Link href={`/courses/${course.id}`}>
                          {course.title}
                        </Link>
                      </h3>

                      {/* 교육방식 */}
                      <div className="text-xs text-uc-blue font-semibold">
                        방식: {course.type_label}
                      </div>

                      {/* 교육 상세 정보 */}
                      <div className="space-y-2 text-xs text-slate-600 pt-3 border-t border-slate-100">
                        <div className="flex items-center space-x-2">
                          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">대상: {course.target_audience}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>일정: {course.period}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>시수: 총 {course.total_hours}시간</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">장소: {course.location}</span>
                        </div>
                      </div>

                      {/* 모집 인원 및 접수 프로그레스 바 */}
                      <div className="pt-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-500">신청인원 현황</span>
                          <span className="font-bold text-slate-800">
                            {course.applied_count} / {course.capacity}명 ({percentage}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isFull ? 'bg-uc-orange' : 'bg-uc-blue'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>

                      {/* 수강료 안내 */}
                      <div className="bg-slate-50 p-3 rounded-xl flex justify-between items-center text-xs">
                        <span className="text-slate-500">교육비</span>
                        <span className="font-bold text-emerald-600">{course.tuition}</span>
                      </div>
                    </div>

                    {/* 카드 하단 버튼 */}
                    <div className="p-6 pt-0">
                      <Link
                        href={`/courses/${course.id}`}
                        className="w-full flex items-center justify-center space-x-1 py-3 bg-slate-900 hover:bg-uc-navy text-white rounded-xl font-bold text-sm transition shadow-sm"
                      >
                        <span>상세보기 및 신청</span>
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
