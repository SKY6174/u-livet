'use client';

// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 차시별 스마트 강의실
// ==============================================================================
// 파일 경로: src/app/lms/[courseId]/page.tsx
// 설명:
//   주차별 강의 목록 탐색, 온라인 이러닝 동영상 시청 시간 자동 측정,
//   교재/실습 도면 다운로드, 그리고 과제 제출 및 강사 피드백을 확인하는 화면입니다.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  PlayCircle, 
  CheckCircle2, 
  FileText, 
  Download, 
  Upload, 
  Clock, 
  Award,
  Video,
  Send,
  AlertCircle
} from 'lucide-react';

export default function CourseLmsClassroomPage({ params }: { params: { courseId: string } }) {
  // 현재 선택된 차시 번호 (기본 1강)
  const [activeLectureOrder, setActiveLectureOrder] = useState<number>(1);
  // 활성화된 하단 탭 ('OVERVIEW', 'MATERIALS', 'ASSIGNMENT')
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'MATERIALS' | 'ASSIGNMENT'>('OVERVIEW');

  // 온라인 동영상 시청 시간 타이머 상태 (초 단위)
  const [watchSeconds, setWatchSeconds] = useState<number>(1420);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // 과제 제출 폼 상태
  const [assignmentText, setAssignmentText] = useState<string>('');
  const [assignmentSubmitted, setAssignmentSubmitted] = useState<boolean>(false);

  // 차시별 강의실 데이터
  const lectures = [
    {
      order: 1,
      title: '스마트선박 선체 3D 디지털 모델링 개론 및 실습환경 설정',
      is_online: true,
      duration_minutes: 45,
      required_seconds: 1800, // 30분 시청 필수
      current_watched_seconds: 1800,
      is_completed: true, // 출석 인정 완료
      date: '2026.10.15',
    },
    {
      order: 2,
      title: '선체 외판 형상 정의 및 부재 조립 시뮬레이션',
      is_online: true,
      duration_minutes: 40,
      required_seconds: 1800,
      current_watched_seconds: 1420, // 1420초 시청중
      is_completed: false,
      date: '2026.10.22',
    },
    {
      order: 3,
      title: '선체 블록 조립 3D CAD 정밀 공차 검사 (대면 집합실습)',
      is_online: false,
      duration_minutes: 180,
      is_completed: true,
      date: '2026.10.29 (3공학관 204호)',
    },
    {
      order: 4,
      title: '용접 변형 잔류응력 해석 및 최종 캡스톤 결과물 제출',
      is_online: false,
      duration_minutes: 180,
      is_completed: false,
      date: '2026.11.05 (대면실습 예정)',
    },
  ];

  // 동영상 재생 시뮬레이션 타이머
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(() => {
        setWatchSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlaying]);

  // 과제 제출 핸들러
  const handleAssignmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentText.trim()) {
      alert('과제 내용을 작성해 주세요.');
      return;
    }
    setAssignmentSubmitted(true);
    alert('과제가 성공적으로 제출되었습니다! 담당 강사의 채점 후 점수와 피드백이 등록됩니다.');
  };

  const currentLecture = lectures.find((l) => l.order === activeLectureOrder) || lectures[0];
  const requiredSeconds = currentLecture.required_seconds || 1800;
  const isAttendanceDone = watchSeconds >= requiredSeconds || currentLecture.is_completed;

  return (
    <div className="bg-slate-50 min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 상단 네비게이션 헤더 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <Link
              href="/lms"
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-uc-navy transition mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>나의 LMS 대시보드로 돌아가기</span>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-uc-navy">
              스마트 조선·해양 3D 선체 블록 모델링 및 검사 실무
            </h1>
            <span className="text-xs text-slate-500">
              담당 강사: 김태진 대한민국 명장 | 과정 진도율: 50% (2/4차시 이수 완료)
            </span>
          </div>

          <Link
            href="/lms/attendance/qr"
            className="px-5 py-3 bg-uc-orange hover:bg-uc-orange-hover text-white rounded-xl font-bold text-xs shadow transition shrink-0"
          >
            오프라인 QR 출결하기
          </Link>
        </div>

        {/* 2단 레이아웃: 좌측 차시 목록 / 우측 강의실 뷰어 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 좌측: 주차별 차시 목록 (1컬럼) */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4 h-fit">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              강의 차시 커리큘럼
            </h2>

            <div className="space-y-2">
              {lectures.map((item) => (
                <button
                  key={item.order}
                  onClick={() => {
                    setActiveLectureOrder(item.order);
                    if (item.order === 1) setWatchSeconds(1800);
                    else if (item.order === 2) setWatchSeconds(1420);
                  }}
                  className={`w-full text-left p-3.5 rounded-2xl transition border ${
                    activeLectureOrder === item.order
                      ? 'bg-blue-50/70 border-uc-blue/50 text-uc-navy shadow-sm'
                      : 'bg-slate-50 border-slate-200/70 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-bold">
                      {item.order}차시 ({item.is_online ? '온라인이러닝' : '대면실습'})
                    </span>
                    {item.is_completed ? (
                      <span className="text-emerald-600 font-bold flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>출석완료</span>
                      </span>
                    ) : (
                      <span className="text-amber-600 font-semibold">미완료</span>
                    )}
                  </div>
                  <h4 className="text-xs font-semibold leading-snug line-clamp-2">
                    {item.title}
                  </h4>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    {item.date}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 우측: 온라인 동영상 플레이어 및 탭 컨텐츠 (2컬럼) */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. 동영상 플레이어 영역 */}
            <div className="bg-slate-900 rounded-3xl overflow-hidden shadow-md text-white">
              {currentLecture.is_online ? (
                <div className="relative aspect-video bg-slate-950 flex flex-col justify-between p-6">
                  {/* 동영상 상단 헤더 */}
                  <div className="flex justify-between items-center text-xs text-slate-300">
                    <span className="flex items-center space-x-1.5 font-semibold">
                      <Video className="w-4 h-4 text-uc-orange" />
                      <span>{currentLecture.order}강: {currentLecture.title}</span>
                    </span>
                    <span className="bg-white/10 px-2 py-0.5 rounded text-[11px]">
                      최대 1.5배속 제한 적용중
                    </span>
                  </div>

                  {/* 중앙 플레이 버튼 */}
                  <div className="flex flex-col items-center justify-center py-10 space-y-3">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="w-16 h-16 rounded-full bg-uc-orange hover:bg-uc-orange-hover text-white flex items-center justify-center transition shadow-lg transform hover:scale-105"
                    >
                      <PlayCircle className="w-8 h-8" />
                    </button>
                    <span className="text-sm font-medium text-slate-300">
                      {isPlaying ? '재생 중 (시청 시간이 자동 집계됩니다)' : '강의 영상을 시작하려면 클릭하세요'}
                    </span>
                  </div>

                  {/* 하단 재생 컨트롤 및 출석 인정 프로그레스 */}
                  <div className="space-y-2 bg-slate-900/80 backdrop-blur-sm p-3 rounded-2xl border border-white/10">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>누적 시청시간: {Math.floor(watchSeconds / 60)}분 {watchSeconds % 60}초</span>
                      <span className={isAttendanceDone ? 'text-emerald-400' : 'text-uc-orange'}>
                        {isAttendanceDone ? '출석 인정 기준 충족 (완료)' : `출석 인정까지 ${Math.max(0, Math.ceil((requiredSeconds - watchSeconds) / 60))}분 남음`}
                      </span>
                    </div>

                    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-uc-orange rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, (watchSeconds / requiredSeconds) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* 오프라인 대면 강좌 안내 배너 */
                <div className="p-10 text-center space-y-4">
                  <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto text-uc-orange">
                    <Clock className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold">오프라인 현장 집합 실습 강좌입니다</h3>
                  <p className="text-sm text-slate-300 max-w-md mx-auto">
                    본 차시는 강의실(동부캠퍼스 3공학관 204호)에서 실습 장비를 활용해 대면으로 진행됩니다.
                    현장 입실 시 강의실 입구에 부착된 <strong>QR 코드</strong>를 스캔해 주세요.
                  </p>
                  <Link
                    href="/lms/attendance/qr"
                    className="inline-block px-6 py-3 bg-uc-orange hover:bg-uc-orange-hover text-white rounded-xl text-xs font-bold transition shadow"
                  >
                    모바일 QR 출석 화면으로 이동
                  </Link>
                </div>
              )}
            </div>

            {/* 2. 하단 탭 메뉴 (개요 / 강의자료실 / 과제제출) */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
              {/* 탭 네비게이션 버튼 */}
              <div className="flex border-b border-slate-100 gap-2 pb-2">
                <button
                  onClick={() => setActiveTab('OVERVIEW')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    activeTab === 'OVERVIEW' ? 'bg-uc-navy text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  강의 개요
                </button>
                <button
                  onClick={() => setActiveTab('MATERIALS')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    activeTab === 'MATERIALS' ? 'bg-uc-navy text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  강의 교재 및 실습자료 (2건)
                </button>
                <button
                  onClick={() => setActiveTab('ASSIGNMENT')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    activeTab === 'ASSIGNMENT' ? 'bg-uc-navy text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  실습 과제 제출 {assignmentSubmitted && '(제출완료)'}
                </button>
              </div>

              {/* 탭 1: 개요 */}
              {activeTab === 'OVERVIEW' && (
                <div className="space-y-3 text-sm text-slate-700 leading-relaxed">
                  <h3 className="font-bold text-slate-900 text-base">차시별 학습 목표</h3>
                  <p>
                    1. 스마트 선체 블록 3D CAD 모델링 도구의 기본 좌표계 및 부재 배치 프로세스를 숙지합니다.<br />
                    2. 외판 곡면 데이터와 종횡보강재(Longitudinal & Transverse Stiffener) 간의 간섭 여부를 시뮬레이션으로 검증합니다.<br />
                    3. 실습 예제 도면을 바탕으로 1차 블록 조립 모델링 과제물을 완성하여 기한 내 제출합니다.
                  </p>
                </div>
              )}

              {/* 탭 2: 강의 교재/실습자료실 */}
              {activeTab === 'MATERIALS' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center space-x-3">
                      <FileText className="w-5 h-5 text-uc-blue" />
                      <div>
                        <strong className="block text-slate-800 text-sm">
                          1주차_스마트선박_선체외판_실습도면_CAD_v1.dwg
                        </strong>
                        <span className="text-slate-400">용량: 14.8MB | 등록일: 2026.10.15</span>
                      </div>
                    </div>
                    <button className="flex items-center space-x-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 font-semibold hover:bg-slate-100 transition">
                      <Download className="w-3.5 h-3.5" />
                      <span>다운로드</span>
                    </button>
                  </div>

                  <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center space-x-3">
                      <FileText className="w-5 h-5 text-uc-blue" />
                      <div>
                        <strong className="block text-slate-800 text-sm">
                          선체블록_모델링_표준실습_교재_PDF.pdf
                        </strong>
                        <span className="text-slate-400">용량: 8.2MB | 등록일: 2026.10.15</span>
                      </div>
                    </div>
                    <button className="flex items-center space-x-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 font-semibold hover:bg-slate-100 transition">
                      <Download className="w-3.5 h-3.5" />
                      <span>다운로드</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 탭 3: 과제 제출 */}
              {activeTab === 'ASSIGNMENT' && (
                <div className="space-y-4">
                  <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 text-xs text-slate-700 space-y-1">
                    <span className="font-bold text-uc-navy block text-sm">
                      [과제] 선체 외판 3D 모델링 1차 결과 파일 제출
                    </span>
                    <p>마감일시: 2026.11.10 23:59까지 | 배점 가중치: 100점 만점 기준 25점</p>
                  </div>

                  {assignmentSubmitted ? (
                    <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-center space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                      <h4 className="font-bold text-emerald-900 text-sm">과제가 성공적으로 제출되었습니다.</h4>
                      <p className="text-xs text-emerald-700">
                        제출 일시: 2026-09-18 22:15:00 | 강사 채점 대기 중입니다.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleAssignmentSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          과제 설명 및 학습 요약
                        </label>
                        <textarea
                          rows={4}
                          value={assignmentText}
                          onChange={(e) => setAssignmentText(e.target.value)}
                          placeholder="실습을 진행하며 마주한 기술적 과제나 모델링 설계 주안점을 간략히 기록해 주세요."
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-uc-blue leading-relaxed"
                        />
                      </div>

                      <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:bg-slate-50 transition cursor-pointer">
                        <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                        <p className="text-xs font-semibold text-slate-600">
                          완성된 실습 CAD 파일 또는 보고서 업로드
                        </p>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">
                          ZIP, DWG, PDF 형식 (최대 30MB)
                        </span>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 bg-uc-navy hover:bg-uc-navy-light text-white rounded-xl font-bold text-xs shadow transition flex items-center justify-center space-x-2"
                      >
                        <Send className="w-4 h-4 text-uc-orange" />
                        <span>과제물 최종 제출하기</span>
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
