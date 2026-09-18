'use client';

// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 위·변조 방지 전자 수료증
// ==============================================================================
// 파일 경로: src/app/certificate/[id]/page.tsx
// 설명:
//   1. 울산과학대학교 총장 및 앵커사업단 RCC센터장 공식 직인이 날인된 수료증 화면입니다.
//   2. 수료번호, 수료자 성명, 강좌명, 교육기간, 이수시수, 최종평가 결과를 표시합니다.
//   3. 스마트폰 카메라로 스캔하면 즉시 원본 대조가 가능한 2차원 QR 코드를 생성합니다.
//   4. 위·변조 방지를 위한 SHA-256 전자 검증 해시값을 포함합니다.
//   5. [디지털 배지 확인] 및 [수료증 인쇄 / PDF 저장] (A4 용지 최적화)을 지원합니다.
// ==============================================================================

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode';
import { 
  Printer, 
  ShieldCheck, 
  ExternalLink, 
  ArrowLeft, 
  CheckCircle2,
  Sparkles,
  Award
} from 'lucide-react';

// 수료증 데이터 인터페이스 정의
interface CertificateData {
  id: string;
  certificateNo: string;
  learnerName: string;
  birthDate: string; // 보안 마스킹 (예: 1988.**.**)
  courseTitle: string;
  courseCategory: string;
  period: string;
  totalHours: number;
  finalScore: number;
  attendanceRate: number;
  issuedAt: string;
  verificationHash: string;
  issuerTitle: string;
  badgeId: string;
}

export default function CertificateDetailPage() {
  const params = useParams();
  const certId = params?.id as string;

  // 상태 관리: QR 코드 이미지 URL 및 수료증 데이터
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [certData, setCertData] = useState<CertificateData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 컴포넌트 마운트 시 데이터 로드 및 QR 코드 생성
  useEffect(() => {
    // 실제 운영 환경에서는 Supabase DB의 certificates 테이블에서 certId로 조회합니다.
    // 여기서는 화면 시연 및 검증을 위한 표준 규격 수료 데이터를 설정합니다.
    const mockCertificate: CertificateData = {
      id: certId || 'cert-2026-0042',
      certificateNo: 'UC-ANCHOR-2026-00042',
      learnerName: '김울산',
      birthDate: '1985.**.**',
      courseTitle: '조선해양 미래 친환경 스마트 선박 실무 과정',
      courseCategory: '신산업 특화 직무전환과정',
      period: '2026.07.01 ~ 2026.08.25',
      totalHours: 64,
      finalScore: 94.5,
      attendanceRate: 95.0,
      issuedAt: '2026년 08월 26일',
      verificationHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      issuerTitle: '울산과학대학교 총장 조홍래 · 앵커사업단 RCC센터장',
      badgeId: 'badge-uc-2026-0042'
    };

    setCertData(mockCertificate);

    // QR 코드 생성 로직:
    // 스캔 시 제3자 진위 검증 페이지(/verify?cert=수료번호)로 이동하는 절대 URL을 생성합니다.
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://uc-life.vercel.app';
    const verifyUrl = `${origin}/verify?cert=${encodeURIComponent(mockCertificate.certificateNo)}`;

    QRCode.toDataURL(verifyUrl, {
      width: 140,
      margin: 1,
      color: {
        dark: '#1e293b', // 슬레이트 다크 네이비
        light: '#ffffff'
      }
    })
      .then((url) => {
        setQrCodeUrl(url);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('QR 코드 생성 실패:', err);
        setIsLoading(false);
      });
  }, [certId]);

  // 브라우저 기본 인쇄 다이얼로그 호출 (PDF 저장 가능)
  const handlePrint = () => {
    window.print();
  };

  if (isLoading || !certData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-uc-navy mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">수료증 정보를 안전하게 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 print:bg-white print:p-0">
      {/* 1. 상단 컨트롤 바 (화면 전용, 인쇄 시 자동 숨김) */}
      <div className="max-w-4xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <Link
          href="/lms"
          className="inline-flex items-center space-x-2 text-sm font-semibold text-slate-600 hover:text-uc-navy transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>LMS 강의실로 돌아가기</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* 디지털 배지 확인 버튼 */}
          <Link
            href={`/badges/${certData.badgeId}`}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-lg text-sm font-bold transition shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-amber-200" />
            <span>디지털 배지 확인 (LinkedIn)</span>
          </Link>

          <Link
            href={`/verify?cert=${certData.certificateNo}`}
            target="_blank"
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>진위 검증 링크</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
          </Link>

          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-2 px-5 py-2 bg-uc-navy hover:bg-uc-navy-light text-white rounded-lg text-sm font-bold shadow-md transition"
          >
            <Printer className="w-4 h-4" />
            <span>수료증 인쇄 / PDF 저장</span>
          </button>
        </div>
      </div>

      {/* 2. 공식 전자 수료증 본체 (A4 용지 규격 비율 및 전통 증서 디자인) */}
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border-4 border-amber-600/30 p-8 sm:p-14 relative overflow-hidden print:shadow-none print:border-4 print:border-amber-700/60 print:rounded-none print:m-0 print:w-full print:max-w-none">
        {/* 장식용 이중 금박 프레임 라인 */}
        <div className="absolute inset-3 sm:inset-5 border-2 border-amber-600/20 pointer-events-none rounded-lg print:border-amber-700/40"></div>
        <div className="absolute inset-4 sm:inset-6 border border-amber-600/10 pointer-events-none rounded-lg"></div>

        {/* 배경 은은한 워터마크 문양 */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
          <span className="text-9xl font-black text-slate-900 tracking-widest uppercase">
            ULSAN COLLEGE
          </span>
        </div>

        {/* 수료증 상단 헤더 영역 */}
        <div className="relative z-10">
          <div className="flex justify-between items-start border-b border-slate-200 pb-4 mb-8">
            <div>
              <span className="text-xs font-bold text-slate-500 tracking-wider">
                제 {certData.certificateNo} 호
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                전자문서 및 전자거래 기본법 제4조에 따른 공인 전자증서
              </p>
            </div>

            {/* 기관 앰블럼 뱃지 */}
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-lg bg-uc-navy text-white flex items-center justify-center font-bold text-sm">
                UC
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-uc-navy leading-tight">울산과학대학교</p>
                <p className="text-[10px] text-uc-orange font-semibold">앵커사업단 RCC센터</p>
              </div>
            </div>
          </div>

          {/* 수료증 대제목 */}
          <div className="text-center my-8">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-widest text-slate-900 font-serif mb-2">
              수 료 증
            </h1>
            <p className="text-sm font-medium text-slate-500 tracking-widest uppercase">
              CERTIFICATE OF COMPLETION
            </p>
          </div>

          {/* 수료자 인적사항 테이블 */}
          <div className="my-8 max-w-xl mx-auto bg-slate-50/70 rounded-xl p-5 border border-slate-200/80">
            <div className="grid grid-cols-3 gap-y-3 text-sm">
              <span className="text-slate-500 font-semibold">성&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;명</span>
              <span className="col-span-2 text-slate-900 font-bold text-base">
                {certData.learnerName}
              </span>

              <span className="text-slate-500 font-semibold">생 년 월 일</span>
              <span className="col-span-2 text-slate-800 font-medium">
                {certData.birthDate}
              </span>

              <span className="text-slate-500 font-semibold">과 정 구 분</span>
              <span className="col-span-2 text-uc-navy font-semibold">
                {certData.courseCategory}
              </span>

              <span className="text-slate-500 font-semibold">과&nbsp;&nbsp;정&nbsp;&nbsp;명</span>
              <span className="col-span-2 text-slate-900 font-bold">
                {certData.courseTitle}
              </span>

              <span className="text-slate-500 font-semibold">교 육 기 간</span>
              <span className="col-span-2 text-slate-800 font-medium">
                {certData.period} (총 {certData.totalHours}시간)
              </span>

              <span className="text-slate-500 font-semibold">이 수 내 역</span>
              <span className="col-span-2 text-emerald-700 font-semibold flex items-center space-x-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 inline mr-1" />
                출석률 {certData.attendanceRate}% / 종합성적 {certData.finalScore}점 (수료 기준 충족)
              </span>
            </div>
          </div>

          {/* 수료 인증 본문 문구 */}
          <div className="text-center my-10 px-4 sm:px-12">
            <p className="text-base sm:text-lg text-slate-800 leading-relaxed font-serif">
              위 사람은 교육부 및 울산광역시가 주관하는 지자체-대학 협력 기반<br className="hidden sm:inline" />
              지역성장 인재양성 앵커사업의 일환으로 개설된<br className="hidden sm:inline" />
              위 교육과정을 성실히 이수하였으므로 본 증서를 수여합니다.
            </p>
          </div>

          {/* 발급 일자 */}
          <div className="text-center my-6">
            <p className="text-base sm:text-lg font-bold text-slate-800 tracking-wider">
              {certData.issuedAt}
            </p>
          </div>

          {/* 발급 기관 직인 및 QR코드 영역 */}
          <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-6">
            {/* 좌측: 위·변조 방지 QR 코드 및 무결성 해시 */}
            <div className="flex items-center space-x-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
              {qrCodeUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrCodeUrl}
                  alt="위변조 검증 QR코드"
                  className="w-24 h-24 rounded border border-slate-300 bg-white p-1"
                />
              ) : (
                <div className="w-24 h-24 bg-slate-200 animate-pulse rounded"></div>
              )}
              <div className="text-left max-w-[240px]">
                <div className="flex items-center space-x-1 text-emerald-700 font-bold text-xs mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>위·변조 방지 2D QR</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  스마트폰 카메라로 스캔하면 즉시 울산과학대학교 공공서버의 진본 데이터와 대조됩니다.
                </p>
                <div className="mt-1 font-mono text-[9px] text-slate-400 truncate" title={certData.verificationHash}>
                  HASH: {certData.verificationHash.slice(0, 18)}...
                </div>
              </div>
            </div>

            {/* 우측: 직인 날인 및 총장 명의 */}
            <div className="relative text-center sm:text-right pr-6 sm:pr-12">
              <div className="text-xl sm:text-2xl font-bold text-slate-900 font-serif tracking-tight">
                울산과학대학교 총 장
              </div>
              <div className="text-sm font-semibold text-slate-600 mt-1">
                앵커사업단 RCC센터장
              </div>

              {/* 공식 인영 (붉은색 직인 도장 이미지 그래픽) */}
              <div className="absolute -top-3 -right-2 sm:right-0 w-20 h-20 rounded-lg border-2 border-red-600 flex items-center justify-center rotate-6 select-none pointer-events-none bg-red-600/5 shadow-inner">
                <div className="border border-dashed border-red-500 p-1 text-center">
                  <span className="text-[11px] font-black text-red-600 font-serif leading-tight block">
                    울산과학<br />대학교총<br />장의인
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 하단 안내 문구 (화면 전용) */}
      <div className="max-w-4xl mx-auto mt-6 text-center text-xs text-slate-500 print:hidden">
        💡 인쇄 시 <strong>[PDF로 저장]</strong>을 선택하시면 고해상도 전자수료증 파일을 소장하실 수 있습니다. (배경 그래픽 포함 권장)
      </div>
    </div>
  );
}
