"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import QRCode from "qrcode";
import { 
  Maximize2, 
  Minimize2, 
  RotateCw, 
  Copy, 
  Check, 
  Clock, 
  Calendar, 
  Users, 
  Sparkles, 
  ExternalLink 
} from "lucide-react";
import type { AttendanceBook } from "@/lib/attendance/model";
import type { ClassSession } from "@/lib/portal/evaluation";

interface QrPresenterProps {
  offering: AttendanceBook["offering"];
  sessions: ClassSession[];
  activeSession: ClassSession;
  enrolledCount: number;
}

export function QrPresenter({
  offering,
  sessions,
  activeSession,
  enrolledCount,
}: QrPresenterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);

  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [token, setToken] = useState<string>("");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // 현재 사이트의 Origin(도메인)을 안전하게 취득
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  
  // 학생 출석 체크 전용 URL 구성
  const checkinUrl = `${origin}/learning/${offering.id}/attendance/checkin?session=${activeSession.id}&t=${token}`;

  // QR 코드 생성 함수 (랜덤 토큰으로 부정 출석 방지)
  const generateQr = useCallback(async () => {
    try {
      const randomToken = Math.random().toString(36).substring(2, 10);
      setToken(randomToken);
      const urlToEncode = `${origin}/learning/${offering.id}/attendance/checkin?session=${activeSession.id}&t=${randomToken}`;
      
      const dataUrl = await QRCode.toDataURL(urlToEncode, {
        width: 400,
        margin: 2,
        color: {
          dark: "#0f3d38", // 울산과학대학교 딥 틸(Teal) 색상
          light: "#ffffff",
        },
      });
      setQrDataUrl(dataUrl);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("QR Code 생성 실패:", err);
    }
  }, [origin, offering.id, activeSession.id]);

  // 세션이 변경되거나 컴포넌트 마운트 시 QR 코드 새로 생성
  useEffect(() => {
    generateQr();
  }, [generateQr]);

  // 1분(60초)마다 자동으로 토큰을 갱신하여 캡처 공유 방지 (보안 강화)
  useEffect(() => {
    const timer = setInterval(() => {
      generateQr();
    }, 60000);
    return () => clearInterval(timer);
  }, [generateQr]);

  // 전체화면 토글 핸들러
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error("전체화면 전환 실패:", err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  // 전체화면 변경 감지 이벤트
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // 링크 복사 핸들러
  const handleCopyLink = () => {
    if (!checkinUrl) return;
    navigator.clipboard.writeText(checkinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 세션 선택 변경
  const handleSessionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sessionId = e.target.value;
    router.push(`${pathname}?session=${sessionId}`);
  };

  return (
    <div 
      ref={containerRef} 
      className={`rounded-2xl border border-teal-200 bg-white p-6 shadow-lg transition-all ${
        isFullscreen ? "flex flex-col justify-center items-center h-screen w-screen p-10 overflow-y-auto bg-slate-900 text-white" : ""
      }`}
    >
      {/* 1. 컨트롤 바 (세션 선택 및 전체화면 버튼) */}
      <div className={`flex flex-wrap items-center justify-between gap-4 border-b pb-5 w-full ${isFullscreen ? "border-slate-700" : "border-slate-100"}`}>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="session-select" className="text-sm font-bold flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-teal-600" />
            수업 차시 선택:
          </label>
          <select
            id="session-select"
            value={activeSession.id}
            onChange={handleSessionChange}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-700 ${
              isFullscreen ? "bg-slate-800 border-slate-600 text-white" : "bg-white border-slate-300 text-slate-900"
            }`}
          >
            {sessions.map((s, idx) => (
              <option key={s.id} value={s.id}>
                [{idx + 1}차시] {s.title} ({s.starts_at.slice(5, 16)} ~ {s.ends_at.slice(11, 16)})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={generateQr}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
              isFullscreen ? "border-slate-600 hover:bg-slate-800 text-slate-200" : "border-slate-200 hover:bg-slate-50 text-slate-700"
            }`}
            title="새 토큰으로 QR 갱신"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>QR 갱신</span>
          </button>
          
          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-800 px-4 py-2 text-xs font-bold text-white hover:bg-teal-900 shadow-sm transition-colors"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-4 w-4" />
                <span>전체화면 종료</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4" />
                <span>빔 프로젝터 전체화면</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. 대형 QR 코드 및 정보 영역 */}
      <div className={`grid gap-8 items-center py-8 w-full max-w-4xl mx-auto ${isFullscreen ? "lg:grid-cols-2" : "md:grid-cols-2"}`}>
        {/* QR 코드 표시 박스 */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative rounded-2xl border-4 border-teal-800 bg-white p-5 shadow-2xl transition-transform hover:scale-105">
            {qrDataUrl ? (
              <Image
                src={qrDataUrl}
                alt="실시간 출석 체크용 QR 코드"
                width={320}
                height={320}
                priority
                className="rounded-lg h-auto w-auto max-w-[280px] sm:max-w-[320px]"
              />
            ) : (
              <div className="flex h-72 w-72 items-center justify-center text-sm text-slate-500">
                QR 코드를 생성하고 있습니다...
              </div>
            )}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-teal-800 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
              실시간 출석 QR
            </div>
          </div>

          <p className={`mt-4 text-xs flex items-center gap-1.5 ${isFullscreen ? "text-slate-400" : "text-slate-500"}`}>
            <Clock className="h-3.5 w-3.5 text-teal-600" />
            최근 갱신: {lastRefreshed.toLocaleTimeString()} (60초 자동 보안 갱신)
          </p>
        </div>

        {/* 안내 및 세션 정보 박스 */}
        <div className="space-y-5">
          <div className={`rounded-xl p-5 border ${isFullscreen ? "bg-slate-800/80 border-slate-700" : "bg-teal-50/70 border-teal-100"}`}>
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700">CURRENT CLASS</span>
            <h3 className={`mt-1 text-xl font-bold ${isFullscreen ? "text-white" : "text-slate-900"}`}>
              {activeSession.title}
            </h3>
            <p className={`mt-1 text-sm ${isFullscreen ? "text-slate-300" : "text-slate-700"}`}>
              {offering.name}
            </p>
            
            <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t border-teal-200/50 text-xs">
              <div>
                <span className="text-slate-500 block">수업 시간</span>
                <strong className={isFullscreen ? "text-slate-200" : "text-slate-800"}>
                  {activeSession.starts_at.slice(11, 16)} ~ {activeSession.ends_at.slice(11, 16)}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">수강 확정 인원</span>
                <strong className="text-teal-700 font-bold">{enrolledCount}명</strong>
              </div>
            </div>
          </div>

          {/* 수강생 스캔 안내문 */}
          <div className={`rounded-xl p-5 border ${isFullscreen ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
            <h4 className="text-sm font-bold flex items-center gap-2 text-teal-800 mb-2">
              <Sparkles className="h-4 w-4" />
              수강생 출석 방법 안내
            </h4>
            <ol className={`list-decimal list-inside space-y-1.5 text-xs leading-5 ${isFullscreen ? "text-slate-300" : "text-slate-600"}`}>
              <li>스마트폰의 <strong>기본 카메라</strong> 앱을 켭니다.</li>
              <li>화면의 <strong>QR 코드</strong>를 비추고 나타나는 링크를 누릅니다.</li>
              <li>로그인된 수강생 계정으로 <strong>즉시 출석이 자동 인정</strong>됩니다.</li>
            </ol>
          </div>

          {/* 직접 링크 복사 버튼 (비상용) */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className={`w-full flex items-center justify-center gap-2 rounded-lg border py-2.5 px-3 text-xs font-semibold transition-colors ${
                isFullscreen ? "border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200" : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">출석 체크 링크가 복사되었습니다!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-slate-500" />
                  <span>카메라 인식이 안 될 때: 출석 링크 직접 복사</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
