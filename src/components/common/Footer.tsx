// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 공통 푸터
// ==============================================================================
// 파일 경로: src/components/common/Footer.tsx
// 설명:
//   울산과학대학교 앵커사업단의 공식 주소, 대표 연락처, 개인정보처리방침 및
//   지자체-대학 협력 사업단 관련 법적 고지사항을 제공하는 하단 영역입니다.
// ==============================================================================

import React from 'react';
import Link from 'next/link';
import { Phone, Mail, MapPin, ShieldCheck, Award } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 pt-12 pb-8 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-slate-800">
          {/* 1. 사업단 기본 소개 */}
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-uc-orange rounded-lg flex items-center justify-center text-white font-bold text-lg">
                UC
              </div>
              <span className="text-xl font-bold text-white">
                울산과학대학교 앵커사업단 RCC센터
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-lg">
              울산광역시와 울산과학대학교가 함께하는 앵커사업단 RCC센터는
              지역 재직자, 성인학습자 및 구직자를 위한 맞춤형 직무역량 강화 교육과
              지역 5대 주력산업 맞춤형 미래인재 양성을 선도합니다.
            </p>
            <div className="flex items-center space-x-4 pt-2 text-xs text-slate-400">
              <span className="flex items-center space-x-1">
                <Award className="w-4 h-4 text-uc-orange" />
                <span>지역성장 인재양성 앵커체계</span>
              </span>
              <span className="flex items-center space-x-1">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>개인정보보호 및 위·변조 방지 인증</span>
              </span>
            </div>
          </div>

          {/* 2. 빠른 바로가기 링크 */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              주요 서비스 바로가기
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/courses" className="hover:text-white transition">
                  모집 중인 교육과정
                </Link>
              </li>
              <li>
                <Link href="/lms" className="hover:text-white transition">
                  나의 LMS 강의실
                </Link>
              </li>
              <li>
                <Link href="/instructor" className="hover:text-white transition">
                  전문 강사 풀(Pool) 지원
                </Link>
              </li>
              <li>
                <Link href="/verify" className="hover:text-white transition">
                  수료증 원본 진위 검증
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-white transition text-slate-400">
                  사업단 관리자 시스템
                </Link>
              </li>
            </ul>
          </div>

          {/* 3. 사업단 캠퍼스 및 연락처 안내 */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              사업단 위치 및 문의
            </h4>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 text-uc-orange shrink-0 mt-1" />
                <span>
                  <strong>동부캠퍼스</strong>: 울산광역시 동구 봉수로 101<br />
                  앵커사업단 RCC센터 본부
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 text-uc-orange shrink-0 mt-1" />
                <span>
                  <strong>서부캠퍼스</strong>: 울산광역시 남구 대학로 57
                </span>
              </li>
              <li className="flex items-center space-x-2 pt-1">
                <Phone className="w-4 h-4 text-uc-orange shrink-0" />
                <span className="text-white font-medium">052-230-0500</span>
              </li>
              <li className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-uc-orange shrink-0" />
                <span>lifelong@uc.ac.kr</span>
              </li>
            </ul>
          </div>
        </div>

        {/* 4. 하단 저작권 및 약관 */}
        <div className="pt-6 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 space-y-4 sm:space-y-0">
          <p>© 2026 Ulsan College Anchor RCC Center. All rights reserved.</p>
          <div className="flex space-x-6">
            <Link href="/privacy" className="hover:text-slate-300 font-semibold text-slate-400">
              개인정보처리방침
            </Link>
            <Link href="/terms" className="hover:text-slate-300">
              이용약관
            </Link>
            <Link href="/email-policy" className="hover:text-slate-300">
              이메일무단수집거부
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
