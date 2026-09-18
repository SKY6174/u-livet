'use client';

// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 운영자 강사 심사 및 강사료 정산
// ==============================================================================
// 파일 경로: src/app/admin/instructors/page.tsx
// 설명:
//   사업단 운영자가 신규 신청 강사의 자격을 심사하여 등급(A/B/C)을 부여하고,
//   제출된 강의계획서를 승인하며, 실제 강의 시수 기반 강사료 및 원천징수(3.3%)
//   자동 계산 대장을 조회 및 엑셀로 내보내는 통합 행정 관리 화면입니다.
// ==============================================================================

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Users, 
  FileText, 
  Calculator, 
  CheckCircle2, 
  XCircle, 
  Download, 
  Search, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import type { InstructorTier } from '@/types/database';

export default function AdminInstructorManagementPage() {
  // 활성화된 탭 ('POOL_REVIEW' | 'SYLLABUS_REVIEW' | 'PAYROLL')
  const [activeTab, setActiveTab] = useState<'POOL_REVIEW' | 'SYLLABUS_REVIEW' | 'PAYROLL'>('PAYROLL');

  // 1. 강사 풀 심사 대상 데이터
  const [applicants, setApplicants] = useState([
    {
      id: 'ins-1',
      name: '김태진',
      specialty: '스마트 조선 선체 CAD 3D 블록 모델링',
      career: 'HD현대중공업 28년 근무, 대한민국 명장',
      education: '울산대 공학박사',
      applied_at: '2026.09.15',
      selected_tier: 'TIER_A' as InstructorTier,
      status: 'PENDING',
    },
    {
      id: 'ins-2',
      name: '이수민',
      specialty: '친환경 미래모빌리티 배터리 패키징',
      career: '현대모비스 연구원 12년',
      education: 'KAIST 기계공학 석사',
      applied_at: '2026.09.16',
      selected_tier: 'TIER_B' as InstructorTier,
      status: 'PENDING',
    },
  ]);

  // 2. 강사료 정산 대상 데이터 (실제 강의 진행 시수 기반)
  const payrollData = [
    {
      id: 'pay-1',
      instructor_name: '김태진 명장',
      course_title: '스마트 조선·해양 3D 선체 블록 모델링',
      tier: '특급 (TIER A)',
      hourly_rate: 120000,     // 시간당 120,000원
      conducted_hours: 45,     // 45시간 강의
      bank: '경남은행 123-**-****',
    },
    {
      id: 'pay-2',
      instructor_name: '박영수 교수',
      course_title: '산업용 생성형 AI와 스마트 팩토리 데이터 분석',
      tier: '고급 (TIER B)',
      hourly_rate: 80000,      // 시간당 80,000원
      conducted_hours: 30,     // 30시간 강의
      bank: '국민은행 456-**-****',
    },
    {
      id: 'pay-3',
      instructor_name: '최정호 기술사',
      course_title: '차세대 리튬이온 배터리 전극 제조 실습',
      tier: '고급 (TIER B)',
      hourly_rate: 85000,      // 시간당 85,000원
      conducted_hours: 40,     // 40시간 강의
      bank: '하나은행 789-**-****',
    },
  ];

  // 강사 승인 처리
  const handleApproveInstructor = (id: string) => {
    setApplicants((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'APPROVED' } : item))
    );
    alert('해당 강사가 승인되어 강사 풀 및 강좌 배정 대상자로 정식 등록되었습니다.');
  };

  // 엑셀(CSV) 내보내기 다운로드 함수
  const handleExportCsv = () => {
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += '강사명,강좌명,등급,시간당단가,강의시수,총지급액,소득세(3%),주민세(0.3%),실지급액,입금계좌\n';

    payrollData.forEach((row) => {
      const gross = row.hourly_rate * row.conducted_hours;
      const taxIncome = Math.floor(gross * 0.03);
      const taxResident = Math.floor(gross * 0.003);
      const netPay = gross - taxIncome - taxResident;
      csvContent += `${row.instructor_name},${row.course_title},${row.tier},${row.hourly_rate},${row.conducted_hours},${gross},${taxIncome},${taxResident},${netPay},${row.bank}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `울산과학대_앵커사업단_강사료_정산조서_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-slate-50 min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 상단 헤더 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-uc-navy bg-slate-100 px-3 py-1 rounded-full mb-2 w-fit">
              <ShieldCheck className="w-3.5 h-3.5 text-uc-orange" />
              <span>사업단 행정 관리자 콘솔</span>
            </div>
            <h1 className="text-2xl font-extrabold text-uc-navy">
              강사 관리 및 강사료 정산 시스템
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              산업체 전문가 강사 풀 적격 심사, 강의계획서 승인 및 실제 강의 시수 기반 강사료 지급조서를 산출합니다.
            </p>
          </div>

          {/* 엑셀 내보내기 버튼 */}
          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow transition shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>강사료 정산조서 엑셀(CSV) 다운로드</span>
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 gap-1 text-xs font-bold w-fit shadow-sm">
          <button
            onClick={() => setActiveTab('PAYROLL')}
            className={`px-5 py-2.5 rounded-xl transition flex items-center space-x-2 ${
              activeTab === 'PAYROLL' ? 'bg-uc-navy text-white shadow' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>강사료 자동 정산 대장 (3건)</span>
          </button>
          <button
            onClick={() => setActiveTab('POOL_REVIEW')}
            className={`px-5 py-2.5 rounded-xl transition flex items-center space-x-2 ${
              activeTab === 'POOL_REVIEW' ? 'bg-uc-navy text-white shadow' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>신규 강사 자격 심사 (2건)</span>
          </button>
          <button
            onClick={() => setActiveTab('SYLLABUS_REVIEW')}
            className={`px-5 py-2.5 rounded-xl transition flex items-center space-x-2 ${
              activeTab === 'SYLLABUS_REVIEW' ? 'bg-uc-navy text-white shadow' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>강의계획서 승인 대기 (1건)</span>
          </button>
        </div>

        {/* 탭 1: 강사료 자동 정산 대장 */}
        {activeTab === 'PAYROLL' && (
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm space-y-4 p-6">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">당월 평생직업교육 강사료 지급 내역</h3>
                <span className="text-xs text-slate-500">소득세 3% + 지방소득세 0.3% 원천징수 공제액이 자동 산출됩니다.</span>
              </div>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                사업소득세(3.3%) 원천징수 적용중
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-y border-slate-200">
                  <tr>
                    <th className="p-3">강사명</th>
                    <th className="p-3">담당 강좌명</th>
                    <th className="p-3">자격 등급</th>
                    <th className="p-3 text-right">시간당 단가</th>
                    <th className="p-3 text-center">강의 시수</th>
                    <th className="p-3 text-right">총 지급액</th>
                    <th className="p-3 text-right text-rose-600">원천징수(3.3%)</th>
                    <th className="p-3 text-right text-emerald-700 font-extrabold">실 지급액</th>
                    <th className="p-3">지급 계좌 (보안 마스킹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payrollData.map((row) => {
                    const gross = row.hourly_rate * row.conducted_hours;
                    const taxIncome = Math.floor(gross * 0.03);
                    const taxResident = Math.floor(gross * 0.003);
                    const totalTax = taxIncome + taxResident;
                    const netPay = gross - totalTax;

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-3 font-bold text-slate-900">{row.instructor_name}</td>
                        <td className="p-3 text-slate-700">{row.course_title}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                            {row.tier}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono">{row.hourly_rate.toLocaleString()}원</td>
                        <td className="p-3 text-center font-bold">{row.conducted_hours}시간</td>
                        <td className="p-3 text-right font-bold font-mono text-slate-900">
                          {gross.toLocaleString()}원
                        </td>
                        <td className="p-3 text-right font-mono text-rose-600">
                          -{totalTax.toLocaleString()}원
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-700 font-bold text-sm">
                          {netPay.toLocaleString()}원
                        </td>
                        <td className="p-3 text-slate-500 font-mono">{row.bank}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 탭 2: 신규 강사 자격 심사 */}
        {activeTab === 'POOL_REVIEW' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              강사 풀(Pool) 등록 신청자 자격 심사
            </h3>

            <div className="space-y-4">
              {applicants.map((ins) => (
                <div key={ins.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <strong className="text-sm text-slate-900">{ins.name}</strong>
                      <span className="text-xs text-slate-500">신청일: {ins.applied_at}</span>
                      {ins.status === 'APPROVED' && (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">
                          승인완료
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700">전문분야: <strong>{ins.specialty}</strong></p>
                    <p className="text-xs text-slate-600">경력/학력: {ins.career} | {ins.education}</p>
                  </div>

                  {ins.status === 'PENDING' ? (
                    <div className="flex items-center space-x-2 shrink-0">
                      <select
                        value={ins.selected_tier}
                        onChange={(e) => {
                          const val = e.target.value as InstructorTier;
                          setApplicants((prev) =>
                            prev.map((i) => (i.id === ins.id ? { ...i, selected_tier: val } : i))
                          );
                        }}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                      >
                        <option value="TIER_A">특급 (TIER A)</option>
                        <option value="TIER_B">고급 (TIER B)</option>
                        <option value="TIER_C">일반 (TIER C)</option>
                      </select>
                      <button
                        onClick={() => handleApproveInstructor(ins.id)}
                        className="px-4 py-2 bg-uc-navy hover:bg-uc-navy-light text-white rounded-lg text-xs font-bold transition shadow"
                      >
                        자격 승인
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 font-semibold">심사 완료됨</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 탭 3: 강의계획서 심사 */}
        {activeTab === 'SYLLABUS_REVIEW' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              제출된 강의계획서(Syllabus) 개설 심사
            </h3>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="px-2.5 py-0.5 rounded bg-blue-50 text-uc-navy font-bold text-xs">
                    조선·해양산업
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 mt-1">
                    친환경 수소선박 연료전지 파워팩 설계 및 안전운항 실무
                  </h4>
                  <span className="text-xs text-slate-500">
                    제안 강사: 김태진 대한민국 명장 | 총 45시간 (혼합교육)
                  </span>
                </div>
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">
                  심사 대기중
                </span>
              </div>

              <p className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-100">
                수소선박 연료전지 시스템의 기본 구조와 가스누출 안전 감지, PMS 시뮬레이션 실무를 포괄하는
                교육과정으로 산업체 현장 인력 재교육에 매우 적합함.
              </p>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => alert('보완 요청 사항이 강사에게 전송되었습니다.')}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition"
                >
                  보완 요청
                </button>
                <button
                  onClick={() => alert('강좌 개설이 승인되어 수강생 모집 상태로 등록되었습니다!')}
                  className="px-4 py-2 bg-uc-navy hover:bg-uc-navy-light text-white rounded-lg text-xs font-bold transition shadow"
                >
                  정규 강좌 개설 승인
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
