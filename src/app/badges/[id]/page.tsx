'use client';

// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - Open Badges 디지털 배지 뷰어
// ==============================================================================
// 파일 경로: src/app/badges/[id]/page.tsx
// 설명:
//   1. 1EdTech Open Badges v2.0 국제 표준 규격을 시각화한 대화형 디지털 배지 화면입니다.
//   2. 수료생이 획득한 직무 역량 태그, 학업 성취도, 발급 기관 공식 인증을 표시합니다.
//   3. [LinkedIn 프로필에 자격증 추가] 원클릭 링크를 제공하여 취업/이직에 활용할 수 있습니다.
//   4. 외부 배지 지갑(Open Badge Passport, Credly) 등록을 위한 표준 JSON-LD 복사를 지원합니다.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  Award, 
  ShieldCheck, 
  Share2, 
  Copy, 
  Check, 
  ExternalLink, 
  ArrowLeft, 
  CheckCircle2, 
  Sparkles, 
  Linkedin, 
  FileCode2, 
  Calendar, 
  Building,
  Tag
} from 'lucide-react';

export default function DigitalBadgeDetailPage() {
  const params = useParams();
  const badgeId = (params?.id as string) || 'badge-uc-2026-0042';

  // 상태 관리: JSON-LD 복사 알림 토글
  const [copied, setCopied] = useState<boolean>(false);
  const [originUrl, setOriginUrl] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOriginUrl(window.location.origin);
    }
  }, []);

  // 디지털 배지 상세 데이터 (시연 및 검증용)
  const badge = {
    id: badgeId,
    code: 'BDG-SMART-SHIP-2026',
    name: '스마트 친환경 선박 3D설계 직무 마스터 배지',
    level: 'MASTER (최고 숙련도)',
    recipientName: '김*산',
    recipientEmailHash: 'sha256$e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    courseTitle: '조선해양 미래 친환경 스마트 선박 실무 과정',
    issuer: '울산과학대학교 앵커사업단 RCC센터',
    issuedDate: '2026년 08월 26일',
    attendanceRate: 95.0,
    finalScore: 94.5,
    certificateNo: 'UC-ANCHOR-2026-00042',
    skills: [
      '스마트선박 3D설계',
      '선체 블록 모델링',
      '친환경 LNG/수소 추진체계',
      '조선가공 공정시뮬레이션',
      '선박 품질검사'
    ],
    criteria: '울산과학대학교 앵커사업단 RCC센터 주관 64시간 교육 이수, 출석률 80% 이상 및 종합평가 60점 이상 충족'
  };

  // 링크드인 프로필에 자격증 직접 추가하는 공식 URL 빌더
  const getLinkedInCertUrl = () => {
    const certName = encodeURIComponent(badge.name);
    const orgName = encodeURIComponent('울산과학대학교');
    const issueYear = '2026';
    const issueMonth = '8';
    const certUrl = encodeURIComponent(`${originUrl}/badges/${badge.id}`);
    const certId = encodeURIComponent(badge.certificateNo);

    return `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${certName}&organizationName=${orgName}&issueYear=${issueYear}&issueMonth=${issueMonth}&certUrl=${certUrl}&certId=${certId}`;
  };

  // Open Badges v2.0 JSON-LD 메타데이터 클립보드 복사
  const handleCopyJsonLd = () => {
    const jsonLdUrl = `${originUrl}/api/badges/${badge.id}`;
    navigator.clipboard.writeText(jsonLdUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* 상단 네비게이션 */}
        <div className="flex items-center justify-between">
          <Link
            href={`/certificate/${badge.certificateNo}`}
            className="inline-flex items-center space-x-1.5 text-sm font-semibold text-slate-600 hover:text-uc-navy transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>수료증 페이지로 돌아가기</span>
          </Link>

          <span className="text-xs font-mono font-bold bg-amber-100 text-amber-900 px-3 py-1 rounded-full flex items-center space-x-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>1EdTech Open Badges v2.0 호환</span>
          </span>
        </div>

        {/* 1. 배지 카드 메인 비주얼 */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          {/* 배지 상단 화려한 앰블럼 배경 */}
          <div className="bg-gradient-to-b from-uc-navy via-slate-900 to-slate-950 p-8 sm:p-12 text-center text-white relative overflow-hidden">
            {/* 배경 기하학 패턴 */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>

            {/* 디지털 배지 3D 메달 아이콘 렌더링 */}
            <div className="relative inline-block my-4">
              <div className="w-36 h-36 sm:w-44 sm:h-44 mx-auto rounded-full bg-gradient-to-tr from-amber-600 via-amber-300 to-yellow-100 p-2 shadow-2xl shadow-amber-500/20 flex items-center justify-center animate-pulse">
                <div className="w-full h-full rounded-full bg-uc-navy border-4 border-amber-400/80 flex flex-col items-center justify-center p-3 text-center shadow-inner">
                  <div className="w-10 h-10 rounded-lg bg-amber-400 text-uc-navy flex items-center justify-center font-black text-lg mb-1 shadow">
                    UC
                  </div>
                  <span className="text-[10px] font-black text-amber-300 tracking-wider uppercase">
                    OPEN BADGE
                  </span>
                  <span className="text-xs font-extrabold text-white mt-0.5 leading-tight">
                    MASTER
                  </span>
                  <div className="flex items-center space-x-0.5 text-amber-300 mt-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <span key={i} className="text-[9px]">★</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 배지 타이틀 및 등급 */}
            <div className="relative z-10 mt-4 space-y-2">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-400/20 border border-amber-400/30 text-amber-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>공식 인증 직무 역량 배지</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {badge.name}
              </h1>
              <p className="text-slate-300 text-sm max-w-lg mx-auto">
                {badge.courseTitle}
              </p>
            </div>
          </div>

          {/* 2. 배지 본문 세부 명세 */}
          <div className="p-6 sm:p-10 space-y-8">
            {/* 수여 인적사항 및 발급정보 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <div>
                <span className="text-xs text-slate-500 font-bold block">배지 수령자 (Recipient)</span>
                <span className="text-base font-bold text-slate-900 mt-0.5 block">
                  {badge.recipientName}
                </span>
                <span className="text-[11px] font-mono text-slate-400 truncate block mt-0.5">
                  {badge.recipientEmailHash.slice(0, 26)}...
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-500 font-bold block">수여 일자 (Issued On)</span>
                <span className="text-sm font-semibold text-slate-800 flex items-center space-x-1 mt-0.5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>{badge.issuedDate}</span>
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold block mt-0.5">
                  * 유효기간: 평생 영구 인증
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-500 font-bold block">발급 주관기관 (Issuer)</span>
                <span className="text-sm font-bold text-slate-800 flex items-center space-x-1 mt-0.5">
                  <Building className="w-4 h-4 text-slate-400" />
                  <span>{badge.issuer}</span>
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-500 font-bold block">연계 수료증 번호</span>
                <Link
                  href={`/certificate/${badge.certificateNo}`}
                  className="text-sm font-bold text-uc-navy hover:underline flex items-center space-x-1 mt-0.5"
                >
                  <span>{badge.certificateNo}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* 검증된 직무 역량 태그 (Competencies) */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Tag className="w-4 h-4 text-uc-navy" />
                <span>검증된 직무 역량 키워드 (Skills & Competencies)</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {badge.skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-uc-navy rounded-xl text-xs font-bold shadow-sm"
                  >
                    #{skill}
                  </span>
                ))}
              </div>
            </div>

            {/* 수여 기준 (Criteria) */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900">
                수여 기준 및 학업 달성도 (Issuance Criteria)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
                {badge.criteria}
                <span className="block mt-2 font-semibold text-emerald-700">
                  ✔ 확정 성취도: 출석률 {badge.attendanceRate}% / 평가 종합성적 {badge.finalScore}점 (수료 기준 완벽 충족)
                </span>
              </p>
            </div>

            {/* 3. 소셜 공유 및 외부 배지 지갑 연동 액션 버튼 */}
            <div className="pt-6 border-t border-slate-200 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Share2 className="w-4 h-4 text-uc-navy" />
                <span>배지 등록 및 소셜 미디어 증명</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 링크드인 자격증 추가 버튼 */}
                <a
                  href={getLinkedInCertUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center space-x-2 px-5 py-3.5 bg-[#0A66C2] hover:bg-[#084e96] text-white rounded-xl font-bold text-sm shadow-md transition"
                >
                  <Linkedin className="w-5 h-5 fill-current" />
                  <span>LinkedIn 프로필에 자격증 추가</span>
                </a>

                {/* Open Badges JSON-LD API 복사 버튼 */}
                <button
                  onClick={handleCopyJsonLd}
                  className="flex items-center justify-center space-x-2 px-5 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm shadow-md transition"
                >
                  {copied ? (
                    <>
                      <Check className="w-5 h-5 text-emerald-400" />
                      <span>표준 JSON-LD URL 복사 완료!</span>
                    </>
                  ) : (
                    <>
                      <FileCode2 className="w-5 h-5 text-amber-400" />
                      <span>Open Badges JSON-LD URL 복사</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-slate-400 text-center">
                * Credly, Badgr, Open Badge Passport 등 전 세계 모든 공인 배지 지갑에 등록 가능한 국제 표준 URL입니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
