'use client';

// ==============================================================================
// 울산과학대학교 앵커사업단 RCC센터 평생직업교육 플랫폼 - 로그인 페이지
// ==============================================================================
// 파일 경로: src/app/auth/login/page.tsx
// 설명:
//   학습자, 강사, 운영자/관리자가 플랫폼에 접근하기 위한 공식 로그인 인터페이스입니다.
//   Supabase Auth 클라이언트와 연동되어 안전한 세션 토큰을 발급받습니다.
// ==============================================================================

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn, Lock, Mail, ShieldCheck, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // 로그인 제출 핸들러
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        // 보안상 비밀번호 불일치와 아이디 미존재를 구분하지 않고 일반화된 메시지 노출
        setErrorMessage(error.message || '이메일 또는 비밀번호가 일치하지 않습니다.');
        setIsLoading(false);
        return;
      }

      if (data?.session) {
        setSuccessMessage('로그인에 성공하였습니다. 강의실로 이동합니다...');
        setTimeout(() => {
          router.push('/lms');
          router.refresh();
        }, 800);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || '로그인 처리 중 시스템 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  // 데모 시연용 계정 빠른 입력 헬퍼
  const handleFillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Demo2026!@#');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-xl">
        {/* 상단 로고 및 안내 */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-uc-navy text-white font-bold text-xl shadow-md">
            UC
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            통합 로그인
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            울산과학대학교 앵커사업단 RCC센터 평생직업교육 포털
          </p>
        </div>

        {/* 상태 메시지 알림바 */}
        {errorMessage && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-2 text-xs text-emerald-700">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 로그인 폼 */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-bold text-slate-700 mb-1">
              이메일 계정
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="learner@example.com"
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-navy focus:bg-white transition"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="block text-xs font-bold text-slate-700">
                비밀번호
              </label>
              <Link href="/auth/forgot-password" className="text-xs text-uc-orange hover:underline">
                비밀번호 찾기
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-navy focus:bg-white transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-uc-navy hover:bg-uc-navy-light text-white font-bold rounded-xl text-sm shadow-md transition flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {isLoading ? (
              <span>로그인 확인 중...</span>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>로그인</span>
              </>
            )}
          </button>
        </form>

        {/* 데모 빠른 계정 입력 박스 */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
          <div className="flex items-center justify-between text-slate-600 font-bold">
            <span>💡 시연용 계정 빠른 선택</span>
            <span className="text-[10px] text-uc-orange">비밀번호 자동 입력</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleFillDemo('learner@uc.ac.kr')}
              className="px-2 py-1.5 bg-white border border-slate-300 hover:border-uc-navy rounded-lg text-slate-700 text-[11px] font-medium transition text-center"
            >
              학습자
            </button>
            <button
              type="button"
              onClick={() => handleFillDemo('instructor@uc.ac.kr')}
              className="px-2 py-1.5 bg-white border border-slate-300 hover:border-uc-navy rounded-lg text-slate-700 text-[11px] font-medium transition text-center"
            >
              교수/강사
            </button>
            <button
              type="button"
              onClick={() => handleFillDemo('admin@uc.ac.kr')}
              className="px-2 py-1.5 bg-white border border-slate-300 hover:border-uc-navy rounded-lg text-slate-700 text-[11px] font-medium transition text-center"
            >
              사업단 관리자
            </button>
          </div>
        </div>

        {/* 하단 회원가입 링크 */}
        <div className="pt-2 text-center text-xs text-slate-600">
          <span>아직 앵커사업단 계정이 없으신가요? </span>
          <Link href="/auth/signup" className="text-uc-navy font-bold hover:underline">
            신규 회원가입
          </Link>
        </div>
      </div>
    </div>
  );
}
