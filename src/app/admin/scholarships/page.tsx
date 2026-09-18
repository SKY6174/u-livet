'use client';

// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 장학금 지급 심사 및 정산 대시보드
// ==============================================================================
// 파일 경로: src/app/admin/scholarships/page.tsx
// 설명:
//   1. 교육부 앵커사업 및 울산시 평생직업교육 장학금 예산 집행을 총괄 관리합니다.
//   2. 수료 기준(출석률 80% 이상, 성적 60점 이상)을 충족한 학습자를 시스템이 자동 선별합니다.
//   3. 금융 계좌 마스킹 처리(보안 8원칙)를 적용하여 안전하게 이체 심사를 진행합니다.
//   4. 교육부 및 지자체 연차평가 보고서 증빙용 [장학금 지급 대장 CSV]를 다운로드합니다.
// ==============================================================================

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Coins, 
  CheckCircle2, 
  Clock, 
  Download, 
  Search, 
  Filter, 
  ShieldCheck, 
  AlertCircle, 
  UserCheck, 
  Building, 
  FileSpreadsheet,
  ChevronRight
} from 'lucide-react';

// 장학금 수혜 대상자 인터페이스
interface ScholarshipDisbursementItem {
  id: string;
  scholarshipCode: string;
  scholarshipName: string;
  learnerName: string;
  learnerPhoneMasked: string;
  courseTitle: string;
  attendanceRate: number;
  finalScore: number;
  isCompleted: boolean;
  amount: number;
  bankName: string;
  accountMasked: string;
  accountHolder: string;
  status: 'ELIGIBLE' | 'APPROVED' | 'PAID' | 'REJECTED';
  appliedDate: string;
}

export default function AdminScholarshipsPage() {
  // 탭 필터 관리 ('ALL' | 'ELIGIBLE' | 'APPROVED' | 'PAID')
  const [activeTab, setActiveTab] = useState<'ALL' | 'ELIGIBLE' | 'APPROVED' | 'PAID'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 장학금 예산 총괄 요약
  const budgetSummary = {
    totalBudget: 250000000, // 2억 5천만원
    disbursedAmount: 218400000, // 지급 완료액
    pendingAmount: 17100000, // 지급 대기액
    totalBeneficiaries: 728, // 누적 수혜자 수
    pendingCount: 57 // 심사 대기 건수
  };

  // 장학금 수혜 심사 대상자 목록
  const [disbursements, setDisbursements] = useState<ScholarshipDisbursementItem[]>([
    {
      id: 'dsb-01',
      scholarshipCode: 'SCH-ANCHOR-INNOV',
      scholarshipName: '앵커 미래인재 혁신 장학금 (전액환급)',
      learnerName: '김울산',
      learnerPhoneMasked: '010-****-5678',
      courseTitle: '조선해양 미래 친환경 스마트 선박 실무 과정',
      attendanceRate: 95.0,
      finalScore: 94.5,
      isCompleted: true,
      amount: 300000,
      bankName: '하나은행',
      accountMasked: '123-****-5678',
      accountHolder: '김울산',
      status: 'PAID',
      appliedDate: '2026.08.26'
    },
    {
      id: 'dsb-02',
      scholarshipCode: 'SCH-ANCHOR-INNOV',
      scholarshipName: '앵커 미래인재 혁신 장학금 (전액환급)',
      learnerName: '이동현',
      learnerPhoneMasked: '010-****-1234',
      courseTitle: '이차전지 스마트 팩토리 품질관리 엔지니어 양성',
      attendanceRate: 91.5,
      finalScore: 89.0,
      isCompleted: true,
      amount: 300000,
      bankName: '국민은행',
      accountMasked: '456-****-7890',
      accountHolder: '이동현',
      status: 'APPROVED',
      appliedDate: '2026.08.28'
    },
    {
      id: 'dsb-03',
      scholarshipCode: 'SCH-WORKER-RE',
      scholarshipName: '울산 주력제조 재직자 역량도약 장학금',
      learnerName: '박서준',
      learnerPhoneMasked: '010-****-9876',
      courseTitle: '스마트 물류 자동화 시스템 PLC 제어',
      attendanceRate: 90.0,
      finalScore: 85.0,
      isCompleted: true,
      amount: 150000,
      bankName: '부산은행',
      accountMasked: '012-****-3456',
      accountHolder: '박서준',
      status: 'ELIGIBLE',
      appliedDate: '2026.09.01'
    },
    {
      id: 'dsb-04',
      scholarshipCode: 'SCH-HOPE-YOUTH',
      scholarshipName: '청년·신중년 구직희망 훈련장려금',
      learnerName: '최미소',
      learnerPhoneMasked: '010-****-4321',
      courseTitle: '생성형 AI를 활용한 제조 공정 최적화 및 빅데이터 실습',
      attendanceRate: 94.0,
      finalScore: 92.0,
      isCompleted: true,
      amount: 200000,
      bankName: '농협은행',
      accountMasked: '302-****-6543',
      accountHolder: '최미소',
      status: 'ELIGIBLE',
      appliedDate: '2026.09.05'
    }
  ]);

  // 개별 상태 변경 (지급 승인 및 이체 처리)
  const handleUpdateStatus = (id: string, newStatus: 'APPROVED' | 'PAID' | 'REJECTED') => {
    setDisbursements(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, status: newStatus };
      }
      return item;
    }));
  };

  // 일괄 승인 처리
  const handleBatchApprove = () => {
    setDisbursements(prev => prev.map(item => {
      if (item.status === 'ELIGIBLE') {
        return { ...item, status: 'APPROVED' };
      }
      return item;
    }));
    alert('심사 대기 상태인 모든 건이 일괄 [지급 승인] 처리되었습니다.');
  };

  // 정산 대장 CSV 다운로드 함수
  const exportScholarshipCsv = () => {
    const headers = ['신청ID', '장학금명', '수료자성명', '연락처', '수료과정명', '출석률(%)', '성적', '지급액(원)', '입금은행', '계좌번호', '예금주', '상태'];
    const rows = disbursements.map(d => [
      d.id,
      `"${d.scholarshipName}"`,
      `"${d.learnerName}"`,
      d.learnerPhoneMasked,
      `"${d.courseTitle}"`,
      `${d.attendanceRate}%`,
      d.finalScore,
      d.amount,
      d.bankName,
      d.accountMasked,
      `"${d.accountHolder}"`,
      d.status === 'PAID' ? '지급완료' : d.status === 'APPROVED' ? '승인완료(이체대기)' : '자격충족(심사대기)'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `울산과학대_장학금_지급정산대장_2026.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 필터링 적용
  const filteredDisbursements = disbursements.filter(item => {
    const matchesTab = activeTab === 'ALL' || item.status === activeTab;
    const matchesQuery = item.learnerName.includes(searchQuery) ||
                         item.courseTitle.includes(searchQuery) ||
                         item.scholarshipName.includes(searchQuery);
    return matchesTab && matchesQuery;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* 1. 상단 타이틀 및 정산 CSV 내보내기 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 bg-uc-navy text-white text-xs font-bold rounded-md">
              앵커 성과 및 장학금 정산
            </span>
            <span className="text-xs text-slate-500 font-semibold">
              평생직업교육 학습비 지원 관리
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            평생직업교육 장학금 지급 심사 및 정산 대시보드
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            수료 요건(출석률 80% + 평가 60점)을 통과한 학습자를 자동 선별하여 수강료 환급 및 장학금을 지급합니다.
          </p>
        </div>

        {/* 일괄 승인 및 엑셀 다운로드 */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleBatchApprove}
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 bg-uc-navy hover:bg-uc-navy-light text-white rounded-xl text-sm font-bold shadow-sm transition"
          >
            <UserCheck className="w-4 h-4" />
            <span>선발자 일괄 승인</span>
          </button>

          <button
            onClick={exportScholarshipCsv}
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition"
          >
            <Download className="w-4 h-4" />
            <span>정산 대장(CSV) 다운로드</span>
          </button>
        </div>
      </div>

      {/* 2. 장학금 예산 집행 핵심 지표 카드 4종 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase block">총 배정 장학 예산</span>
          <strong className="text-2xl font-black text-slate-900 block mt-1">
            {budgetSummary.totalBudget.toLocaleString()}원
          </strong>
          <span className="text-xs text-slate-400 mt-2 block">교육부·울산시 앵커사업 예산</span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase block">지급 완료 누적액</span>
          <strong className="text-2xl font-black text-emerald-600 block mt-1">
            {budgetSummary.disbursedAmount.toLocaleString()}원
          </strong>
          <span className="text-xs text-emerald-600 font-semibold mt-2 block">
            집행률 {(budgetSummary.disbursedAmount / budgetSummary.totalBudget * 100).toFixed(1)}%
          </span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase block">지급 완료 수혜 인원</span>
          <strong className="text-2xl font-black text-blue-600 block mt-1">
            {budgetSummary.totalBeneficiaries}명
          </strong>
          <span className="text-xs text-slate-400 mt-2 block">전체 수료자의 92.7% 수혜</span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase block">심사 및 이체 대기</span>
          <strong className="text-2xl font-black text-amber-600 block mt-1">
            {budgetSummary.pendingCount}건
          </strong>
          <span className="text-xs text-amber-600 font-semibold mt-2 block">
            대기액 {budgetSummary.pendingAmount.toLocaleString()}원
          </span>
        </div>
      </div>

      {/* 3. 장학금 수혜 심사 및 지급 대장 테이블 */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          {/* 탭 필터 */}
          <div className="flex items-center space-x-1.5 bg-slate-100 p-1.5 rounded-2xl w-fit">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'ALL' ? 'bg-white text-uc-navy shadow-sm' : 'text-slate-600'
              }`}
            >
              전체 ({disbursements.length})
            </button>
            <button
              onClick={() => setActiveTab('ELIGIBLE')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'ELIGIBLE' ? 'bg-white text-uc-navy shadow-sm' : 'text-slate-600'
              }`}
            >
              심사대기
            </button>
            <button
              onClick={() => setActiveTab('APPROVED')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'APPROVED' ? 'bg-white text-uc-navy shadow-sm' : 'text-slate-600'
              }`}
            >
              승인완료
            </button>
            <button
              onClick={() => setActiveTab('PAID')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'PAID' ? 'bg-white text-uc-navy shadow-sm' : 'text-slate-600'
              }`}
            >
              입금완료
            </button>
          </div>

          {/* 검색창 */}
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="수료자 성명, 강좌명 검색..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-uc-navy"
            />
          </div>
        </div>

        {/* 테이블 본체 */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600 font-bold text-xs uppercase tracking-wider text-center">
              <tr>
                <th className="py-3.5 px-4 text-left">수료자 및 강좌</th>
                <th className="py-3.5 px-4 text-left">장학금 명칭</th>
                <th className="py-3.5 px-4">출석률 / 성적</th>
                <th className="py-3.5 px-4">지급 확정액</th>
                <th className="py-3.5 px-4">입금 계좌 (보안 마스킹)</th>
                <th className="py-3.5 px-4">지급 상태</th>
                <th className="py-3.5 px-4">심사 및 액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-center">
              {filteredDisbursements.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-4 px-4 text-left">
                    <div className="font-bold text-slate-900">{item.learnerName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{item.courseTitle}</div>
                  </td>
                  <td className="py-4 px-4 text-left text-xs font-semibold text-uc-navy">
                    {item.scholarshipName}
                  </td>
                  <td className="py-4 px-4 text-xs font-bold text-slate-700">
                    <div>출석: {item.attendanceRate}%</div>
                    <div className="text-slate-400 font-normal">성적: {item.finalScore}점</div>
                  </td>
                  <td className="py-4 px-4 font-black text-amber-600">
                    {item.amount.toLocaleString()}원
                  </td>
                  <td className="py-4 px-4 font-mono text-xs text-slate-600">
                    <div>{item.bankName}</div>
                    <div>{item.accountMasked} ({item.accountHolder})</div>
                  </td>
                  <td className="py-4 px-4">
                    {item.status === 'PAID' && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        이체 완료
                      </span>
                    )}
                    {item.status === 'APPROVED' && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                        승인 완료 (이체대기)
                      </span>
                    )}
                    {item.status === 'ELIGIBLE' && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                        자동선발 (심사대기)
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center justify-center space-x-1.5">
                      {item.status === 'ELIGIBLE' && (
                        <button
                          onClick={() => handleUpdateStatus(item.id, 'APPROVED')}
                          className="px-2.5 py-1 bg-uc-navy hover:bg-uc-navy-light text-white text-xs font-bold rounded-lg transition"
                        >
                          승인
                        </button>
                      )}
                      {item.status === 'APPROVED' && (
                        <button
                          onClick={() => handleUpdateStatus(item.id, 'PAID')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition"
                        >
                          이체확정
                        </button>
                      )}
                      {item.status === 'PAID' && (
                        <span className="text-xs text-slate-400 font-semibold">정산완료</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
