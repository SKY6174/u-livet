// ==============================================================================
// 울산과학대학교 앵커사업단 RCC센터 평생직업교육 플랫폼 - 서비스 이용약관
// ==============================================================================
// 파일 경로: src/app/terms/page.tsx
// 설명:
//   울산과학대학교 앵커사업단 RCC센터 평생직업교육 포털의 서비스 이용조건,
//   수강신청 및 취소 규정, 전자출결 준수 의무 및 수료 기준을 명시합니다.
// ==============================================================================

import React from 'react';
import Link from 'next/link';
import { FileText, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const metadata = {
  title: '이용약관 | 울산과학대학교 앵커사업단 RCC센터',
  description: '울산과학대학교 앵커사업단 RCC센터 평생직업교육 포털의 공식 서비스 이용약관입니다.'
};

export default function TermsOfServicePage() {
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
          <FileText className="w-7 h-7 text-uc-navy" />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            서비스 이용약관
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-500">
          시행일자: 2026년 09월 01일 | 울산과학대학교 앵커사업단 RCC센터
        </p>
      </div>

      {/* 본문 약관 */}
      <div className="bg-white p-6 sm:p-10 rounded-3xl border border-slate-200 shadow-sm space-y-6 text-sm text-slate-700 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">
            제1조 (목적)
          </h2>
          <p>
            본 약관은 울산과학대학교 앵커사업단 RCC센터(이하 &quot;사업단&quot;)가 제공하는 평생직업교육 포털 및 온·오프라인 LMS(이하 &quot;서비스&quot;)의 이용 조건 및 절차, 수강생과 사업단 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">
            제2조 (수강신청 및 선발)
          </h2>
          <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600">
            <li>교육과정 수강신청은 포털 시스템을 통해 선착순 또는 적격 심사 방식으로 접수됩니다.</li>
            <li>울산 지역 협약기업 재직자 및 취약계층 구직자에게 우선 선발 권한이 부여될 수 있습니다.</li>
            <li>정당한 사유 없이 무단으로 결석하거나 취소하는 경우 향후 타 과정 수강신청에 제한이 있을 수 있습니다.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">
            제3조 (출결 관리 및 수료 기준)
          </h2>
          <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600">
            <li><strong>출석률 기준</strong>: 총 교육 시수의 <strong>80% 이상</strong>을 출석(모바일 QR 체크인 및 온라인 시청)해야 합니다.</li>
            <li><strong>평가 기준</strong>: 정기 평가 또는 과제 제출 종합 성적이 <strong>60점 이상</strong>이어야 합니다.</li>
            <li>대리 출석 또는 위치 조작 등 부정 출결이 적발될 경우 즉시 수료가 취소되며 국비 지원 장학금이 환수됩니다.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">
            제4조 (수료증 및 디지털 배지의 법적 효력)
          </h2>
          <p>
            발급된 전자수료증 및 Open Badges 디지털 배지는 전자문서 및 전자거래 기본법 제4조에 의거하여 공인된 법적 효력을 가지며, 고유 발급번호 및 SHA-256 무결성 해시를 통해 원본 대조가 가능합니다.
          </p>
        </section>
      </div>
    </div>
  );
}
