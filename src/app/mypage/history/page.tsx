'use client';

// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 수강자 평생 수강이력 및 학업증명
// ==============================================================================
// 파일 경로: src/app/mypage/history/page.tsx
// 설명:
//   1. 학습자 본인의 전 생애 평생직업교육 수강 이력, 총 이수 시간, 성적, 출석률을 종합 관리합니다.
//   2. 각 강좌별 배정된 캠퍼스 및 강의실/실습실 정보를 실시간으로 안내합니다.
//   3. 취득한 공식 전자수료증 재열람 및 취업/이직 제출용 [평생직업교육 수강·이수증명서] 인쇄를 지원합니다.
//   4. Open Badges v2.0 규격의 [나의 디지털 배지 지갑(Badge Wallet)] 및 링크드인 연동을 지원합니다.
//   5. RIS 미래인재 장학금 등 수강료 환급 및 장학금 수혜 정산 내역을 투명하게 공개합니다.
// ==============================================================================

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  GraduationCap, 
  Clock, 
  Award, 
  CheckCircle2, 
  MapPin, 
  Printer, 
  Coins, 
  ChevronRight, 
  Calendar,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Tag
} from 'lucide-react';

// 수강 이력 데이터 인터페이스
interface CourseHistoryItem {
  enrollmentId: string;
  courseTitle: string;
  category: string;
  period: string;
  totalHours: number;
  attendanceRate: number;
  finalScore: number;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'CANCELLED';
  assignedClassroom: {
    campus: string;
    building: string;
    room: string;
    name: string;
  };
  certificateNo?: string;
  hasScholarship: boolean;
  scholarshipAmount?: number;
  badgeId?: string;
}

// 장학금 수혜 내역 인터페이스
interface ScholarshipHistoryItem {
  id: string;
  scholarshipName: string;
  courseTitle: string;
  amount: number;
  status: 'PAID' | 'APPROVED' | 'ELIGIBLE';
  bankName: string;
  accountNumberMasked: string;
  paidAt?: string;
}

// 디지털 배지 인터페이스
interface MyBadgeItem {
  id: string;
  badgeCode: string;
  name: string;
  level: string;
  courseTitle: string;
  issuedDate: string;
  skills: string[];
}

export default function LearnerHistoryPage() {
  // 인쇄용 증명서 모달 열림 상태 관리
  const [showCertificateModal, setShowCertificateModal] = useState<boolean>(false);

  // 학습자 기본 정보 (시연용 목업)
  const learnerProfile = {
    name: '김울산',
    birthDate: '1985.**.**',
    learnerId: 'UC-ST-20260842',
    totalCompletedHours: 64,
    totalEnrolledCourses: 3,
    totalScholarshipGranted: 300000,
    totalBadgesEarned: 1
  };

  // 평생직업교육 수강 이력 목록
  const courseHistoryList: CourseHistoryItem[] = [
    {
      enrollmentId: 'enr-01',
      courseTitle: '조선해양 미래 친환경 스마트 선박 실무 과정',
      category: '신산업 특화 직무전환',
      period: '2026.07.01 ~ 2026.08.25',
      totalHours: 64,
      attendanceRate: 95.0,
      finalScore: 94.5,
      status: 'COMPLETED',
      assignedClassroom: {
        campus: '동부캠퍼스',
        building: '3공학관',
        room: '204호',
        name: '스마트선박 3D설계 실습실'
      },
      certificateNo: 'UC-ANCHOR-2026-00042',
      badgeId: 'badge-uc-2026-0042',
      hasScholarship: true,
      scholarshipAmount: 300000
    },
    {
      enrollmentId: 'enr-02',
      courseTitle: '스마트 조선·해양 3D 선체 블록 모델링 및 검사 실무',
      category: '조선·해양',
      period: '2026.10.15 ~ 2026.11.20',
      totalHours: 45,
      attendanceRate: 84.4,
      finalScore: 88.0,
      status: 'IN_PROGRESS',
      assignedClassroom: {
        campus: '동부캠퍼스',
        building: '3공학관',
        room: '204호',
        name: '스마트선박 3D설계 실습실'
      },
      hasScholarship: true,
      scholarshipAmount: 300000
    },
    {
      enrollmentId: 'enr-03',
      courseTitle: '산업용 생성형 AI와 스마트 팩토리 공정 데이터 분석 기초',
      category: '디지털·스마트제조',
      period: '2026.11.01 ~ 2026.12.15',
      totalHours: 30,
      attendanceRate: 68.0,
      finalScore: 72.0,
      status: 'IN_PROGRESS',
      assignedClassroom: {
        campus: '서부캠퍼스',
        building: '융합실습동',
        room: '102호',
        name: '스마트팩토리 PLC 로봇제어 실습실'
      },
      hasScholarship: false
    }
  ];

  // 취득한 디지털 배지 목록
  const myBadges: MyBadgeItem[] = [
    {
      id: 'badge-uc-2026-0042',
      badgeCode: 'BDG-SMART-SHIP-2026',
      name: '스마트 친환경 선박 3D설계 직무 마스터 배지',
      level: 'MASTER',
      courseTitle: '조선해양 미래 친환경 스마트 선박 실무 과정',
      issuedDate: '2026.08.26',
      skills: ['스마트선박', '선체3D모델링', '친환경추진체계', '선박품질검사']
    }
  ];

  // 장학금 수혜 정산 내역
  const scholarshipHistoryList: ScholarshipHistoryItem[] = [
    {
      id: 'sch-01',
      scholarshipName: 'RIS 미래인재 혁신 장학금 (수강료 100% 환급)',
      courseTitle: '조선해양 미래 친환경 스마트 선박 실무 과정',
      amount: 300000,
      status: 'PAID',
      bankName: '하나은행',
      accountNumberMasked: '123-****-5678',
      paidAt: '2026.08.30'
    },
    {
      id: 'sch-02',
      scholarshipName: 'RIS 미래인재 혁신 장학금 (수료 예정자 환급 대기)',
      courseTitle: '스마트 조선·해양 3D 선체 블록 모델링 및 검사 실무',
      amount: 300000,
      status: 'ELIGIBLE',
      bankName: '하나은행',
      accountNumberMasked: '123-****-5678'
    }
  ];

  // 공식 이수증명서 인쇄 실행
  const handlePrintTranscript = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* 1. 상단 프로필 및 평생학습 누적 지표 헤더 */}
      <div className="bg-gradient-to-r from-uc-navy to-slate-900 text-white rounded-3xl p-8 sm:p-10 shadow-sm mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <span className="px-3 py-1 bg-uc-orange/20 text-uc-orange text-xs font-bold rounded-lg border border-uc-orange/30">
                평생학습 이력관리
              </span>
              <span className="text-xs text-slate-300">
                학습자 등록번호: {learnerProfile.learnerId}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black">
              {learnerProfile.name} 님의 평생직업교육 수강 및 학업 이력
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              울산과학대학교 앵커사업단 RCC센터에서 이수한 모든 직무 교육 내역, 디지털 배지 및 장학 혜택입니다.
            </p>
          </div>

          {/* 공식 증명서 인쇄 호출 버튼 */}
          <button
            onClick={() => setShowCertificateModal(true)}
            className="flex items-center space-x-2 px-5 py-3 bg-white hover:bg-slate-100 text-uc-navy rounded-2xl font-bold text-sm shadow-md transition shrink-0"
          >
            <Printer className="w-4 h-4" />
            <span>수강·이수증명서 발급/인쇄</span>
          </button>
        </div>

        {/* 4대 누적 성과 지표 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-8 border-t border-white/10">
          <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center space-x-4">
            <div className="w-11 h-11 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block">총 누적 이수 시수</span>
              <strong className="text-xl sm:text-2xl font-black text-white">{learnerProfile.totalCompletedHours} 시간</strong>
            </div>
          </div>

          <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center space-x-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block">정식 수료 및 자격</span>
              <strong className="text-xl sm:text-2xl font-black text-emerald-300">1 건 (수료증)</strong>
            </div>
          </div>

          <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center space-x-4">
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block">취득 디지털 배지</span>
              <strong className="text-xl sm:text-2xl font-black text-amber-300">
                {learnerProfile.totalBadgesEarned} 개 (Open Badge)
              </strong>
            </div>
          </div>

          <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center space-x-4">
            <div className="w-11 h-11 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block">누적 장학금 수혜액</span>
              <strong className="text-xl sm:text-2xl font-black text-purple-300">
                {learnerProfile.totalScholarshipGranted.toLocaleString()} 원
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* 2. [신규] 나의 취득 디지털 배지 컬렉션 (Open Badges Wallet) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 text-xs font-bold rounded-md">
                1EdTech Open Badges v2.0
              </span>
              <span className="text-xs text-slate-400 font-semibold">LinkedIn 자격증 직접 연동</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2 mt-1">
              <Sparkles className="w-6 h-6 text-amber-500" />
              <span>나의 취득 디지털 배지 컬렉션 (Badge Wallet)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              공식 수료를 통해 검증된 직무 역량을 링크드인(LinkedIn) 및 글로벌 배지 지갑에 등록할 수 있습니다.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {myBadges.map((badge) => (
            <div
              key={badge.id}
              className="bg-gradient-to-br from-slate-900 to-uc-navy text-white rounded-3xl p-6 sm:p-7 shadow-md relative overflow-hidden flex flex-col justify-between"
            >
              {/* 배경 장식 원 */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none"></div>

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-black bg-amber-400 text-uc-navy uppercase tracking-wider">
                    {badge.level} BADGE
                  </span>
                  <span className="text-xs font-mono text-slate-300">
                    {badge.issuedDate} 수여
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white leading-snug">
                    {badge.name}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    {badge.courseTitle}
                  </p>
                </div>

                {/* 역량 태그 */}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {badge.skills.map((s, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-white/10 text-amber-300 text-[11px] font-semibold rounded-md"
                    >
                      #{s}
                    </span>
                  ))}
                </div>
              </div>

              {/* 하단 링크 버튼 */}
              <div className="relative z-10 pt-5 mt-5 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-emerald-400 font-semibold flex items-center">
                  <ShieldCheck className="w-4 h-4 mr-1" />
                  영구 인증 자격
                </span>

                <Link
                  href={`/badges/${badge.id}`}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-uc-navy text-xs font-bold rounded-xl shadow transition flex items-center space-x-1"
                >
                  <span>배지 확인 & LinkedIn 공유</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. 평생직업교육 수강 이력 목록 */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
              <GraduationCap className="w-6 h-6 text-uc-navy" />
              <span>개설 강좌별 수강 및 배정 강의실 이력</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              각 강좌별 진행 상태, 출석률, 성적 및 오프라인 실습실 위치를 확인하실 수 있습니다.
            </p>
          </div>
          <span className="text-xs text-slate-500 font-medium">총 {courseHistoryList.length}건 등록됨</span>
        </div>

        <div className="space-y-4">
          {courseHistoryList.map((item) => (
            <div
              key={item.enrollmentId}
              className="border border-slate-200 rounded-2xl p-5 sm:p-6 hover:border-uc-navy/50 transition bg-slate-50/50"
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* 강좌 정보 */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-blue-100 text-uc-navy font-bold rounded-md text-xs">
                      {item.category}
                    </span>
                    {item.status === 'COMPLETED' ? (
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-md text-xs flex items-center">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        수료 완료
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-md text-xs">
                        학습 진행 중
                      </span>
                    )}
                    {item.hasScholarship && (
                      <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 font-bold rounded-md text-xs">
                        장학금 지원 대상
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-slate-900">
                    {item.courseTitle}
                  </h3>

                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.period}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>총 {item.totalHours}시간</span>
                    </span>
                    <span className="font-semibold text-emerald-700">
                      출석률 {item.attendanceRate}% / 성적 {item.finalScore}점
                    </span>
                  </div>

                  {/* 배정 강의실 정보 매칭 박스 */}
                  <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 mt-2">
                    <MapPin className="w-4 h-4 text-uc-orange shrink-0" />
                    <span>
                      배정 실습실: <strong>{item.assignedClassroom.campus} {item.assignedClassroom.building} {item.assignedClassroom.room}</strong> ({item.assignedClassroom.name})
                    </span>
                  </div>
                </div>

                {/* 우측 액션 버튼 */}
                <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end">
                  {item.status === 'COMPLETED' && item.certificateNo && (
                    <div className="flex items-center gap-2">
                      {item.badgeId && (
                        <Link
                          href={`/badges/${item.badgeId}`}
                          className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center space-x-1"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>디지털 배지</span>
                        </Link>
                      )}
                      <Link
                        href={`/certificate/${item.certificateNo}`}
                        className="px-4 py-2 bg-uc-navy hover:bg-uc-navy-light text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center space-x-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>수료증 인쇄</span>
                      </Link>
                      <Link
                        href={`/verify?cert=${item.certificateNo}`}
                        target="_blank"
                        className="px-3 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold rounded-xl transition"
                      >
                        진위 검증
                      </Link>
                    </div>
                  )}

                  {item.status === 'IN_PROGRESS' && (
                    <Link
                      href="/lms"
                      className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl shadow-sm transition flex items-center space-x-1.5"
                    >
                      <span>강의실 입장</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. 장학금 수혜 및 환급 정산 내역 섹션 */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Coins className="w-6 h-6 text-amber-500" />
            <h2 className="text-xl font-bold text-slate-900">
              평생직업교육 특화 장학금 수혜 및 정산 내역
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            * 수료 후 7영업일 이내 등록 계좌로 자동 입금됩니다.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600 font-bold text-xs uppercase tracking-wider text-center">
              <tr>
                <th className="py-3.5 px-4 text-left">장학금 명칭</th>
                <th className="py-3.5 px-4 text-left">대상 강좌명</th>
                <th className="py-3.5 px-4">지급 확정액</th>
                <th className="py-3.5 px-4">지급 계좌 (보안 마스킹)</th>
                <th className="py-3.5 px-4">진행 상태</th>
                <th className="py-3.5 px-4">지급 일자</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-center">
              {scholarshipHistoryList.map((sch) => (
                <tr key={sch.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-4 px-4 text-left font-bold text-slate-900">
                    {sch.scholarshipName}
                  </td>
                  <td className="py-4 px-4 text-left text-slate-700 font-medium">
                    {sch.courseTitle}
                  </td>
                  <td className="py-4 px-4 font-black text-amber-600">
                    {sch.amount.toLocaleString()}원
                  </td>
                  <td className="py-4 px-4 font-mono text-slate-600 text-xs">
                    {sch.bankName} {sch.accountNumberMasked}
                  </td>
                  <td className="py-4 px-4">
                    {sch.status === 'PAID' ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        입금 완료
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                        수료 심사진행 중
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-xs text-slate-500 font-medium">
                    {sch.paidAt || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. [인쇄용 다이얼로그] 공식 평생직업교육 수강·이수증명서 모달 */}
      {showCertificateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-8 sm:p-12 shadow-2xl relative border-4 border-slate-300 print:border-none print:shadow-none print:w-full print:max-w-none print:p-0">
            {/* 닫기 및 인쇄 버튼 바 (인쇄 시 자동 숨김) */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 print:hidden">
              <span className="text-xs font-bold text-uc-navy">
                🏛️ 울산과학대학교 공인 전자 증명서 뷰어
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePrintTranscript}
                  className="px-4 py-2 bg-uc-navy hover:bg-uc-navy-light text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow"
                >
                  <Printer className="w-4 h-4" />
                  <span>증명서 인쇄 / PDF 저장</span>
                </button>
                <button
                  onClick={() => setShowCertificateModal(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  닫기
                </button>
              </div>
            </div>

            {/* 증명서 본체 */}
            <div className="text-center my-6">
              <h2 className="text-3xl font-extrabold font-serif text-slate-900 tracking-widest mb-1">
                평생직업교육 수강 및 이수증명서
              </h2>
              <p className="text-xs font-medium text-slate-500 tracking-wider">
                OFFICIAL TRANSCRIPT OF LIFELONG VOCATIONAL EDUCATION
              </p>
            </div>

            {/* 인적사항 */}
            <div className="my-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs sm:text-sm grid grid-cols-2 gap-2 text-left">
              <div><strong>성&nbsp;&nbsp;&nbsp;&nbsp;명:</strong> {learnerProfile.name}</div>
              <div><strong>생년월일:</strong> {learnerProfile.birthDate}</div>
              <div><strong>학습자번호:</strong> {learnerProfile.learnerId}</div>
              <div><strong>총 이수시수:</strong> {learnerProfile.totalCompletedHours}시간</div>
            </div>

            {/* 수강 이수 테이블 */}
            <table className="w-full text-xs text-center border-collapse border border-slate-300 my-6">
              <thead className="bg-slate-100 font-bold">
                <tr>
                  <th className="border border-slate-300 py-2 px-2">과정명</th>
                  <th className="border border-slate-300 py-2 px-2">교육기간</th>
                  <th className="border border-slate-300 py-2 px-2">시수</th>
                  <th className="border border-slate-300 py-2 px-2">출석률</th>
                  <th className="border border-slate-300 py-2 px-2">성적</th>
                  <th className="border border-slate-300 py-2 px-2">이수구분</th>
                </tr>
              </thead>
              <tbody>
                {courseHistoryList.map((c) => (
                  <tr key={c.enrollmentId}>
                    <td className="border border-slate-300 py-2 px-2 text-left font-semibold">{c.courseTitle}</td>
                    <td className="border border-slate-300 py-2 px-2">{c.period}</td>
                    <td className="border border-slate-300 py-2 px-2">{c.totalHours}h</td>
                    <td className="border border-slate-300 py-2 px-2">{c.attendanceRate}%</td>
                    <td className="border border-slate-300 py-2 px-2">{c.finalScore}점</td>
                    <td className="border border-slate-300 py-2 px-2 font-bold text-uc-navy">
                      {c.status === 'COMPLETED' ? '이수완료' : '수강중'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 증명 문구 */}
            <p className="text-center text-sm font-serif text-slate-800 leading-relaxed my-8">
              위 사람은 교육부 및 울산광역시 주관 지자체-대학 협력기반 지역혁신사업(RIS)<br />
              평생직업교육 앵커사업의 일환으로 개설된 위 과정을 성실히 이수하였음을 증명합니다.
            </p>

            {/* 발급일 및 총장 직인 */}
            <div className="text-center my-6">
              <p className="text-sm font-bold text-slate-800">2026년 09월 18일</p>
              <div className="mt-4 text-xl font-bold font-serif text-slate-900 tracking-wider">
                울산과학대학교 총장 조홍래 · 앵커사업단 RCC센터장
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
