'use client';

// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 학습자 LMS 종합 대시보드
// ==============================================================================
// 파일 경로: src/app/lms/page.tsx
// 설명:
//   학습자가 현재 수강 중인 강좌 목록, 실시간 출석률(수료기준 80% 대비),
//   과제 제출 현황 및 수료증 발급 자격 달성 여부를 한눈에 모니터링하는 화면입니다.
// ==============================================================================

import React from 'react';
import Link from 'next/link';
import { 
  BookOpen, 
  CheckCircle2, 
  AlertTriangle, 
  QrCode, 
  Clock, 
  Award, 
  ChevronRight,
  TrendingUp,
  FileText
} from 'lucide-react';

export default function LmsDashboardPage() {
  // 학습자의 현재 수강 중인 강좌 목록 더미 데이터 (추후 Supabase course_enrollments 조회)
  const myCourses = [
    {
      enrollment_id: 'e1',
      course_id: 'c1',
      title: '스마트 조선·해양 3D 선체 블록 모델링 및 검사 실무',
      category: '조선·해양',
      instructor: '김태진 명장',
      period: '2026.10.15 ~ 2026.11.20',
      total_hours: 45,
      completed_hours: 38,
      attendance_rate: 84.4, // 출석률 84.4% (80% 이상으로 수료 가능권)
      assignments_total: 4,
      assignments_submitted: 3,
      is_ready_for_completion: false, // 아직 종강 전
      next_lecture: '2026.11.03 (화) 19:00 - 선체 외판 조립 실습 (3공학관 204호)',
    },
    {
      enrollment_id: 'e2',
      course_id: 'c3',
      title: '산업용 생성형 AI와 스마트 팩토리 공정 데이터 분석 기초',
      category: '디지털·스마트제조',
      instructor: '박영수 교수',
      period: '2026.11.01 ~ 2026.12.15',
      total_hours: 30,
      completed_hours: 12,
      attendance_rate: 68.0, // 출석률 68% (경고 표시)
      assignments_total: 2,
      assignments_submitted: 1,
      is_ready_for_completion: false,
      next_lecture: '온라인 자율수강 - 4차시: 이상치 탐지 알고리즘 실습',
    },
  ];

  return (
    <div className="bg-slate-50 min-h-screen py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* 1. 상단 환영 및 요약 대시보드 헤더 */}
        <div className="bg-gradient-to-r from-uc-navy to-slate-900 text-white rounded-3xl p-8 sm:p-10 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <span className="px-3 py-1 bg-uc-orange/20 text-uc-orange text-xs font-bold rounded-lg border border-uc-orange/30">
                LMS 학습자 모드
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold">
                홍길동 님의 평생직업교육 학습실
              </h1>
              <p className="text-sm text-slate-300">
                울산의 주력산업 전문 인재로 거듭나기 위한 학습 여정을 응원합니다.
              </p>
            </div>

            {/* 빠른 모바일 QR 출결 버튼 */}
            <Link
              href="/lms/attendance/qr"
              className="flex items-center space-x-2 px-6 py-3.5 bg-uc-orange hover:bg-uc-orange-hover text-white rounded-2xl font-bold text-sm shadow-md transition shrink-0"
            >
              <QrCode className="w-5 h-5" />
              <span>모바일 QR 전자출결 체크</span>
            </Link>
          </div>

          {/* 4대 핵심 지표 요약 그리드 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-8 border-t border-white/10 text-slate-200">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
              <span className="text-xs text-slate-400 block">수강 중인 과정</span>
              <strong className="text-2xl font-extrabold text-white">2개 강좌</strong>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
              <span className="text-xs text-slate-400 block">종합 평균 출석률</span>
              <strong className="text-2xl font-extrabold text-emerald-400">76.2%</strong>
              <span className="text-[11px] text-slate-400 block mt-0.5">목표 수료기준: 80%</span>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
              <span className="text-xs text-slate-400 block">과제 제출 현황</span>
              <strong className="text-2xl font-extrabold text-white">4 / 6개 완료</strong>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
              <span className="text-xs text-slate-400 block">취득 수료증</span>
              <strong className="text-2xl font-extrabold text-uc-orange">1건</strong>
            </div>
          </div>
        </div>

        {/* 2. 수강 중인 강좌 목록 섹션 */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl sm:text-2xl font-bold text-uc-navy flex items-center space-x-2">
              <BookOpen className="w-6 h-6 text-uc-blue" />
              <span>수강 중인 교육과정</span>
            </h2>
            <span className="text-xs text-slate-500">
              * 출석률 80% 이상 달성 시 수료증이 자동 발급됩니다.
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {myCourses.map((course) => {
              const isPassingAttendance = course.attendance_rate >= 80;

              return (
                <div
                  key={course.enrollment_id}
                  className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm hover:shadow-md transition space-y-6 flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* 상단 뱃지 및 강좌명 */}
                    <div className="flex justify-between items-start gap-2">
                      <span className="px-3 py-1 bg-blue-50 text-uc-navy font-bold rounded-lg text-xs">
                        {course.category}
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center space-x-1 ${
                        isPassingAttendance 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {isPassingAttendance ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>출석률 정상 (수료가능)</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>출석률 80% 미달 주의</span>
                          </>
                        )}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 leading-snug">
                      {course.title}
                    </h3>

                    <p className="text-xs text-slate-500">
                      담당교수: <strong>{course.instructor}</strong> | 교육기간: {course.period}
                    </p>

                    {/* 출석률 프로그레스 바 */}
                    <div className="bg-slate-50 p-4 rounded-2xl space-y-2 border border-slate-100">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-600">현재 누적 출석률</span>
                        <span className={isPassingAttendance ? 'text-emerald-600' : 'text-amber-600'}>
                          {course.attendance_rate}% ({course.completed_hours} / {course.total_hours}시간)
                        </span>
                      </div>

                      {/* 프로그레스 바 트랙 */}
                      <div className="relative w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isPassingAttendance ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, course.attendance_rate)}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>0%</span>
                        <span className="font-bold text-rose-500">▼ 수료 기준선 (80%)</span>
                        <span>100%</span>
                      </div>
                    </div>

                    {/* 다음 수업 안내 및 과제 */}
                    <div className="space-y-1 text-xs text-slate-600">
                      <div className="flex items-start space-x-2">
                        <Clock className="w-3.5 h-3.5 text-uc-blue shrink-0 mt-0.5" />
                        <span className="font-medium text-slate-800">{course.next_lecture}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>과제 제출: {course.assignments_submitted} / {course.assignments_total}건 완료</span>
                      </div>
                    </div>
                  </div>

                  {/* 하단 액션 버튼 그룹 */}
                  <div className="pt-4 border-t border-slate-100 flex gap-3">
                    <Link
                      href={`/lms/${course.course_id}`}
                      className="flex-1 flex items-center justify-center space-x-1.5 py-3.5 bg-uc-navy hover:bg-uc-navy-light text-white rounded-xl font-bold text-sm transition shadow-sm"
                    >
                      <span>강의실 입장</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                    <Link
                      href="/lms/attendance/qr"
                      className="px-4 py-3.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-semibold text-sm transition flex items-center space-x-1"
                      title="실습실 출석체크"
                    >
                      <QrCode className="w-4 h-4 text-uc-orange" />
                      <span>QR출결</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. 평생직업교육 수료 사정 가이드 카드 */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-3 text-uc-navy font-bold text-lg">
            <Award className="w-6 h-6 text-uc-orange" />
            <span>수료증 자동 발급 가이드 안내</span>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            종강일 이후 출석률이 <strong>80% 이상</strong>이고 평가 점수가 <strong>60점 이상</strong>인 경우,
            종강 설문조사를 완료하시면 즉시 <strong>[나의 이력관리]</strong> 페이지에서 
            위·변조 방지 QR코드가 날인된 고해상도 공식 수료증 PDF를 열람 및 인쇄하실 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
