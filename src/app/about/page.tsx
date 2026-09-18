// ==============================================================================
// 울산과학대학교 앵커사업단 RCC센터 평생직업교육 플랫폼 - 사업단 소개 페이지
// ==============================================================================
// 파일 경로: src/app/about/page.tsx
// 설명:
//   울산과학대학교 앵커사업단 RCC센터의 비전, 지자체-대학 협력 기반 지역성장 인재양성체계,
//   울산 5대 주력 신산업 특화 교육 로드맵 및 조직 구성을 상세히 소개합니다.
// ==============================================================================

import React from 'react';
import Link from 'next/link';
import { 
  Building2, 
  Target, 
  Award, 
  Users, 
  ArrowRight, 
  CheckCircle2, 
  MapPin, 
  Phone, 
  Mail, 
  Compass, 
  Zap, 
  ShieldCheck 
} from 'lucide-react';

export const metadata = {
  title: '사업단 소개 | 울산과학대학교 앵커사업단 RCC센터',
  description: '지자체-대학 협력 기반 지역성장 인재양성체계(RCC), 울산 5대 주력 신산업 평생직업교육의 허브 울산과학대학교 앵커사업단 RCC센터를 소개합니다.'
};

export default function AboutPage() {
  // 사업단 3대 핵심 추진 전략
  const coreStrategies = [
    {
      icon: Target,
      title: '지역성장 동반 인재양성',
      description: '울산 지역 5대 주력산업(스마트선박, 친환경모빌리티, 이차전지, 스마트팩토리, 바이오/디지털) 맞춤형 실무 교육과정을 개발하고 공급합니다.'
    },
    {
      icon: Compass,
      title: '온·오프라인 하이브리드 LMS',
      description: '재직자 및 성인학습자의 접근성을 극대화하기 위해 모바일 QR 출결, 이러닝 강의실 및 첨단 실습실 인프라를 통합 운영합니다.'
    },
    {
      icon: ShieldCheck,
      title: '공인 전자증서 및 배지 발급',
      description: '총장 명의 위·변조 방지 전자수료증과 W3C/1EdTech 국제표준 Open Badges v2.0 디지털 역량 배지를 발행하여 학습자의 취업·이직을 보증합니다.'
    }
  ];

  // 울산 5대 특화 산업 분야
  const focusIndustries = [
    { name: '스마트 친환경 조선·해양', code: 'SMART-SHIP', desc: 'LNG/수소 추진체계, 3D 선체 블록 모델링 및 스마트 야드 품질검사' },
    { name: '수소 모빌리티 & 미래차', code: 'FUTURE-CAR', desc: '연료전지 시스템 제어, 전기차 고전압 배터리 팩 설계 및 진단' },
    { name: '이차전지 첨단 소재·공정', code: 'BATTERY-ADV', desc: '양극재/음극재 품질분석, 기가팩토리 클린룸 운영 및 안전관리' },
    { name: 'AI 제조 지능화 스마트팩토리', code: 'SMART-FACTORY', desc: '산업용 로봇 협동제어, PLC 자동화 시스템 및 예지보전 시뮬레이션' },
    { name: '지역특화 신산업 바이오·에너지', code: 'BIO-ENERGY', desc: '탄소중립 순환경제, 바이오케미칼 공정 및 산업안전 관리자 양성' }
  ];

  return (
    <div className="space-y-16 pb-20">
      {/* 1. 상단 히어로 배너 */}
      <section className="relative bg-gradient-to-br from-uc-navy via-slate-900 to-uc-navy-dark text-white py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center space-x-2 bg-uc-orange/20 text-uc-orange text-xs font-bold px-3.5 py-1.5 rounded-full border border-uc-orange/30">
              <Building2 className="w-4 h-4" />
              <span>지자체·대학 협력 기반 지역성장 인재양성체계</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              울산과학대학교 <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-uc-orange via-amber-300 to-orange-400">
                앵커사업단 RCC센터
              </span>
            </h1>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed pt-2">
              울산광역시와 울산과학대학교가 협력하여 구축한 앵커체계(RCC)는 
              지역 산업체와 재직자, 구직자가 함께 성장하는 대한민국 최고 수준의 평생직업교육 거점 플랫폼입니다.
            </p>
          </div>
        </div>
      </section>

      {/* 2. 사업단 설립 취지 및 비전 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-sm space-y-8">
          <div className="max-w-2xl space-y-3">
            <span className="text-xs font-bold text-uc-orange uppercase tracking-wider">Vision & Mission</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              울산의 미래 50년을 견인할 신산업 실무 인재의 요람
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              기존의 단발성 교육을 넘어, 수강신청부터 온·오프라인 하이브리드 학습, 
              출결 관리, 수료증 및 디지털 배지, 수강료 전액 환급 장학금까지 이어지는 원스톱 인재 성장 사다리를 완성합니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            {coreStrategies.map((item, idx) => {
              const IconComp = item.icon;
              return (
                <div key={idx} className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-uc-navy/10 text-uc-navy flex items-center justify-center">
                    <IconComp className="w-6 h-6 text-uc-navy" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. 울산 5대 주력 신산업 특화 교육 분야 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold text-uc-orange uppercase">Curriculum Domain</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            울산 5대 핵심 주력 신산업 교육 로드맵
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            현장 기업의 실제 직무 수요를 분석하여 개설된 산업 맞춤형 전문 교육과정입니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {focusIndustries.map((ind, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:border-uc-orange transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-uc-orange bg-uc-orange/10 px-2.5 py-1 rounded-md">
                  {ind.code}
                </span>
                <Zap className="w-4 h-4 text-amber-500" />
              </div>
              <h3 className="text-base font-bold text-slate-900">{ind.name}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{ind.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. 캠퍼스 위치 및 연락처 안내 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-slate-900 to-uc-navy text-white rounded-3xl p-8 sm:p-12 shadow-xl flex flex-col lg:flex-row justify-between gap-8">
          <div className="space-y-4 max-w-xl">
            <h3 className="text-2xl font-bold">사업단 방문 및 교육 상담</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              동부캠퍼스 및 서부캠퍼스에 최첨단 스마트 실습실과 강의실을 완비하고 있습니다. 
              기업 맞춤형 위탁교육 또는 강사 지원 문의는 사업단 행정실로 연락주시기 바랍니다.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-uc-orange shrink-0" />
                <span>052-230-0500</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-uc-orange shrink-0" />
                <span>lifelong@uc.ac.kr</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center space-y-3 shrink-0">
            <Link
              href="/courses"
              className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 bg-uc-orange hover:bg-uc-orange-hover text-white rounded-xl font-bold text-sm shadow-md transition"
            >
              <span>모집 강좌 바로보기</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/instructor"
              className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-sm border border-white/20 transition"
            >
              <span>전문 강사 풀(Pool) 지원</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
