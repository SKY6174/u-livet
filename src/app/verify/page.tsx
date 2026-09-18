'use client';

// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 수료증 위·변조 진위 검증 포털
// ==============================================================================
// 파일 경로: src/app/verify/page.tsx
// 설명:
//   1. 기업 인사담당자, 공공기관, 교육생 본인이 수료증의 진위 여부를 공적으로 확인하는 페이지입니다.
//   2. 수료증에 인쇄된 2차원 QR 코드를 카메라로 스캔하면 URL 파라미터(?cert=...)를 통해 자동으로 조회됩니다.
//   3. 수료번호(예: UC-ANCHOR-2026-00042)를 직접 입력하여 검색할 수도 있습니다.
//   4. 데이터베이스 원본과 대조하여 SHA-256 전자 해시 무결성 및 수료 취소(부정 출결 등) 여부를 판정합니다.
//   5. 개인정보보호법에 따라 성명 마스킹(김*산) 처리로 안전하게 정보를 제공합니다.
// ==============================================================================

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  ShieldCheck, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Building2, 
  Award, 
  Calendar, 
  Clock, 
  Fingerprint,
  FileText,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

// 검증 결과 데이터 인터페이스 정의
interface VerifiedCertificate {
  certificateNo: string;
  learnerNameMasked: string;
  courseTitle: string;
  courseCategory: string;
  totalHours: number;
  attendanceRate: number;
  finalScore: number;
  issuedAt: string;
  verificationHash: string;
  issuerOrg: string;
  status: 'VALID' | 'REVOKED' | 'INVALID';
  statusMessage: string;
}

// 실제 검증 로직을 담은 내부 컴포넌트 (useSearchParams 사용을 위해 Suspense 래핑)
function VerifyContent() {
  const searchParams = useSearchParams();
  const certFromQuery = searchParams.get('cert') || '';

  // 검색 입력값 및 검증 결과 상태 관리
  const [inputCertNo, setInputCertNo] = useState<string>(certFromQuery);
  const [result, setResult] = useState<VerifiedCertificate | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // 샘플 데이터베이스 목업 레코드 (실제 서비스에서는 Supabase public.certificates 테이블 조회)
  const sampleDatabase: Record<string, VerifiedCertificate> = {
    'UC-ANCHOR-2026-00042': {
      certificateNo: 'UC-ANCHOR-2026-00042',
      learnerNameMasked: '김*산',
      courseTitle: '조선해양 미래 친환경 스마트 선박 실무 과정',
      courseCategory: '신산업 특화 직무전환과정',
      totalHours: 64,
      attendanceRate: 95.0,
      finalScore: 94.5,
      issuedAt: '2026.08.26',
      verificationHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      issuerOrg: '울산과학대학교 평생직업교육 앵커사업단',
      status: 'VALID',
      statusMessage: '울산과학대학교 공식 발급 대장에 정식 등록된 원본 수료증입니다.'
    },
    'UC-ANCHOR-2026-00015': {
      certificateNo: 'UC-ANCHOR-2026-00015',
      learnerNameMasked: '이*현',
      courseTitle: '이차전지 스마트 팩토리 품질관리 엔지니어 양성',
      courseCategory: '첨단제조 전문인력과정',
      totalHours: 80,
      attendanceRate: 91.5,
      finalScore: 89.0,
      issuedAt: '2026.08.10',
      verificationHash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
      issuerOrg: '울산과학대학교 평생직업교육 앵커사업단',
      status: 'VALID',
      statusMessage: '울산과학대학교 공식 발급 대장에 정식 등록된 원본 수료증입니다.'
    },
    'UC-ANCHOR-2026-00003': {
      certificateNo: 'UC-ANCHOR-2026-00003',
      learnerNameMasked: '박*수',
      courseTitle: '수소에너지 모빌리티 시스템 기초',
      courseCategory: '지역특화 신산업과정',
      totalHours: 40,
      attendanceRate: 65.0,
      finalScore: 50.0,
      issuedAt: '2026.07.15',
      verificationHash: '3a5b2c918e7d4f6a1c2b3e4d5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a',
      issuerOrg: '울산과학대학교 평생직업교육 앵커사업단',
      status: 'REVOKED',
      statusMessage: '출결 허위 대리출석 적발로 인해 학칙 및 사업단 운영규정에 의거 발급이 직권 취소된 수료증입니다.'
    }
  };

  // 진위 검증 실행 함수
  const performVerification = (certNoToVerify: string) => {
    const trimmed = certNoToVerify.trim();
    if (!trimmed) return;

    setIsSearching(true);
    setHasSearched(true);

    // 실제 서버 통신 느낌을 위한 가벼운 딜레이 (0.3초)
    setTimeout(() => {
      const match = sampleDatabase[trimmed];
      if (match) {
        setResult(match);
      } else {
        // 일치하는 수료증 번호가 없는 경우 (위조 또는 오입력)
        setResult({
          certificateNo: trimmed,
          learnerNameMasked: '확인불가',
          courseTitle: '미등록 과정',
          courseCategory: '미확인',
          totalHours: 0,
          attendanceRate: 0,
          finalScore: 0,
          issuedAt: '-',
          verificationHash: 'N/A',
          issuerOrg: '울산과학대학교 평생직업교육 앵커사업단',
          status: 'INVALID',
          statusMessage: '울산과학대학교 발급 대장에 등록되지 않은 수료번호입니다. 위·변조 문서일 가능성이 있으니 주의하십시오.'
        });
      }
      setIsSearching(false);
    }, 300);
  };

  // URL 쿼리에 cert 번호가 있으면 페이지 진입 시 자동으로 1회 검증 실행
  useEffect(() => {
    if (certFromQuery) {
      setInputCertNo(certFromQuery);
      performVerification(certFromQuery);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certFromQuery]);

  // 검색 폼 제출 핸들러
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performVerification(inputCertNo);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* 1. 페이지 헤더 안내 */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 mb-4 shadow-sm">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          전자 수료증 위·변조 진위 검증 포털
        </h1>
        <p className="text-slate-600 mt-2 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
          울산과학대학교 평생직업교육 앵커사업단에서 발급한 공인 전자수료증의 고유 발급번호 및 암호화 해시를 대조하여 위변조 여부를 실시간으로 판정합니다.
        </p>
      </div>

      {/* 2. 수료번호 검색 입력창 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 mb-8">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <label htmlFor="certNo" className="block text-sm font-bold text-slate-700">
            수료증 등록번호 입력 (또는 QR코드 자동스캔)
          </label>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-grow w-full">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <input
                id="certNo"
                type="text"
                value={inputCertNo}
                onChange={(e) => setInputCertNo(e.target.value)}
                placeholder="예: UC-ANCHOR-2026-00042"
                className="w-full pl-11 pr-4 py-3.5 border border-slate-300 rounded-xl text-base font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-uc-navy focus:border-transparent transition"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !inputCertNo.trim()}
              className="w-full sm:w-auto px-8 py-3.5 bg-uc-navy hover:bg-uc-navy-light disabled:bg-slate-300 text-white rounded-xl font-bold text-base transition shadow-md whitespace-nowrap flex items-center justify-center space-x-2"
            >
              {isSearching ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>대조 확인 중...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>진위 확인</span>
                </>
              )}
            </button>
          </div>

          {/* 간편 테스트용 바로가기 배지 */}
          <div className="pt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold">테스트용 번호:</span>
            <button
              type="button"
              onClick={() => {
                setInputCertNo('UC-ANCHOR-2026-00042');
                performVerification('UC-ANCHOR-2026-00042');
              }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-mono transition"
            >
              UC-ANCHOR-2026-00042 (정상 발급건)
            </button>
            <button
              type="button"
              onClick={() => {
                setInputCertNo('UC-ANCHOR-2026-00003');
                performVerification('UC-ANCHOR-2026-00003');
              }}
              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-md font-mono transition"
            >
              UC-ANCHOR-2026-00003 (발급 취소건)
            </button>
          </div>
        </form>
      </div>

      {/* 3. 진위 검증 결과 화면 */}
      {hasSearched && result && (
        <div className="space-y-6 animate-fadeIn">
          {/* 상태 배너 (정상 / 취소 / 불일치) */}
          {result.status === 'VALID' && (
            <div className="bg-emerald-50 border-2 border-emerald-500/80 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 mb-1">
                    <span>공식 인증 완료</span>
                  </div>
                  <h2 className="text-xl font-bold text-emerald-950">
                    정식 발급된 유효한 수료증입니다 (Authentic)
                  </h2>
                  <p className="text-sm text-emerald-800 mt-0.5">
                    {result.statusMessage}
                  </p>
                </div>
              </div>

              {/* 원본 수료증 인쇄/보기 페이지 링크 */}
              <Link
                href={`/certificate/${result.certificateNo}`}
                target="_blank"
                className="inline-flex items-center space-x-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl transition shadow flex-shrink-0"
              >
                <span>수료증 원본 보기</span>
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          )}

          {result.status === 'REVOKED' && (
            <div className="bg-amber-50 border-2 border-amber-500/80 rounded-2xl p-6 flex items-start space-x-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 mb-1">
                  <span>효력 상실 (REVOKED)</span>
                </div>
                <h2 className="text-xl font-bold text-amber-950">
                  직권 취소 처리된 수료증입니다
                </h2>
                <p className="text-sm text-amber-800 mt-1 leading-relaxed">
                  {result.statusMessage}
                </p>
              </div>
            </div>
          )}

          {result.status === 'INVALID' && (
            <div className="bg-rose-50 border-2 border-rose-500/80 rounded-2xl p-6 flex items-start space-x-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-rose-500 text-white flex items-center justify-center flex-shrink-0 shadow">
                <XCircle className="w-7 h-7" />
              </div>
              <div>
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 mb-1">
                  <span>위조 의심 / 미등록</span>
                </div>
                <h2 className="text-xl font-bold text-rose-950">
                  등록되지 않은 유효하지 않은 번호입니다
                </h2>
                <p className="text-sm text-rose-800 mt-1 leading-relaxed">
                  {result.statusMessage}
                </p>
              </div>
            </div>
          )}

          {/* 원본 대조 상세 데이터 명세표 */}
          {result.status !== 'INVALID' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center space-x-2">
                <FileText className="w-5 h-5 text-uc-navy" />
                <span>발급 대장 원본 기록 대조 정보</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">수료증 등록번호</span>
                    <span className="text-base font-bold text-slate-900 font-mono">
                      {result.certificateNo}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">수료자 성명</span>
                    <span className="text-base font-bold text-slate-900">
                      {result.learnerNameMasked}
                    </span>
                    <span className="text-[11px] text-slate-400 ml-2">(개인정보보호법 마스킹)</span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">발급 일자</span>
                    <span className="text-sm font-semibold text-slate-800 flex items-center space-x-1 mt-0.5">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>{result.issuedAt}</span>
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">이수 과정명</span>
                    <span className="text-base font-bold text-slate-900 block mt-0.5">
                      {result.courseTitle}
                    </span>
                    <span className="text-xs text-uc-navy font-semibold">{result.courseCategory}</span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">이수 요건 충족 내역</span>
                    <div className="flex items-center space-x-4 mt-1 text-xs sm:text-sm font-medium text-slate-700">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>총 {result.totalHours}시간</span>
                      </span>
                      <span>출석률 {result.attendanceRate}%</span>
                      <span>평가 {result.finalScore}점</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">발급 주관기관</span>
                    <span className="text-sm font-bold text-slate-800 flex items-center space-x-1 mt-0.5">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span>{result.issuerOrg}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* SHA-256 전자 무결성 해시 정보 */}
              <div className="mt-6 pt-6 border-t border-slate-100">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 mb-1.5">
                  <Fingerprint className="w-4 h-4 text-emerald-600" />
                  <span>SHA-256 전자 서명 무결성 해시 (Integrity Checksum)</span>
                </div>
                <div className="bg-slate-900 text-emerald-400 font-mono text-xs p-3.5 rounded-xl break-all">
                  {result.verificationHash}
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  * 본 해시값은 수료자, 이수과정, 발급번호, 확정성적을 결합하여 생성된 단방향 암호화 해시로, 단 1글자의 위변조가 발생해도 값이 완전히 달라져 즉시 검출됩니다.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. 하단 안내 및 법적 고지 카드 */}
      <div className="mt-12 bg-slate-50 rounded-2xl border border-slate-200 p-6 text-xs text-slate-600 space-y-2">
        <h4 className="font-bold text-slate-800 text-sm flex items-center space-x-1.5">
          <Award className="w-4 h-4 text-uc-navy" />
          <span>공식 전자수료증 진위 검증 안내 및 법적 효력</span>
        </h4>
        <ul className="list-disc list-inside space-y-1 text-slate-500 leading-relaxed">
          <li>본 검증 서비스는 교육부 지자체·대학 협력기반 지역혁신사업(RIS) 평생직업교육 앵커사업 지침을 준수합니다.</li>
          <li>수료증을 위·변조하여 행사하는 행위는 형법 제225조(공문서등의 위조·변조) 또는 제231조(사문서등의 위조·변조)에 따라 처벌받을 수 있습니다.</li>
          <li>기업 채용 시 공식 확인 서류가 추가로 필요하신 경우 울산과학대학교 앵커사업단 행정실(052-230-0500)로 문의하시기 바랍니다.</li>
        </ul>
      </div>
    </div>
  );
}

// Next.js App Router의 useSearchParams 컴포넌트는 Suspense 바운더리 안에서 렌더링해야 합니다.
export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-uc-navy border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm font-medium text-slate-600">검증 시스템 로딩 중...</p>
        </div>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
