'use client';

// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 공통 헤더 네비게이션
// ==============================================================================
// 파일 경로: src/components/common/Header.tsx
// 설명:
//   PC 및 모바일 환경에서 포털의 주요 메뉴(사업단 소개, 수강신청, LMS 강의실,
//   나의 수강이력, 강사지원, 수료증 검증, 성과 KPI, 강의실/장학금 관리)로
//   신속하게 이동할 수 있도록 안내하는 통합 상단 헤더입니다.
// ==============================================================================

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  GraduationCap, 
  BookOpen, 
  FileCheck2, 
  UserCheck, 
  BarChart3,
  History,
  Building2,
  Coins,
  Menu, 
  X, 
  LogIn, 
  User 
} from 'lucide-react';

export default function Header() {
  // 모바일 메뉴 열림/닫힘 상태 관리
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 네비게이션 메뉴 항목 구성
  const navItems = [
    { name: '사업단 소개', href: '/about', icon: GraduationCap },
    { name: '교육과정 & 수강신청', href: '/courses', icon: BookOpen },
    { name: 'LMS 강의실', href: '/lms', icon: BookOpen },
    { name: '나의 수강이력', href: '/mypage/history', icon: History },
    { name: '강사 풀(Pool) 지원', href: '/instructor', icon: UserCheck },
    { name: '수료증 진위검증', href: '/verify', icon: FileCheck2 },
    { name: '성과 KPI', href: '/admin/kpi', icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-uc-gray-border shadow-sm">
      {/* 상단 최상위 미니 알림바 (관리자 바로가기 포함) */}
      <div className="bg-uc-navy text-white text-xs py-1.5 px-4 text-center sm:text-left flex justify-between items-center max-w-7xl mx-auto">
        <span className="font-medium">
          🏛️ 울산광역시-울산과학대학교 지자체·대학 협력 앵커사업단 RCC센터
        </span>
        <div className="hidden sm:flex items-center space-x-3 text-slate-300 text-[11px]">
          <Link href="/admin/classrooms" className="hover:text-white transition flex items-center space-x-1">
            <Building2 className="w-3 h-3" />
            <span>강의실 배정</span>
          </Link>
          <span>|</span>
          <Link href="/admin/scholarships" className="hover:text-white transition flex items-center space-x-1">
            <Coins className="w-3 h-3" />
            <span>장학금 정산</span>
          </Link>
          <span>|</span>
          <Link href="/admin/kpi" className="hover:text-white transition flex items-center space-x-1">
            <BarChart3 className="w-3 h-3" />
            <span>성과 KPI</span>
          </Link>
          <span>|</span>
          <span className="text-uc-orange font-semibold">교육문의 052-230-0500</span>
        </div>
      </div>

      {/* 메인 네비게이션 바 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* 1. 로고 영역 */}
          <Link href="/" className="flex items-center space-x-3 group shrink-0">
            <div className="w-12 h-12 bg-uc-navy rounded-xl flex items-center justify-center text-white font-bold text-xl shadow group-hover:bg-uc-navy-light transition shrink-0">
              UC
            </div>
            <div className="flex flex-col whitespace-nowrap">
              <span className="text-xl font-bold text-uc-navy tracking-tight whitespace-nowrap">
                울산과학대학교
              </span>
              <span className="text-xs font-semibold text-uc-orange tracking-wide whitespace-nowrap">
                앵커사업단 RCC센터 포털
              </span>
            </div>
          </Link>

          {/* 2. 데스크톱 네비게이션 메뉴 (xl 이상 고해상도) */}
          <nav className="hidden xl:flex items-center space-x-0.5 2xl:space-x-1">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center space-x-1 px-2 2xl:px-3 py-2 rounded-lg text-slate-700 hover:text-uc-navy hover:bg-slate-50 font-semibold transition text-xs 2xl:text-sm whitespace-nowrap"
                >
                  <IconComponent className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* 중간 해상도 (md ~ xl) 메뉴: 상위 주요 5개 표시 */}
          <nav className="hidden md:flex xl:hidden space-x-0.5">
            {navItems.slice(0, 5).map((item) => {
              const IconComponent = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center space-x-1 px-2 py-2 rounded-lg text-slate-700 hover:text-uc-navy hover:bg-slate-50 font-semibold transition text-xs whitespace-nowrap"
                >
                  <IconComponent className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* 3. 로그인/회원가입 액션 버튼 */}
          <div className="hidden md:flex items-center space-x-2 shrink-0">
            <Link
              href="/auth/login"
              className="flex items-center space-x-1.5 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition whitespace-nowrap"
            >
              <LogIn className="w-4 h-4 shrink-0" />
              <span>로그인</span>
            </Link>
            <Link
              href="/auth/signup"
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-uc-navy text-white rounded-lg text-xs font-semibold hover:bg-uc-navy-light transition shadow-sm whitespace-nowrap"
            >
              <User className="w-4 h-4 shrink-0" />
              <span>회원가입</span>
            </Link>
          </div>

          {/* 4. 모바일 햄버거 토글 버튼 */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-700 hover:bg-slate-100 focus:outline-none"
              aria-label="메뉴 열기"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* 5. 모바일 전용 드롭다운 메뉴 */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-6 space-y-2 shadow-lg">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-3 py-3 rounded-lg text-slate-800 hover:bg-slate-50 font-medium text-base"
              >
                <IconComponent className="w-5 h-5 text-uc-navy" />
                <span>{item.name}</span>
              </Link>
            );
          })}

          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600">
            <Link
              href="/admin/classrooms"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 bg-slate-50 rounded-lg text-center"
            >
              강의실 배정
            </Link>
            <Link
              href="/admin/scholarships"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 bg-slate-50 rounded-lg text-center"
            >
              장학금 정산
            </Link>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col space-y-2">
            <Link
              href="/auth/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium"
            >
              로그인
            </Link>
            <Link
              href="/auth/signup"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 bg-uc-navy text-white rounded-lg font-medium shadow"
            >
              회원가입
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
