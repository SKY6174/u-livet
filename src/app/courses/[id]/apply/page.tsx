'use client';

// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 수강신청 접수 폼 페이지
// ==============================================================================
// 파일 경로: src/app/courses/[id]/apply/page.tsx
// 설명:
//   학습자가 인적사항, 소속 기관, 지원 동기 및 증빙 서류를 첨부하여
//   공식 수강신청서를 제출하는 화면입니다. 제출 시 Supabase DB 연동 및
//   개인정보보호법에 따른 수집·이용 동의를 필수로 거치게 됩니다.
// ==============================================================================

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  CheckCircle2, 
  ShieldCheck, 
  UploadCloud, 
  AlertCircle,
  FileCheck,
  Send
} from 'lucide-react';

export default function CourseApplyPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  // 강좌 기본 요약 정보
  const courseSummary = {
    id: params.id,
    title: '스마트 조선·해양 3D 선체 블록 모델링 및 검사 실무',
    period: '2026.10.15 ~ 2026.11.20 (총 45시간)',
    capacity: 25,
    applied_count: 18,
    tuition: '전액 무료 (국비/지자체 100% 지원)',
  };

  const isFull = courseSummary.applied_count >= courseSummary.capacity;

  // 폼 입력 상태 관리
  const [formData, setFormData] = useState({
    name: '홍길동',
    phone: '010-1234-5678',
    email: 'hong@example.com',
    birthDate: '1985-05-15',
    organization: 'HD현대중공업 협력사 (주)울산선박기술',
    department: '생산기술부 차장',
    motivation: '',
    agreePrivacy: false,
    agreeTerms: false,
  });

  // 제출 상태 및 성공 모달 상태
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [assignedWaitingNo, setAssignedWaitingNo] = useState<number | null>(null);

  // 폼 입력 핸들러
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 체크박스 핸들러
  const handleCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  // 수강신청 제출 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.agreePrivacy || !formData.agreeTerms) {
      alert('개인정보 수집·이용 및 교육 운영 규정에 모두 동의해 주셔야 신청이 가능합니다.');
      return;
    }

    if (!formData.motivation.trim()) {
      alert('지원 동기 및 학습 계획을 간단히 작성해 주세요.');
      return;
    }

    setIsSubmitting(true);

    // 실제 환경에서는 Supabase client를 통해 course_enrollments 테이블에 INSERT합니다.
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
      if (isFull) {
        setAssignedWaitingNo(courseSummary.applied_count - courseSummary.capacity + 1);
      }
    }, 1000);
  };

  return (
    <div className="bg-slate-50 min-h-screen py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* 상단 뒤로가기 */}
        <Link
          href={`/courses/${params.id}`}
          className="inline-flex items-center space-x-1.5 text-sm font-semibold text-slate-600 hover:text-uc-navy transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>강좌 상세 안내로 돌아가기</span>
        </Link>

        {/* 1. 신청 강좌 요약 배너 */}
        <div className="bg-uc-navy text-white p-6 sm:p-8 rounded-3xl shadow-sm space-y-3">
          <span className="px-3 py-1 bg-white/20 text-white text-xs font-bold rounded-lg backdrop-blur-sm">
            수강신청 대상 강좌
          </span>
          <h1 className="text-xl sm:text-2xl font-bold">{courseSummary.title}</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300 pt-2 border-t border-white/10">
            <div>교육일정: {courseSummary.period}</div>
            <div className="text-uc-orange font-semibold">교육비용: {courseSummary.tuition}</div>
          </div>
          {isFull && (
            <div className="bg-amber-500/20 border border-amber-400/40 p-3 rounded-xl text-xs text-amber-200 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-300 shrink-0" />
              <span>현재 모집 정원이 마감되어 접수 시 <strong>예비 대기 순번</strong>이 자동 부여됩니다.</span>
            </div>
          )}
        </div>

        {/* 2. 제출 완료 성공 화면 (제출 후 전환) */}
        {isSubmitted ? (
          <div className="bg-white rounded-3xl p-10 border border-slate-200 shadow-md text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-slate-900">
                수강신청서가 정상적으로 접수되었습니다!
              </h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                울산과학대학교 앵커사업단 담당자가 서류 확인 후 선발 결과를 등록하신 연락처({formData.phone})로 개별 안내해 드립니다.
              </p>
            </div>

            {assignedWaitingNo && (
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 max-w-sm mx-auto text-sm">
                <span className="text-amber-800 font-bold">예비 대기 순번: {assignedWaitingNo}번</span>
                <p className="text-xs text-amber-700 mt-1">
                  기존 선발자의 취소 발생 시 순번에 따라 즉시 연락드립니다.
                </p>
              </div>
            )}

            <div className="pt-4 flex flex-col sm:flex-row justify-center gap-3">
              <Link
                href="/lms"
                className="px-6 py-3 bg-uc-navy hover:bg-uc-navy-light text-white font-bold rounded-xl text-sm transition"
              >
                나의 LMS 수강현황 보기
              </Link>
              <Link
                href="/courses"
                className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-xl text-sm hover:bg-slate-50 transition"
              >
                다른 강좌 더보기
              </Link>
            </div>
          </div>
        ) : (
          /* 3. 수강신청 입력 폼 */
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-sm space-y-8">
            {/* 섹션 1: 신청자 인적사항 */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
                1. 신청자 기본 인적사항
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    성명 <span className="text-rose-500">*</span>
                  </label>
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    생년월일 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="birthDate"
                    value={formData.birthDate}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-blue"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    휴대전화 번호 <span className="text-rose-500">*</span>
                  </label>
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    이메일 주소 <span className="text-rose-500">*</span>
                  </label>
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

            {/* 섹션 2: 소속 기업 및 지원동기 */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
                2. 직무 정보 및 지원 동기
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    소속 회사/기관명
                  </label>
                  <input
                    type="text"
                    name="organization"
                    value={formData.organization}
                    onChange={handleChange}
                    placeholder="예: 현대자동차 협력사 (주)울산모빌리티"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-blue"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    부서 및 직급
                  </label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    placeholder="예: 품질관리부 대리"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  지원 동기 및 직무 활용 계획 <span className="text-rose-500">*</span>
                </label>
                <textarea
                  name="motivation"
                  rows={4}
                  value={formData.motivation}
                  onChange={handleChange}
                  placeholder="본 교육과정에 지원하게 된 계기와 향후 현업에서 어떻게 활용할 계획인지 간략히 기술해 주세요."
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-blue leading-relaxed"
                />
              </div>

              {/* 증빙 서류 첨부 UI */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  재직증명서 또는 자격 증빙서류 (선택)
                </label>
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:bg-slate-50 transition cursor-pointer">
                  <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-600 font-semibold">
                    클릭하여 파일을 선택하거나 이곳으로 드래그해 주세요.
                  </p>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    PDF, JPG, PNG 파일 (최대 10MB)
                  </span>
                </div>
              </div>
            </div>

            {/* 섹션 3: 개인정보 수집·이용 동의 (규칙 8 준수) */}
            <div className="space-y-4 pt-2">
              <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>3. 개인정보 수집·이용 및 서약 동의</span>
              </h3>

              <div className="bg-slate-50 p-4 rounded-2xl text-xs text-slate-600 space-y-2 border border-slate-200">
                <p className="font-bold text-slate-800">
                  [개인정보보호법에 따른 수집 및 이용 목적 안내]
                </p>
                <p>
                  1. 수집 항목: 성명, 생년월일, 연락처, 이메일, 소속 기업체명, 재직 증빙자료<br />
                  2. 수집 목적: 지자체-대학 협력 앵커사업단 평생직업교육 수강생 선발, 학사 및 출결 관리, 국비 지원금 정산 보고, 수료증 발급 및 이력 관리<br />
                  3. 보유 기간: 사업 종료 후 법정 보존 기한(5년) 경과 시 즉시 파기
                </p>
              </div>

              <div className="space-y-2 text-sm pt-2">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="agreePrivacy"
                    checked={formData.agreePrivacy}
                    onChange={handleCheckbox}
                    className="w-4 h-4 text-uc-navy rounded focus:ring-uc-blue"
                  />
                  <span className="text-slate-800 font-medium">
                    (필수) 개인정보 수집 및 이용 목적에 동의합니다.
                  </span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="agreeTerms"
                    checked={formData.agreeTerms}
                    onChange={handleCheckbox}
                    className="w-4 h-4 text-uc-navy rounded focus:ring-uc-blue"
                  />
                  <span className="text-slate-800 font-medium">
                    (필수) 성실한 출석(80% 이상) 및 수료 기준 준수 서약에 동의합니다.
                  </span>
                </label>
              </div>
            </div>

            {/* 최종 제출 버튼 */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center space-x-2 py-4 bg-uc-navy hover:bg-uc-navy-light text-white rounded-2xl font-bold text-base shadow-md transition disabled:bg-slate-400"
              >
                {isSubmitting ? (
                  <span>신청서를 안전하게 접수 중입니다...</span>
                ) : (
                  <>
                    <Send className="w-5 h-5 text-uc-orange" />
                    <span>{isFull ? '대기 순번으로 수강신청 접수' : '수강신청서 최종 제출하기'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
