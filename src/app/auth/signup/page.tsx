'use client';

// ==============================================================================
// 울산과학대학교 앵커사업단 RCC센터 평생직업교육 플랫폼 - 회원가입 페이지
// ==============================================================================
// 파일 경로: src/app/auth/signup/page.tsx
// 설명:
//   지역 재직자, 성인학습자 및 산업체 전문 강사진이 역할을 선택하여 계정을 생성합니다.
//   보안 규정(개인정보 암호화 저장, 비밀번호 8자리 이상 필수)을 적용합니다.
// ==============================================================================

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus, User, Mail, Lock, Phone, GraduationCap, Briefcase, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function SignUpPage() {
  const router = useRouter();
  const supabase = createClient();

  // 가입 폼 상태
  const [role, setRole] = useState<'LEARNER' | 'INSTRUCTOR'>('LEARNER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // 회원가입 제출 핸들러
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    if (password !== confirmPassword) {
      setErrorMessage('비밀번호가 일치하지 않습니다. 다시 확인해주세요.');
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setErrorMessage('비밀번호는 영문, 숫자를 포함하여 최소 8자 이상이어야 합니다.');
      setIsLoading(false);
      return;
    }

    if (!agreeTerms) {
      setErrorMessage('개인정보처리방침 및 서비스 이용약관에 동의해 주세요.');
      setIsLoading(false);
      return;
    }

    try {
      // 1. Supabase Auth 사용자 생성
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            name: name.trim(),
            role: role,
            phone: phone.trim()
          }
        }
      });

      if (error) {
        setErrorMessage(error.message || '회원가입 처리 중 오류가 발생했습니다.');
        setIsLoading(false);
        return;
      }

      setSuccessMessage('회원가입이 완료되었습니다! 로그인 페이지로 이동합니다.');
      setTimeout(() => {
        router.push('/auth/login');
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err?.message || '회원가입 중 시스템 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-8 bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-xl">
        {/* 상단 로고 및 안내 */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-uc-navy text-white font-bold text-xl shadow-md">
            UC
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            신규 회원가입
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            울산과학대학교 앵커사업단 RCC센터 평생직업교육 포털
          </p>
        </div>

        {/* 상태 알림 메시지 */}
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

        {/* 회원 유형(Role) 선택 버튼 */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">회원 유형 선택</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRole('LEARNER')}
              className={`p-3 rounded-2xl border text-left flex items-center space-x-3 transition ${
                role === 'LEARNER'
                  ? 'border-uc-navy bg-uc-navy/5 text-uc-navy font-bold shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 text-slate-600'
              }`}
            >
              <div className={`p-2 rounded-xl ${role === 'LEARNER' ? 'bg-uc-navy text-white' : 'bg-slate-100 text-slate-600'}`}>
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold">일반 학습자</p>
                <p className="text-[11px] text-slate-500">재직자, 구직자, 시민</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRole('INSTRUCTOR')}
              className={`p-3 rounded-2xl border text-left flex items-center space-x-3 transition ${
                role === 'INSTRUCTOR'
                  ? 'border-uc-orange bg-uc-orange/5 text-uc-orange font-bold shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 text-slate-600'
              }`}
            >
              <div className={`p-2 rounded-xl ${role === 'INSTRUCTOR' ? 'bg-uc-orange text-white' : 'bg-slate-100 text-slate-600'}`}>
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold">전문 강사/교원</p>
                <p className="text-[11px] text-slate-500">산업체 전문가 Pool</p>
              </div>
            </button>
          </div>
        </div>

        {/* 가입 입력 폼 */}
        <form onSubmit={handleSignUp} className="space-y-3.5">
          <div>
            <label htmlFor="name" className="block text-xs font-bold text-slate-700 mb-1">
              성명 (실명)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-navy focus:bg-white transition"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-bold text-slate-700 mb-1">
              이메일 주소 (아이디로 사용)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-navy focus:bg-white transition"
              />
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="block text-xs font-bold text-slate-700 mb-1">
              휴대전화 번호 (출결 알림용)
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                id="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-1234-5678"
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-navy focus:bg-white transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-700 mb-1">
                비밀번호 (8자 이상)
              </label>
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

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-bold text-slate-700 mb-1">
                비밀번호 확인
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-navy focus:bg-white transition"
                />
              </div>
            </div>
          </div>

          {/* 약관 동의 체크박스 */}
          <div className="pt-2">
            <label className="flex items-start space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-1 w-4 h-4 text-uc-navy rounded border-slate-300 focus:ring-uc-navy"
              />
              <span className="text-xs text-slate-600 leading-relaxed">
                [필수] <Link href="/terms" className="text-uc-navy underline font-bold" target="_blank">이용약관</Link> 및{' '}
                <Link href="/privacy" className="text-uc-navy underline font-bold" target="_blank">개인정보처리방침</Link>에 동의합니다.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-uc-navy hover:bg-uc-navy-light text-white font-bold rounded-xl text-sm shadow-md transition flex items-center justify-center space-x-2 disabled:opacity-50 mt-2"
          >
            {isLoading ? (
              <span>가입 정보 등록 중...</span>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>회원가입 완료</span>
              </>
            )}
          </button>
        </form>

        {/* 하단 로그인 링크 */}
        <div className="text-center text-xs text-slate-600">
          <span>이미 계정이 있으신가요? </span>
          <Link href="/auth/login" className="text-uc-navy font-bold hover:underline">
            로그인하기
          </Link>
        </div>
      </div>
    </div>
  );
}
