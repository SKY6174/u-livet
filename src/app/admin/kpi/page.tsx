'use client';

// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 사업단 성과(KPI) 총괄 대시보드
// ==============================================================================
// 파일 경로: src/app/admin/kpi/page.tsx
// 설명:
//   1. 교육부 및 울산광역시 주관 지자체-대학 협력 기반 지역성장 인재양성 앵커사업의
//      핵심 성과 지표(KPI)를 실시간으로 집계하고 시각화하는 관리자 전용 대시보드입니다.
//   2. 누적 수료생 수, 수료율, 교육 만족도(4대 영역), 재직자 비율, 예산 집행률을 종합 제공합니다.
//   3. 정부 및 지자체 연차 실적 평가 보고서 제출을 위한 엑셀(CSV) 다운로드 기능을 지원합니다.
// ==============================================================================

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  BarChart3, 
  Users, 
  GraduationCap, 
  Star, 
  TrendingUp, 
  Download, 
  Calendar, 
  Award, 
  Briefcase, 
  Layers, 
  ChevronRight,
  Sparkles,
  PieChart,
  CheckCircle,
  HelpCircle
} from 'lucide-react';

// 강좌별 성과 인터페이스 정의
interface CourseKpiItem {
  id: string;
  title: string;
  category: string;
  enrolled: number;
  completed: number;
  completionRate: number;
  satisfaction: number;
  employedCount: number;
  instructorName: string;
  status: 'COMPLETED' | 'IN_PROGRESS';
}

export default function AnchorKpiDashboardPage() {
  // 연도/분기 필터 상태 관리
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');

  // 핵심 KPI 요약 데이터 (2026년 기준)
  const kpiSummary = {
    totalEnrolled: 840,
    targetEnrolled: 1000,
    totalCompleted: 785,
    completionRate: 93.5, // %
    overallSatisfaction: 4.82, // 5.0 만점
    employedOrPromoted: 142, // 취업 및 직무전환 인원
    employedRate: 78.9, // %
    workerRatio: 64.2, // 재직자 비율 %
    jobSeekerRatio: 35.8, // 구직자 비율 %
    budgetExecutionRate: 88.4 // 예산 집행률 %
  };

  // 4대 만족도 세부 통계 (5점 척도 설문 집계)
  const satisfactionBreakdown = [
    { label: '교육과정 실무 적합성 (커리큘럼)', score: 4.85, max: 5.0, count: 742 },
    { label: '산업체 전문 강사진 지도역량', score: 4.92, max: 5.0, count: 742 },
    { label: '최첨단 실습 기자재 및 시설 환경', score: 4.71, max: 5.0, count: 742 },
    { label: '현업 직무 적용도 및 취업 도움성', score: 4.80, max: 5.0, count: 742 }
  ];

  // 세부 강좌별 KPI 데이터 목록
  const courseKpiList: CourseKpiItem[] = [
    {
      id: 'c1',
      title: '조선해양 미래 친환경 스마트 선박 실무 과정',
      category: '신산업 특화 직무전환',
      enrolled: 40,
      completed: 38,
      completionRate: 95.0,
      satisfaction: 4.88,
      employedCount: 22,
      instructorName: '박진우 명장',
      status: 'COMPLETED'
    },
    {
      id: 'c2',
      title: '이차전지 스마트 팩토리 품질관리 엔지니어 양성',
      category: '첨단제조 전문인력',
      enrolled: 35,
      completed: 33,
      completionRate: 94.3,
      satisfaction: 4.91,
      employedCount: 19,
      instructorName: '김수영 수석',
      status: 'COMPLETED'
    },
    {
      id: 'c3',
      title: '생성형 AI를 활용한 제조 공정 최적화 및 빅데이터 실습',
      category: '디지털 혁신 역량강화',
      enrolled: 50,
      completed: 47,
      completionRate: 94.0,
      satisfaction: 4.79,
      employedCount: 15,
      instructorName: '이동훈 기술이사',
      status: 'COMPLETED'
    },
    {
      id: 'c4',
      title: '수소에너지 모빌리티 시스템 및 연료전지 기초',
      category: '지역특화 신산업',
      enrolled: 30,
      completed: 27,
      completionRate: 90.0,
      satisfaction: 4.74,
      employedCount: 12,
      instructorName: '정우성 팀장',
      status: 'COMPLETED'
    },
    {
      id: 'c5',
      title: '스마트 물류 자동화 시스템 PLC 제어',
      category: '생산제조 자동화',
      enrolled: 40,
      completed: 36,
      completionRate: 90.0,
      satisfaction: 4.85,
      employedCount: 18,
      instructorName: '최영식 부장',
      status: 'COMPLETED'
    }
  ];

  // 교육부 보고서용 CSV 파일 내보내기 함수
  const exportKpiCsv = () => {
    const headers = ['강좌ID', '강좌명', '과정구분', '지도강사', '신청인원', '수료인원', '수료율(%)', '만족도(5.0)', '취업/전직자수', '상태'];
    const rows = courseKpiList.map(c => [
      c.id,
      `"${c.title}"`,
      `"${c.category}"`,
      `"${c.instructorName}"`,
      c.enrolled,
      c.completed,
      `${c.completionRate}%`,
      c.satisfaction,
      c.employedCount,
      c.status === 'COMPLETED' ? '운영완료' : '운영중'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `울산과학대_평생직업교육_KPI_성과보고서_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* 1. 상단 타이틀 및 보고서 내보내기 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 bg-uc-navy text-white text-xs font-bold rounded-md">
              앵커사업단 RCC센터 관리자
            </span>
            <span className="text-xs text-slate-500 font-semibold">
              평생직업교육 성과관리 시스템
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            사업단 핵심 성과 지표 (KPI) 대시보드
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            지자체-대학 협력 기반 울산 지역성장 인재양성 앵커체계의 교육 실적 및 연차평가 지표를 종합 집계합니다.
          </p>
        </div>

        {/* 컨트롤 필터 및 CSV 내보내기 버튼 */}
        <div className="flex items-center space-x-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            aria-label="성과 측정 연도 선택"
            className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-uc-navy"
          >
            <option value="2026">2026년도 실적</option>
            <option value="2025">2025년도 실적</option>
          </select>

          <button
            onClick={exportKpiCsv}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition"
          >
            <Download className="w-4 h-4" />
            <span>성과 보고서(CSV) 다운로드</span>
          </button>
        </div>
      </div>

      {/* 2. 상단 4대 핵심 KPI 카드 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {/* KPI 1: 누적 수료생 수 */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">누적 이수/수료 인원</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-slate-900">{kpiSummary.totalCompleted}</span>
            <span className="text-sm font-semibold text-slate-500">/ {kpiSummary.totalEnrolled}명</span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-slate-600 mb-1">
              <span>연간 목표 달성률</span>
              <span className="font-bold text-blue-600">{(kpiSummary.totalCompleted / kpiSummary.targetEnrolled * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(kpiSummary.totalCompleted / kpiSummary.targetEnrolled * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* KPI 2: 평균 수료율 */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">과정 평균 수료율</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-slate-900">{kpiSummary.completionRate}%</span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              목표(85%) 초과달성
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            엄격한 80% 출석률 및 과제 기준에도 불구하고 우수한 밀착 지도 실현
          </p>
        </div>

        {/* KPI 3: 전반적 교육 만족도 */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">평생교육 종합 만족도</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Star className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-slate-900">{kpiSummary.overallSatisfaction}</span>
            <span className="text-sm font-semibold text-slate-500">/ 5.0 만점</span>
          </div>
          <div className="flex items-center space-x-1 text-amber-500 mt-3 text-xs font-semibold">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            ))}
            <span className="text-slate-600 ml-1.5">(총 742건 설문 응답)</span>
          </div>
        </div>

        {/* KPI 4: 취업/전직 및 지역산업체 연계 */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">취업 및 직무전환 성과</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-slate-900">{kpiSummary.employedOrPromoted}명</span>
            <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
              연계율 {kpiSummary.employedRate}%
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            울산 지역 3대 주력산업(조선, 자동차, 화학) 협력사 맞춤 채용
          </p>
        </div>
      </div>

      {/* 3. 2단 그리드: 4대 만족도 분석 & 학습자 구성 분석 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* 좌측 2열: 4대 영역 만족도 세부 점수 */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-uc-navy text-white flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                수료자 강의 만족도 4대 평가 영역 점수 (5점 척도)
              </h2>
            </div>
            <span className="text-xs font-medium text-slate-500">수료 시 의무 설문 기준</span>
          </div>

          <div className="space-y-5">
            {satisfactionBreakdown.map((item, idx) => {
              const percentage = (item.score / item.max) * 100;
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-slate-800">{item.label}</span>
                    <span className="text-uc-navy font-bold">{item.score} / {item.max}점</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex">
                    <div
                      className="bg-uc-navy h-3 rounded-full transition-all duration-700"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-xs text-slate-500 block">설문 응답률</span>
              <span className="text-base font-bold text-slate-900 mt-0.5 block">94.5%</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-xs text-slate-500 block">강사진 재추천 의향</span>
              <span className="text-base font-bold text-emerald-600 mt-0.5 block">98.2%</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl col-span-2 sm:col-span-1">
              <span className="text-xs text-slate-500 block">후속 심화과정 희망</span>
              <span className="text-base font-bold text-uc-orange mt-0.5 block">89.0%</span>
            </div>
          </div>
        </div>

        {/* 우측 1열: 수강생 인적 구성 및 재직자 현황 */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-uc-orange text-white flex items-center justify-center">
                <PieChart className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                수강생 대상별 구성 비율
              </h2>
            </div>

            {/* 재직자 vs 구직자 분포 바 */}
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-slate-800">울산 지역 산업체 재직자</span>
                  <span className="text-sm font-bold text-uc-navy">{kpiSummary.workerRatio}%</span>
                </div>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-uc-navy h-2.5 rounded-full"
                    style={{ width: `${kpiSummary.workerRatio}%` }}
                  ></div>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  중소·중견 제조기업 재직자 직무능력 향상
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-slate-800">미취업 청년 및 신중년 구직자</span>
                  <span className="text-sm font-bold text-uc-orange">{kpiSummary.jobSeekerRatio}%</span>
                </div>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-uc-orange h-2.5 rounded-full"
                    style={{ width: `${kpiSummary.jobSeekerRatio}%` }}
                  ></div>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  신산업 분야 취업 연계형 직업전환 교육
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 bg-amber-50/60 p-3.5 rounded-xl text-xs text-amber-900 leading-relaxed">
            💡 <strong>지자체 권고사항 준수:</strong> 지역 산업체 재직자 참여 비율 60% 이상 권고 목표를 충족(64.2%)하고 있습니다.
          </div>
        </div>
      </div>

      {/* 4. 개별 강좌별 세부 실적 테이블 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              2026년도 개설 강좌별 교육 성과 상세 현황
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              각 과정별 수강인원, 수료율, 만족도 및 취업 연계 성과를 한눈에 비교할 수 있습니다.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
              <CheckCircle className="w-3.5 h-3.5 mr-1" />
              전 과정 수료율 90% 이상 달성
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600 font-bold text-xs uppercase tracking-wider text-center">
              <tr>
                <th className="py-3.5 px-4 text-left">과정명 및 분야</th>
                <th className="py-3.5 px-4">지도교수/강사</th>
                <th className="py-3.5 px-4">신청인원</th>
                <th className="py-3.5 px-4">수료인원</th>
                <th className="py-3.5 px-4">수료율</th>
                <th className="py-3.5 px-4">만족도 (5.0)</th>
                <th className="py-3.5 px-4">취업·전직자</th>
                <th className="py-3.5 px-4">운영현황</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-center">
              {courseKpiList.map((course) => (
                <tr key={course.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-4 px-4 text-left">
                    <div className="font-bold text-slate-900">{course.title}</div>
                    <span className="inline-block mt-0.5 text-xs text-uc-navy font-semibold">
                      {course.category}
                    </span>
                  </td>
                  <td className="py-4 px-4 font-medium text-slate-800">
                    {course.instructorName}
                  </td>
                  <td className="py-4 px-4 font-semibold text-slate-800">
                    {course.enrolled}명
                  </td>
                  <td className="py-4 px-4 font-bold text-blue-600">
                    {course.completed}명
                  </td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                      {course.completionRate}%
                    </span>
                  </td>
                  <td className="py-4 px-4 font-bold text-amber-600">
                    ★ {course.satisfaction}
                  </td>
                  <td className="py-4 px-4 font-bold text-purple-700">
                    {course.employedCount}명
                  </td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      수료 완료
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. 하단 바로가기 네비게이션 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/admin/instructors"
          className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-uc-navy transition flex items-center justify-between group"
        >
          <div>
            <h3 className="font-bold text-slate-900 group-hover:text-uc-navy transition">
              강사료 정산 및 강의계획서 심사 바로가기
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              산업체 전문가 강사 풀 승인 및 3.3% 원천징수 자동 정산 대시보드
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-uc-navy group-hover:translate-x-1 transition" />
        </Link>

        <Link
          href="/verify"
          className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-600 transition flex items-center justify-between group"
        >
          <div>
            <h3 className="font-bold text-slate-900 group-hover:text-emerald-700 transition">
              수료증 위·변조 진위 검증 포털 바로가기
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              발급된 수료증 번호 및 SHA-256 전자 해시 무결성 실시간 대조
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-1 transition" />
        </Link>
      </div>
    </div>
  );
}
