'use client';

// ==============================================================================
// 울산과학대학교 앵커사업단 RCC센터 평생직업교육 플랫폼 - 권한/역할 전역 Context
// ==============================================================================
// 파일 경로: src/lib/auth/roleContext.tsx
// 설명:
//   1. 사용자의 3대 분류(수강생 LEARNER, 강사 INSTRUCTOR, 사업단 ADMIN, 비로그인 GUEST)를 전역 관리합니다.
//   2. 로그인된 대상자에 따라 헤더 메뉴, 대시보드 진입 권한을 동적으로 제어합니다.
//   3. 새로고침 후에도 유지되도록 브라우저 localStorage와 Supabase Auth를 연동합니다.
// ==============================================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export type UserRole = 'GUEST' | 'LEARNER' | 'INSTRUCTOR' | 'ADMIN';

interface UserInfo {
  role: UserRole;
  name: string;
  email: string;
  affiliation?: string; // 소속 또는 전공
}

interface RoleContextType {
  user: UserInfo;
  isLoggedIn: boolean;
  loginAs: (role: UserRole, customName?: string, customEmail?: string) => void;
  logout: () => void;
}

// 기본값 (비로그인 방문자)
const defaultUser: UserInfo = {
  role: 'GUEST',
  name: '방문자',
  email: '',
};

const RoleContext = createContext<RoleContextType>({
  user: defaultUser,
  isLoggedIn: false,
  loginAs: () => {},
  logout: () => {},
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo>(defaultUser);
  const [isInitialized, setIsInitialized] = useState(false);
  const supabase = createClient();

  // 브라우저 마운트 시 저장된 세션 또는 로컬 상태 복원
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('uc_life_auth_user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch (e) {
      console.error('인증 상태 로드 실패:', e);
    } finally {
      setIsInitialized(true);
    }

    // Supabase Auth 세션 변경 실시간 리스너
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const metadataRole = (session.user.user_metadata?.role as UserRole) || 'LEARNER';
        const metadataName = session.user.user_metadata?.name || session.user.email?.split('@')[0] || '사용자';
        
        const loggedUser: UserInfo = {
          role: metadataRole,
          name: metadataName,
          email: session.user.email || '',
        };
        setUser(loggedUser);
        localStorage.setItem('uc_life_auth_user', JSON.stringify(loggedUser));
      } else if (event === 'SIGNED_OUT') {
        setUser(defaultUser);
        localStorage.removeItem('uc_life_auth_user');
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase]);

  // 특정 역할로 로그인 처리 함수 (데모 및 실로그인 공통)
  const loginAs = (targetRole: UserRole, customName?: string, customEmail?: string) => {
    let name = customName;
    let email = customEmail || '';

    if (!name) {
      if (targetRole === 'LEARNER') name = '김울산 (수강생)';
      else if (targetRole === 'INSTRUCTOR') name = '이선박 겸임교원 (강사)';
      else if (targetRole === 'ADMIN') name = '사업단 운영본부 (관리자)';
      else name = '방문자';
    }

    if (!email) {
      if (targetRole === 'LEARNER') email = 'learner@uc.ac.kr';
      else if (targetRole === 'INSTRUCTOR') email = 'instructor@uc.ac.kr';
      else if (targetRole === 'ADMIN') email = 'admin@uc.ac.kr';
    }

    const newUser: UserInfo = {
      role: targetRole,
      name: name,
      email: email,
      affiliation: targetRole === 'INSTRUCTOR' ? '조선해양공학과' : '울산과학대학교 앵커사업단 RCC센터'
    };

    setUser(newUser);
    try {
      localStorage.setItem('uc_life_auth_user', JSON.stringify(newUser));
    } catch (e) {
      console.error('로컬스토리지 저장 실패:', e);
    }
  };

  // 로그아웃 함수
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Supabase 로그아웃 오류:', e);
    }
    setUser(defaultUser);
    try {
      localStorage.removeItem('uc_life_auth_user');
    } catch (e) {
      console.error('로컬스토리지 초기화 실패:', e);
    }
  };

  return (
    <RoleContext.Provider
      value={{
        user,
        isLoggedIn: user.role !== 'GUEST',
        loginAs,
        logout,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

// 편의 훅: 어디서나 const { user, loginAs, logout } = useRole(); 로 호출 가능
export function useRole() {
  return useContext(RoleContext);
}
