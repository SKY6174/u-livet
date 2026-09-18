// ==============================================================================
// 울산과학대학교 앵커사업단 RCC센터 평생직업교육 플랫폼 - 개인정보처리방침
// ==============================================================================
// 파일 경로: src/app/privacy/page.tsx
// 설명:
//   개인정보보호법에 따른 수강생 및 강사진 개인정보 수집, 이용 목적,
//   주민번호 등 고유식별정보의 AES-256 암호화 보관 및 파기 규정을 공지합니다.
// ==============================================================================

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, ArrowLeft, Lock, FileText } from 'lucide-react';

export const metadata = {
  title: '개인정보처리방침 | 울산과학대학교 앵커사업단 RCC센터',
  description: '울산과학대학교 앵커사업단 RCC센터 평생직업교육 플랫폼의 공인 개인정보처리방침입니다.'
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* 상단 헤더 */}
      <div className="space-y-3 pb-6 border-b border-slate-200">
        <Link
          href="/"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-uc-navy transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>메인으로 돌아가기</span>
        </Link>
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-7 h-7 text-emerald-600" />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            개인정보처리방침
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-500">
          시행일자: 2026년 09월 01일 | 울산과학대학교 앵커사업단 RCC센터
        </p>
      </div>

      {/* 방침 본문 내용 */}
      <div className="bg-white p-6 sm:p-10 rounded-3xl border border-slate-200 shadow-sm space-y-6 text-sm text-slate-700 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <span>제1조 (개인정보의 처리 목적)</span>
          </h2>
          <p>
            울산과학대학교 앵커사업단 RCC센터는 다음의 목적을 위하여 최소한의 개인정보를 처리합니다.
            처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 개인정보보호법에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600">
            <li>평생직업교육 교육과정 수강신청, 학적 관리 및 강의실 배정</li>
            <li>온·오프라인 하이브리드 LMS 출결 확인 및 평가 결과 관리</li>
            <li>울산과학대학교 총장 명의 공인 전자수료증 및 Open Badges 디지털 배지 발급</li>
            <li>수강료 100% 환급 장학금 및 교육훈련비 정산 집행</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Lock className="w-4 h-4 text-uc-navy" />
            <span>제2조 (개인정보의 암호화 및 안전성 확보 조치)</span>
          </h2>
          <p>
            사업단은 회원의 개인정보를 안전하게 관리하기 위해 다음과 같은 기술적·관리적 조치를 취하고 있습니다.
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600">
            <li><strong>고유식별정보 암호화</strong>: 국비 교육 이력 보고를 위한 주민등록번호 등은 데이터베이스 저장 전 <strong>AES-256</strong> 대칭키 알고리즘으로 양방향 암호화 처리됩니다.</li>
            <li><strong>비밀번호 단방향 암호화</strong>: 사용자의 비밀번호는 복호화가 불가능한 강력한 단방향 해시(bcrypt)로 암호화 저장됩니다.</li>
            <li><strong>접속 감사 로그</strong>: 개인정보 조회 및 수료증 발급 등 중요 행위는 IP 및 작업 시각을 포함하여 감사 로그(audit_logs)에 영구 기록됩니다.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">
            제3조 (개인정보의 보유 및 이용 기간)
          </h2>
          <p>
            원칙적으로 개인정보의 처리 목적이 달성된 후에는 지체 없이 해당 정보를 파기합니다. 단, 교육부 및 지자체 평생직업교육 규정에 따라 수료 사실 증명 및 장학금 정산 내역은 관련 법령에 의거하여 영구 보존됩니다.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">
            제4조 (개인정보보호 책임관 및 문의처)
          </h2>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
            <p><strong>소속</strong>: 울산과학대학교 앵커사업단 RCC센터 행정실</p>
            <p><strong>전화번호</strong>: 052-230-0500</p>
            <p><strong>이메일</strong>: lifelong@uc.ac.kr</p>
            <p><strong>주소</strong>: 울산광역시 동구 봉수로 101 울산과학대학교 동부캠퍼스 앵커사업단 RCC센터</p>
          </div>
        </section>
      </div>
    </div>
  );
}
