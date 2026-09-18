'use client';

// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 산업체 전문가 강사 풀 등록
// ==============================================================================
// 파일 경로: src/app/instructor/page.tsx
// 설명:
//   지역 산업체(조선, 모빌리티, 이차전지 등) 현장 전문가, 기술사, 대한민국 명장이
//   사업단 강사 풀(Pool)에 지원하고 이력과 자격 증빙을 제출하는 화면입니다.
// ==============================================================================

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  UserCheck, 
  Award, 
  Briefcase, 
  UploadCloud, 
  CheckCircle2, 
  ShieldCheck, 
  FileText, 
  ChevronRight,
  Sparkles
} from 'lucide-react';

export default function InstructorRegistrationPage() {
  // 폼 입력 상태 관리
  const [formData, setFormData] = useState({
    name: '김태진',
    phone: '010-9876-5432',
    email: 'taejin.kim@industry.kr',
    specialty: '스마트 조선 선체 CAD 3D 블록 모델링 및 치수 검사',
    education: '울산대학교 기계공학 박사 / 조선해양공학 석사',
    careerSummary: 'HD현대중공업 선체설계부 부장 20년, 선체공정기술 혁신파트장 8년 역임',
    certifications: '대한민국 조선분야 명장(고용노동부), 조선기술사, 국제용접검사관(CWI)',
    bankName: '경남은행',
    accountNumber: '123-45-678901',
    agreePrivacy: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // 강사 자격 등급 기준표
  const tiers = [
    {
      tier: '특급 (TIER A)',
      rate: '시간당 100,000원 ~ 150,000원',
      qualification: '대한민국 명장, 공학박사 학위 소지 후 관련분야 10년 이상 실무 경력자, 기술사 자격 소지자',
      badgeColor: 'bg-orange-100 text-uc-orange border-orange-200',
    },
    {
      tier: '고급 (TIER B)',
      rate: '시간당 70,000원 ~ 100,000원',
      qualification: '관련분야 석사학위 및 실무 경력 7년 이상, 공인 국가전문자격 또는 기사 자격 소지자',
      badgeColor: 'bg-blue-100 text-uc-blue border-blue-200',
    },
    {
      tier: '일반 (TIER C)',
      rate: '시간당 50,000원 ~ 70,000원',
      qualification: '관련분야 학사학위 및 실무 경력 3년 이상, 현장 실무 기술자 및 산업체 숙련 인력',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.agreePrivacy) {
      alert('강사 자격 검증 및 강사료 원천징수를 위한 개인정보 수집에 동의해 주세요.');
      return;
    }

    setIsSubmitting(true);
    // 실제 서비스에서는 Supabase instructor_profiles 테이블에 INSERT 연동
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 1000);
  };

  return (
    <div className="bg-slate-50 min-h-screen py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* 1. 상단 히어로 배너 */}
        <div className="bg-gradient-to-r from-uc-navy via-slate-900 to-uc-navy-dark text-white rounded-3xl p-8 sm:p-10 shadow-sm space-y-3">
          <div className="inline-flex items-center space-x-2 bg-uc-orange/20 text-uc-orange text-xs font-bold px-3 py-1 rounded-full border border-uc-orange/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>최고 산업체 전문가 & 겸임교원 초빙</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold leading-tight">
            울산과학대학교 앵커사업단 RCC센터 강사 풀(Pool) 등록
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
            울산의 주력 산업을 이끌어갈 미래 인재 양성에 여러분의 현장 노하우를 나눠주세요.
            등록된 강사진에게는 적격 심사 후 등급별 시간당 강사료와 강의계획서 제안 권한이 부여됩니다.
          </p>

          <div className="pt-2">
            <Link
              href="/instructor/syllabus"
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-uc-orange hover:text-white transition"
            >
              <span>이미 승인된 강사이신가요? 신규 강좌 제안서 작성하기</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* 2. 강사 자격 등급 기준표 안내 */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-uc-navy">
            <Award className="w-6 h-6 text-uc-orange" />
            <h2 className="text-xl font-bold">시간당 강사료 지급 기준표</h2>
          </div>
          <p className="text-xs text-slate-500">
            * 사업단 규정 및 학력·경력 증빙 심사를 거쳐 최종 등급이 확정됩니다.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {tiers.map((item, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 flex flex-col justify-between">
                <div>
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${item.badgeColor}`}>
                    {item.tier}
                  </span>
                  <p className="font-extrabold text-slate-900 text-sm mt-3">{item.rate}</p>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {item.qualification}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 3. 등록 완료 화면 (제출 후) */}
        {isSubmitted ? (
          <div className="bg-white rounded-3xl p-10 border border-slate-200 shadow-md text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-slate-900">
                강사 풀 등록 신청이 성공적으로 접수되었습니다!
              </h2>
              <p className="text-sm text-slate-600 max-w-lg mx-auto">
                울산과학대학교 앵커사업단 RCC센터 자격심의위원회에서 학력 및 경력 서류 검토 후 
                영업일 기준 3일 이내에 적격 등급 판정 결과를 안내해 드립니다.
              </p>
            </div>

            <div className="pt-2 flex justify-center gap-4">
              <Link
                href="/instructor/syllabus"
                className="px-6 py-3 bg-uc-navy text-white rounded-xl font-bold text-sm shadow hover:bg-uc-navy-light transition"
              >
                신규 강좌 계획서 미리 작성해보기
              </Link>
            </div>
          </div>
        ) : (
          /* 4. 강사 풀 등록 신청 폼 */
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-sm space-y-8">
            {/* 섹션 1: 인적 사항 */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-uc-blue" />
                <span>1. 강사 기본 인적사항</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">성명 *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">연락처 *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">이메일 *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-blue"
                  />
                </div>
              </div>
            </div>

            {/* 섹션 2: 전문분야 및 학력/경력 */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center space-x-2">
                <Briefcase className="w-5 h-5 text-uc-blue" />
                <span>2. 직무 전문분야 및 산업체 경력</span>
              </h3>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  주요 강의 전문 분야 *
                </label>
                <input
                  type="text"
                  name="specialty"
                  value={formData.specialty}
                  onChange={handleChange}
                  placeholder="예: 친환경 수소선박 연료전지, 스마트 모빌리티 배터리 패키징 등"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  최종 학력 (출신교 및 전공) *
                </label>
                <input
                  type="text"
                  name="education"
                  value={formData.education}
                  onChange={handleChange}
                  placeholder="예: 부산대학교 기계공학과 박사 졸업"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  주요 산업체 실무 경력 요약 *
                </label>
                <textarea
                  name="careerSummary"
                  rows={4}
                  value={formData.careerSummary}
                  onChange={handleChange}
                  placeholder="회사명, 직급, 근무기간, 주요 담당 프로젝트를 서술해 주세요."
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-blue leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  보유 자격증 및 수상이력
                </label>
                <input
                  type="text"
                  name="certifications"
                  value={formData.certifications}
                  onChange={handleChange}
                  placeholder="예: 대한민국 명장, 기술사, 기사 자격증 등"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-blue"
                />
              </div>
            </div>

            {/* 섹션 3: 강사료 정산 계좌 정보 (규칙 8 암호화 원칙) */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>3. 강사료 지급 정산 계좌 (AES-256 암호화 보호)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">은행명 *</label>
                  <input
                    type="text"
                    name="bankName"
                    value={formData.bankName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">계좌번호 (본인명의) *</label>
                  <input
                    type="text"
                    name="accountNumber"
                    value={formData.accountNumber}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-blue"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                * 입력하신 계좌번호는 데이터베이스 저장 시 pgcrypto 암호화되어 안전하게 보관되며, 강사료 지급 시에만 인가된 관리자가 복호화합니다.
              </p>
            </div>

            {/* 증빙서류 업로드 */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                경력증명서 / 학력증명서 / 자격증 사본 첨부 (PDF/ZIP) *
              </label>
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:bg-slate-50 transition cursor-pointer">
                <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-1" />
                <p className="text-xs font-semibold text-slate-600">
                  서류 파일을 업로드하여 자격 등급 심사를 받으세요
                </p>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  PDF, ZIP 파일 (최대 20MB)
                </span>
              </div>
            </div>

            {/* 개인정보 동의 */}
            <div className="pt-2">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="agreePrivacy"
                  checked={formData.agreePrivacy}
                  onChange={handleCheckbox}
                  className="w-4 h-4 text-uc-navy rounded focus:ring-uc-blue"
                />
                <span className="text-xs text-slate-700 font-medium">
                  (필수) 강사 자격 적격 심사 및 강사료 원천징수(3.3%) 처리를 위한 개인정보 수집·이용에 동의합니다.
                </span>
              </label>
            </div>

            {/* 제출 버튼 */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-uc-navy hover:bg-uc-navy-light text-white rounded-2xl font-bold text-base shadow-md transition disabled:bg-slate-400"
            >
              {isSubmitting ? '서류를 안전하게 접수 중입니다...' : '강사 풀(Pool) 등록 신청서 제출'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
