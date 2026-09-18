'use client';

// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 모바일 QR 전자출결 체크인
// ==============================================================================
// 파일 경로: src/app/lms/attendance/qr/page.tsx
// 설명:
//   오프라인 대면 실습 강좌에 참여하는 재직자 및 성인학습자가
//   강의실 입구의 고유 QR 코드를 스마트폰 카메라로 비추거나,
//   강사가 제공한 6자리 인증코드를 입력하여 실시간 출결을 인정받는 화면입니다.
// ==============================================================================

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  QrCode, 
  MapPin, 
  CheckCircle2, 
  Camera, 
  ShieldCheck, 
  KeyRound,
  RefreshCw,
  Sparkles
} from 'lucide-react';

export default function MobileQrAttendancePage() {
  // 출결 방식 모드 ('CAMERA' | 'PIN')
  const [mode, setMode] = useState<'CAMERA' | 'PIN'>('CAMERA');
  // 수기 인증코드 6자리
  const [pinCode, setPinCode] = useState<string>('');
  // 스캔 처리 상태
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [attendanceSuccess, setAttendanceSuccess] = useState<boolean>(false);
  const [attendanceTime, setAttendanceTime] = useState<string>('');

  // QR 스캔 시뮬레이션 처리
  const handleSimulateScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setAttendanceSuccess(true);
      const now = new Date();
      setAttendanceTime(
        `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      );
    }, 1200);
  };

  // PIN 코드 제출 처리
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinCode.length !== 6) {
      alert('강사가 안내한 6자리 출석 인증 번호를 정확히 입력해 주세요.');
      return;
    }
    handleSimulateScan();
  };

  return (
    <div className="bg-slate-900 min-h-screen text-white py-8 px-4 sm:px-6 flex flex-col justify-between">
      <div className="max-w-md mx-auto w-full space-y-6">
        {/* 상단 뒤로가기 */}
        <div className="flex justify-between items-center">
          <Link
            href="/lms"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>LMS 대시보드로</span>
          </Link>
          <span className="text-xs bg-uc-orange/20 text-uc-orange font-bold px-2.5 py-1 rounded-full border border-uc-orange/30">
            실시간 GPS 연동중
          </span>
        </div>

        {/* 1. 타이틀 및 현재 위치 감지 배너 */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">
            오프라인 실습실 전자출결
          </h1>
          <p className="text-xs text-slate-400">
            강의실(동부캠퍼스 3공학관 204호)에 부착된 QR 코드를 비춰주세요.
          </p>

          {/* GPS 위치 인증 상태 */}
          <div className="inline-flex items-center space-x-1.5 text-xs text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/30">
            <MapPin className="w-3.5 h-3.5" />
            <span>울산과학대 동부캠퍼스 반경 50m 이내 인증 완료</span>
          </div>
        </div>

        {/* 2. 출석 인정 성공 모달 */}
        {attendanceSuccess ? (
          <div className="bg-white text-slate-900 rounded-3xl p-8 text-center space-y-4 shadow-xl animate-fade-in">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-uc-blue uppercase">Attendance Verified</span>
              <h2 className="text-xl font-bold">정상 출석이 확인되었습니다!</h2>
              <p className="text-xs text-slate-500">
                인증 시각: <strong>{attendanceTime}</strong>
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl text-xs text-slate-600 space-y-1 text-left border border-slate-200">
              <div>과정명: 스마트 조선·해양 3D 선체 블록 모델링</div>
              <div>출결상태: <strong className="text-emerald-600">출석 (PRESENT)</strong></div>
              <div>누적 출석률: <strong>84.4% (수료 기준 80% 충족중)</strong></div>
            </div>

            <div className="pt-2">
              <Link
                href="/lms"
                className="w-full block py-3.5 bg-uc-navy text-white rounded-xl font-bold text-sm shadow hover:bg-uc-navy-light transition"
              >
                나의 학습실로 돌아가기
              </Link>
            </div>
          </div>
        ) : (
          /* 3. 스캐너 및 인증 입력 인터페이스 */
          <div className="space-y-4">
            {/* 탭 토글: 카메라 스캔 vs 번호 입력 */}
            <div className="flex bg-slate-800 p-1 rounded-2xl text-xs font-bold">
              <button
                onClick={() => setMode('CAMERA')}
                className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center space-x-1.5 ${
                  mode === 'CAMERA' ? 'bg-uc-orange text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>QR 카메라 스캔</span>
              </button>
              <button
                onClick={() => setMode('PIN')}
                className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center space-x-1.5 ${
                  mode === 'PIN' ? 'bg-uc-orange text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                <span>6자리 번호 입력</span>
              </button>
            </div>

            {mode === 'CAMERA' ? (
              /* 카메라 뷰파인더 렌더링 영역 */
              <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 text-center space-y-6">
                {/* 가상의 뷰파인더 사각형 */}
                <div className="relative w-64 h-64 mx-auto rounded-2xl border-2 border-uc-orange/70 flex items-center justify-center overflow-hidden bg-black/40">
                  {/* 스캔 가이드 라인 애니메이션 */}
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-uc-orange to-transparent animate-pulse" />
                  <QrCode className="w-24 h-24 text-slate-700" />
                  <span className="absolute bottom-3 text-[11px] text-slate-400 bg-black/60 px-3 py-1 rounded-full">
                    QR 코드를 사각형 안에 맞춰주세요
                  </span>
                </div>

                {/* 시뮬레이션 스캔 버튼 */}
                <button
                  onClick={handleSimulateScan}
                  disabled={isScanning}
                  className="w-full py-3.5 bg-uc-orange hover:bg-uc-orange-hover text-white rounded-xl font-bold text-sm shadow transition disabled:bg-slate-700 flex items-center justify-center space-x-2"
                >
                  {isScanning ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>QR 전자서명 검증 중...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      <span>QR 코드 스캔 및 출석 인정</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* 6자리 PIN 코드 수기 입력 모드 */
              <form onSubmit={handlePinSubmit} className="bg-slate-800 rounded-3xl p-6 border border-slate-700 space-y-4">
                <label className="block text-xs font-bold text-slate-300">
                  강사가 안내한 당일 출석 보안코드 (6자리)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="예: 749201"
                  className="w-full text-center tracking-[0.5em] text-2xl font-mono py-3.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-uc-orange"
                />
                <button
                  type="submit"
                  disabled={isScanning || pinCode.length !== 6}
                  className="w-full py-3.5 bg-uc-orange hover:bg-uc-orange-hover text-white rounded-xl font-bold text-sm shadow transition disabled:bg-slate-700"
                >
                  {isScanning ? '인증 확인 중...' : '출석 번호 확인'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* 4. 부정 출결 방지 법적 고지 안내 */}
        <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center space-x-1.5 text-slate-300 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>국비 평생직업교육 출결 관리 규정</span>
          </div>
          <p>
            대리 출석 또는 위치 위변조 등 부정 출결 적발 시 관련 법령 및 대학 학칙에 따라
            수료 취소 및 국비 지원금 환수 조치될 수 있습니다.
          </p>
        </div>
      </div>

      {/* 하단 푸터 표기 */}
      <div className="text-center text-[11px] text-slate-500 py-4">
        울산과학대학교 평생직업교육 앵커사업단 스마트 출결 시스템
      </div>
    </div>
  );
}
