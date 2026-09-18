'use client';

// ==============================================================================
// 울산과학대학교 앵커사업단 RCC센터 평생직업교육 플랫폼 - 공통 헤더 네비게이션
// ==============================================================================
// 파일 경로: src/components/common/Header.tsx
// 설명:
//   1. 사용자의 3대 분류(수강생, 강사, 사업단) 및 비로그인 상태에 따라
//      상단 네비게이션 메뉴와 툴바를 완전히 동적으로 분기하여 제공합니다.
//   2. 수강생에게는 LMS 및 수강이력, 강사에게는 강의계획서 및 강사 풀,
//      사업단에게는 강의실 배정, 장학금 정산, KPI 대시보드만 선별 노출합니다.
//   3. 시연 편의를 위해 우측 상단에 대상자별 원클릭 권한 전환 스위처를 제공합니다.
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
  User,
  LogOut,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  Briefcase
} from 'lucide-react';
import { useRole, UserRole } from '@/lib/auth/roleContext';

export default function Header() {
  const { user, isLoggedIn, loginAs, logout } = useRole();

  // 모바일 메뉴 열림/닫힘 상태
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // 역할 전환 팝오버 토글 상태
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);

  // ----------------------------------------------------------------------------
  // 1. 대상자 역할(Role)별 차별화된 네비게이션 메뉴 구성
  // ----------------------------------------------------------------------------
  const getNavItems = () => {
    switch (user.role) {
      case 'LEARNER':
        // [수강생 전용 메뉴]
        return [
          { name: '교육과정 & 수강신청', href: '/courses', icon: BookOpen },
          { name: '나의 LMS 강의실', href: '/lms', icon: BookOpen },
          { name: '평생학습 이력관리', href: '/mypage/history', icon: History },
          { name: '수료증 진위검증', href: '/verify', icon: FileCheck2 },
        ];
      case 'INSTRUCTOR':
        // [강사/교원 전용 메뉴]
        return [
          { name: '신규 강의계획서 제안', href: '/instructor/syllabus', icon: BookOpen },
          { name: '강사 Pool 지원/현황', href: '/instructor', icon: UserCheck },
          { name: '수료증 진위검증', href: '/verify', icon: FileCheck2 },
        ];
      case 'ADMIN':
        // [사업단 관리자 전용 메뉴]
        return [
          { name: '성과 KPI 총괄', href: '/admin/kpi', icon: BarChart3 },
          { name: '스마트 강의실 배정', href: '/admin/classrooms', icon: Building2 },
          { name: '장학금 정산 대장', href: '/admin/scholarships', icon: Coins },
          { name: '강사 Pool 적격 심사', href: '/admin/instructors', icon: UserCheck },
          { name: '수료증 진위검증', href: '/verify', icon: FileCheck2 },
        ];
      default:
        // [비로그인 일반 방문자 메뉴] (관리자 기능 일체 숨김)
        return [
          { name: '사업단 소개', href: '/about', icon: GraduationCap },
          { name: '모집 교육과정', href: '/courses', icon: BookOpen },
          { name: '수료증 진위검증', href: '/verify', icon: FileCheck2 },
        ];
    }
  };

  const navItems = getNavItems();

  // 역할 뱃지 스타일 매핑
  const roleBadgeInfo = {
    LEARNER: {
      label: '수강생 모드',
      icon: GraduationCap,
      badgeColor: 'bg-blue-600 text-white',
      textColor: 'text-blue-600',
    },
    INSTRUCTOR: {
      label: '강사/교원 모드',
      icon: Briefcase,
      badgeColor: 'bg-uc-orange text-white',
      textColor: 'text-uc-orange',
    },
    ADMIN: {
      label: '사업단 관리자',
      icon: Building2,
      badgeColor: 'bg-slate-900 text-white',
      textColor: 'text-slate-900',
    },
    GUEST: {
      label: '방문자',
      icon: User,
      badgeColor: 'bg-slate-200 text-slate-700',
      textColor: 'text-slate-600',
    },
  };

  const currentRoleMeta = roleBadgeInfo[user.role];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-uc-gray-border shadow-sm">
      {/* ------------------------------------------------------------------------
          상단 최상위 미니 알림바: 사업단 로그인 시에만 관리자 툴바로 자동 전환
      ------------------------------------------------------------------------- */}
      <div className={`text-white text-xs py-1.5 px-4 transition ${user.role === 'ADMIN' ? 'bg-slate-900' : 'bg-uc-navy'}`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="font-medium">
              {user.role === 'ADMIN' ? (
                <strong className="text-amber-300">🏛️ [사업단 전용 관제 모드] 울산과학대학교 앵커사업단 RCC센터</strong>
              ) : (
                '🏛️ 울산광역시-울산과학대학교 지자체·대학 협력 앵커사업단 RCC센터'
              )}
            </span>
          </div>

          <div className="hidden sm:flex items-center space-x-3 text-slate-300 text-[11px]">
            {user.role === 'ADMIN' ? (
              <>
                <Link href="/admin/classrooms" className="hover:text-white transition flex items-center space-x-1">
                  <Building2 className="w-3 h-3 text-amber-300" />
                  <span>강의실 배정</span>
                </Link>
                <span>|</span>
                <Link href="/admin/scholarships" className="hover:text-white transition flex items-center space-x-1">
                  <Coins className="w-3 h-3 text-amber-300" />
                  <span>장학금 정산</span>
                </Link>
                <span>|</span>
                <Link href="/admin/kpi" className="hover:text-white transition flex items-center space-x-1">
                  <BarChart3 className="w-3 h-3 text-amber-300" />
                  <span>성과 KPI</span>
                </Link>
                <span>|</span>
                <span className="text-amber-300 font-bold">운영본부 관리중</span>
              </>
            ) : (
              <>
                <span className="text-slate-400">동부캠퍼스 앵커사업단 RCC센터 본부</span>
                <span>|</span>
                <span className="text-uc-orange font-semibold">교육문의 052-230-0500</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------------
          메인 네비게이션 바 (가로 1열 유지 및 로고 줄바꿈 완전 방지)
      ------------------------------------------------------------------------- */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* 1. 좌측 로고 영역 */}
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

          {/* 2. 중앙 데스크톱 네비게이션 (역할별 선별된 메뉴만 노출) */}
          <nav className="hidden xl:flex items-center space-x-1 2xl:space-x-2">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center space-x-1 px-2.5 2xl:px-3.5 py-2 rounded-xl text-slate-700 hover:text-uc-navy hover:bg-slate-100 font-bold transition text-xs 2xl:text-sm whitespace-nowrap"
                >
                  <IconComponent className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* 중간 해상도 (md ~ xl) 메뉴 */}
          <nav className="hidden md:flex xl:hidden space-x-1">
            {navItems.slice(0, 4).map((item) => {
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

          {/* 3. 우측: 인증 상태 및 권한 스위처 */}
          <div className="hidden md:flex items-center space-x-2.5 shrink-0">
            {isLoggedIn ? (
              <div className="flex items-center space-x-2">
                {/* 현재 사용자 명찰 & 역할 전환 드롭다운 버튼 */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setRoleSwitcherOpen(!roleSwitcherOpen)}
                    className="flex items-center space-x-2 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-white transition text-left"
                    title="클릭하여 수강생/강사/사업단 모드를 전환해보세요"
                  >
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${currentRoleMeta.badgeColor}`}>
                      {currentRoleMeta.label}
                    </span>
                    <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                      {user.name}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {/* 역할 빠른 전환 팝오버 (시연 편의) */}
                  {roleSwitcherOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 space-y-1 z-50">
                      <div className="px-3 py-2 border-b border-slate-100">
                        <p className="text-xs font-bold text-slate-800">역할 즉시 전환 (체험)</p>
                        <p className="text-[10px] text-slate-500">선택 시 해당 대상자 전용 메뉴로 즉시 바뀝니다.</p>
                      </div>

                      <button
                        onClick={() => {
                          loginAs('LEARNER', '김울산 (수강생)');
                          setRoleSwitcherOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center space-x-2 transition ${
                          user.role === 'LEARNER' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <GraduationCap className="w-4 h-4 text-blue-600" />
                        <div>
                          <span className="block font-bold">수강생 모드</span>
                          <span className="text-[10px] text-slate-400">LMS, 수강신청, 이력관리</span>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          loginAs('INSTRUCTOR', '이선박 겸임교원 (강사)');
                          setRoleSwitcherOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center space-x-2 transition ${
                          user.role === 'INSTRUCTOR' ? 'bg-orange-50 text-orange-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <Briefcase className="w-4 h-4 text-uc-orange" />
                        <div>
                          <span className="block font-bold">강사·교원 모드</span>
                          <span className="text-[10px] text-slate-400">강의계획서 제안, 강사풀</span>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          loginAs('ADMIN', '사업단 운영본부 (관리자)');
                          setRoleSwitcherOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center space-x-2 transition ${
                          user.role === 'ADMIN' ? 'bg-slate-100 text-slate-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <Building2 className="w-4 h-4 text-slate-800" />
                        <div>
                          <span className="block font-bold">사업단 관리자 모드</span>
                          <span className="text-[10px] text-slate-400">강의실, 장학금, 성과 KPI</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* 로그아웃 버튼 */}
                <button
                  type="button"
                  onClick={() => logout()}
                  className="flex items-center space-x-1 px-3 py-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold transition"
                  title="로그아웃"
                >
                  <LogOut className="w-3.5 h-3.5 text-slate-500" />
                  <span>로그아웃</span>
                </button>
              </div>
            ) : (
              /* 비로그인 방문자: 3분류 로그인 바로가기 */
              <div className="flex items-center space-x-2">
                <Link
                  href="/auth/login"
                  className="flex items-center space-x-1.5 px-3.5 py-2 border border-slate-300 hover:border-uc-navy rounded-xl text-xs font-bold text-slate-700 hover:text-uc-navy hover:bg-slate-50 transition whitespace-nowrap"
                >
                  <LogIn className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>로그인 (수강생/강사/사업단)</span>
                </Link>
                <Link
                  href="/auth/signup"
                  className="flex items-center space-x-1.5 px-4 py-2 bg-uc-navy text-white rounded-xl text-xs font-bold hover:bg-uc-navy-light transition shadow-sm whitespace-nowrap"
                >
                  <User className="w-3.5 h-3.5 shrink-0" />
                  <span>회원가입</span>
                </Link>
              </div>
            )}
          </div>

          {/* 4. 모바일 햄버거 토글 버튼 */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 focus:outline-none"
              aria-label="메뉴 열기"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6 text-uc-navy" />}
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------------
          모바일 전용 드롭다운 메뉴
      ------------------------------------------------------------------------- */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 shadow-xl">
          {/* 모바일 현재 역할 상태 안내 */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${currentRoleMeta.badgeColor}`}>
                {currentRoleMeta.label}
              </span>
              <span className="text-xs font-bold text-slate-800">{user.name}</span>
            </div>
            {isLoggedIn && (
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="text-xs text-red-600 font-bold hover:underline"
              >
                로그아웃
              </button>
            )}
          </div>

          {/* 모바일 역할별 네비게이션 목록 */}
          <div className="space-y-1">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center space-x-3 px-3 py-2.5 rounded-xl text-slate-800 hover:bg-slate-100 font-semibold text-sm"
                >
                  <IconComponent className="w-4 h-4 text-uc-navy" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* 비로그인 시 로그인/가입 버튼 */}
          {!isLoggedIn && (
            <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-2">
              <Link
                href="/auth/login"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 text-center border border-slate-300 rounded-xl text-xs font-bold text-slate-700"
              >
                로그인 (3분류)
              </Link>
              <Link
                href="/auth/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 text-center bg-uc-navy text-white rounded-xl text-xs font-bold"
              >
                신규 회원가입
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
